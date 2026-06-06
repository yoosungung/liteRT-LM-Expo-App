package expo.modules.litertlmnative

import android.content.Context
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.tool
import com.google.gson.JsonParser
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap

/**
 * Phase 1 — LiteRT-LM Engine wrapper + InferenceStateBridge skeleton.
 */
class EngineBridge(private val context: Context) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val bridgeMutex = Mutex()
  private val conversations = ConcurrentHashMap<String, Conversation>()
  private val generationJobs = ConcurrentHashMap<String, Job>()
  private val toolApprovalGate = ToolApprovalGate()
  private var lifecycle: String = "unloaded"
  private var engine: Engine? = null
  private var lastModelPath: String? = null
  private var lastBackend: String = "cpu"
  private var lastCacheDir: String? = null
  @Volatile
  private var persistKvOnHibernate: Boolean = true

  var onLifecycleChanged: ((from: String, to: String) -> Unit)? = null
  var onStreamDelta: ((conversationId: String, delta: String, kind: String) -> Unit)? = null
  var onMessageComplete: ((conversationId: String, content: String) -> Unit)? = null
  var onError: ((code: String, message: String) -> Unit)? = null
  var onToolApprovalRequired: ((
    conversationId: String,
    toolCallId: String,
    name: String,
    argumentsJson: String,
    riskLevel: String,
  ) -> Unit)? = null

  fun getLifecycle(): String = lifecycle

  suspend fun initialize(modelPath: String, backend: String, cacheDir: String?) {
    bridgeMutex.withLock {
      initializeLocked(modelPath, backend, cacheDir)
    }
  }

  private suspend fun initializeLocked(modelPath: String, backend: String, cacheDir: String?) {
    lastModelPath = normalizeFilesystemPath(modelPath) ?: modelPath
    lastBackend = backend
    lastCacheDir = normalizeFilesystemPath(cacheDir) ?: context.cacheDir.path

    transition("loading")
    try {
      withContext(Dispatchers.IO) {
        closeEngineLocked()
        val engineConfig =
          EngineConfig(
            modelPath = lastModelPath!!,
            backend = parseBackend(backend),
            cacheDir = lastCacheDir,
          )
        val newEngine = Engine(engineConfig)
        newEngine.initialize()
        engine = newEngine
      }
      transition("active")
    } catch (error: Exception) {
      closeEngineLocked()
      transition("error")
      onError?.invoke("ENGINE_INIT_FAILED", error.message ?: "initialize failed")
      throw error
    }
  }

  suspend fun warmUp(modelPath: String, backend: String, cacheDir: String?) {
    bridgeMutex.withLock {
      if (lifecycle == "active" || lifecycle == "idle" || lifecycle == "loading") {
        return
      }
      initializeLocked(modelPath, backend, cacheDir)
    }
  }

  suspend fun shutdown() {
    bridgeMutex.withLock {
      withContext(Dispatchers.IO) {
        closeEngineLocked()
      }
      transition("unloaded")
    }
  }

  suspend fun createConversation(
    conversationId: String,
    systemInstruction: String?,
    configJson: String? = null,
  ) {
    bridgeMutex.withLock {
      createConversationLocked(conversationId, systemInstruction, configJson)
    }
  }

  fun approveToolCall(_conversationId: String, toolCallId: String, approved: Boolean) {
    toolApprovalGate.resolve(toolCallId, approved)
  }

  fun rejectToolCall(_conversationId: String, toolCallId: String, _reason: String?) {
    toolApprovalGate.resolve(toolCallId, false)
  }

  fun abortGeneration(conversationId: String) {
    generationJobs.remove(conversationId)?.cancel()
    runCatching { conversations[conversationId]?.cancelProcess() }
    onError?.invoke("GENERATION_ABORTED", "Generation aborted")
  }

  suspend fun closeConversation(conversationId: String) {
    bridgeMutex.withLock {
      withContext(Dispatchers.IO) {
        conversations.remove(conversationId)?.close()
      }
    }
  }

  fun sendMessage(
    conversationId: String,
    text: String,
    extraContext: Map<String, Any> = emptyMap(),
  ) {
    if (lifecycle != "active" && lifecycle != "idle") {
      onError?.invoke("ENGINE_NOT_READY", "Engine lifecycle=$lifecycle")
      return
    }

    val conversation =
      conversations[conversationId]
        ?: run {
          onError?.invoke("CONVERSATION_NOT_FOUND", conversationId)
          return
        }

    val batcher =
      TokenBatcher(
        onFlush = { delta, kind ->
          onStreamDelta?.invoke(conversationId, delta, kind)
        },
      )

    val job =
      scope.launch {
        var fullResponse = ""
        try {
          conversation
            .sendMessageAsync(text, extraContext = extraContext)
            .catch { error ->
              if (error is CancellationException) {
                throw error
              }
              onError?.invoke("GENERATION_FAILED", error.message ?: "sendMessage failed")
            }
            .collect { message ->
              for ((delta, kind) in extractStreamParts(message)) {
                batcher.append(delta, kind)
                if (kind == "token") {
                  fullResponse += delta
                }
              }
            }
          batcher.flush()
          onMessageComplete?.invoke(conversationId, fullResponse)
        } catch (error: CancellationException) {
          batcher.flush()
          onError?.invoke("GENERATION_ABORTED", "Generation aborted")
        } catch (error: Exception) {
          onError?.invoke("GENERATION_FAILED", error.message ?: "sendMessage failed")
        } finally {
          generationJobs.remove(conversationId)
        }
      }
    generationJobs[conversationId] = job
  }

  suspend fun enterIdle() {
    bridgeMutex.withLock {
      if (lifecycle == "active") {
        transition("idle")
      }
    }
  }

  fun setHibernationPolicy(persistKvOnHibernate: Boolean, hibernateOnMemoryWarning: Boolean) {
    this.persistKvOnHibernate = persistKvOnHibernate
    onHibernationPolicyChanged?.invoke(hibernateOnMemoryWarning)
  }

  var onHibernationPolicyChanged: ((hibernateOnMemoryWarning: Boolean) -> Unit)? = null

  suspend fun hibernate(conversationIds: List<String>? = null) {
    bridgeMutex.withLock {
      transition("hibernating")
      withContext(Dispatchers.IO) {
        if (persistKvOnHibernate) {
          val ids =
            conversationIds?.takeIf { it.isNotEmpty() }
              ?: conversations.keys().toList()
          for (conversationId in ids) {
            runCatching { persistSessionLocked(conversationId, messageCount = 0) }
          }
        }
        closeEngineLocked()
      }
      transition("hibernated")
    }
  }

  suspend fun persistSession(conversationId: String, messageCount: Int = 0): Map<String, Any> {
    return bridgeMutex.withLock {
      persistSessionLocked(conversationId, messageCount)
    }
  }

  private fun persistSessionLocked(conversationId: String, messageCount: Int): Map<String, Any> {
    val cacheDir = lastCacheDir ?: context.cacheDir.path
    val meta =
      SessionSnapshotStore.writeMeta(
        cacheDir = cacheDir,
        conversationId = conversationId,
        messageCount = messageCount,
        usedNativeKvSerialize = false,
      )
    val snapshotPath = SessionSnapshotStore.snapshotFile(cacheDir, conversationId).path
    return mapOf(
      "conversationId" to conversationId,
      "snapshotPath" to snapshotPath,
      "snapshotBytes" to 0,
      "usedNativeKvSerialize" to meta.usedNativeKvSerialize,
    )
  }

  suspend fun restoreSession(conversationId: String): Map<String, Any> {
    val cacheDir = lastCacheDir ?: context.cacheDir.path
    val meta = SessionSnapshotStore.readMeta(cacheDir, conversationId)
    val restoredFrom = SessionSnapshotStore.restoredFrom(meta)

    transition("restoring")
    try {
      bridgeMutex.withLock {
        if (!conversations.containsKey(conversationId) && engine != null) {
          createConversationLocked(conversationId, null, null)
        }
      }
      return mapOf(
        "conversationId" to conversationId,
        "restoredFrom" to restoredFrom,
        "prefillSkippedTokens" to if (restoredFrom == "kv_snapshot") (meta?.messageCount ?: 0) else 0,
      )
    } finally {
      if (lifecycle == "restoring") {
        transition(if (engine != null) "active" else "idle")
      }
    }
  }

  suspend fun deleteSessionSnapshot(conversationId: String) {
    val cacheDir = lastCacheDir ?: context.cacheDir.path
    withContext(Dispatchers.IO) {
      SessionSnapshotStore.deleteSnapshot(cacheDir, conversationId)
    }
  }

  private suspend fun createConversationLocked(
    conversationId: String,
    systemInstruction: String?,
    configJson: String?,
  ) {
    val activeEngine = engine ?: throw IllegalStateException("ENGINE_NOT_READY")
    if (lifecycle != "active" && lifecycle != "idle") {
      throw IllegalStateException("ENGINE_NOT_READY")
    }

    val parsed = ConversationConfigJson.parse(configJson)

    withContext(Dispatchers.IO) {
      conversations.remove(conversationId)?.close()

      val tools =
        if (parsed.enableBuiltinTools) {
          listOf(
            tool(
              DeviceToolSet(
                context = context,
                conversationId = conversationId,
                approvalGate = toolApprovalGate,
                onApprovalRequired = { convId, toolCallId, name, argumentsJson, riskLevel ->
                  onToolApprovalRequired?.invoke(
                    convId,
                    toolCallId,
                    name,
                    argumentsJson,
                    riskLevel,
                  )
                },
              ),
            ),
          )
        } else {
          emptyList()
        }

      val config =
        ConversationConfig(
          systemInstruction = systemInstruction?.takeIf { it.isNotBlank() }?.let { Contents.of(it) },
          tools = tools,
          samplerConfig = parsed.sampler,
          automaticToolCalling = parsed.automaticToolCalling,
        )
      conversations[conversationId] = activeEngine.createConversation(config)
    }
  }

  private suspend fun transition(next: String) {
    val from = lifecycle
    lifecycle = next
    withContext(Dispatchers.Main) {
      onLifecycleChanged?.invoke(from, next)
    }
  }

  private fun closeEngineLocked() {
    for ((_, conversation) in conversations) {
      runCatching { conversation.close() }
    }
    conversations.clear()
    engine?.close()
    engine = null
  }

  private fun parseBackend(backend: String): Backend =
    when (backend.lowercase()) {
      "gpu" -> Backend.GPU()
      "npu" ->
        Backend.NPU(nativeLibraryDir = context.applicationInfo.nativeLibraryDir)
      else -> Backend.CPU()
    }

  private fun normalizeFilesystemPath(path: String?): String? {
    if (path.isNullOrBlank()) {
      return null
    }
    return when {
      path.startsWith("file://") -> path.removePrefix("file://")
      else -> path
    }
  }

  private fun extractStreamParts(message: Message): List<Pair<String, String>> {
    val parts = mutableListOf<Pair<String, String>>()
    for ((_, value) in message.channels) {
      if (value.isNotEmpty()) {
        parts.add(value to "thinking")
      }
    }
    val text = message.toString()
    if (text.isNotEmpty()) {
      parts.add(text to "token")
    }
    return parts
  }

  companion object {
    fun parseExtraContext(extraContextJson: String?): Map<String, Any> {
      if (extraContextJson.isNullOrBlank()) {
        return emptyMap()
      }
      val json = JsonParser.parseString(extraContextJson).asJsonObject
      val result = mutableMapOf<String, Any>()
      for ((key, value) in json.entrySet()) {
        when {
          value.isJsonPrimitive && value.asJsonPrimitive.isBoolean ->
            result[key] = value.asBoolean
          value.isJsonPrimitive && value.asJsonPrimitive.isNumber ->
            result[key] = value.asNumber
          value.isJsonPrimitive ->
            result[key] = value.asString
        }
      }
      return result
    }
  }
}
