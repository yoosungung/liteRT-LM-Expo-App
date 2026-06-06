package expo.modules.litertlmnative

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext

class LitertlmNativeModule : Module() {
  private val engineBridge: EngineBridge by lazy {
    EngineBridge(appContext.reactContext!!.applicationContext).apply {
      onLifecycleChanged = { from, to ->
        sendEvent("onInferenceLifecycleChanged", mapOf("from" to from, "to" to to))
        sendEvent("onEngineStatusChanged", mapOf("lifecycle" to to))
      }
      onHibernationPolicyChanged = { enabled ->
        memoryPressureHandler.setHibernateOnMemoryWarning(enabled)
      }
      onStreamDelta = { conversationId, delta, kind ->
        sendEvent(
          "onStreamDelta",
          mapOf("conversationId" to conversationId, "delta" to delta, "kind" to kind),
        )
      }
      onMessageComplete = { conversationId, content ->
        sendEvent(
          "onMessageComplete",
          mapOf(
            "conversationId" to conversationId,
            "message" to mapOf(
              "id" to "$conversationId-${System.currentTimeMillis()}",
              "role" to "assistant",
              "content" to content,
              "timestamp" to System.currentTimeMillis(),
            ),
          ),
        )
      }
      onError = { code, message ->
        sendEvent("onError", mapOf("code" to code, "message" to message))
      }
      onToolApprovalRequired = { conversationId, toolCallId, name, argumentsJson, riskLevel ->
        sendEvent(
          "onToolApprovalRequired",
          mapOf(
            "conversationId" to conversationId,
            "toolCall" to mapOf(
              "id" to toolCallId,
              "name" to name,
              "argumentsJson" to argumentsJson,
            ),
            "riskLevel" to riskLevel,
          ),
        )
      }
    }
  }

  private val memoryPressureHandler: MemoryPressureHandler by lazy {
    MemoryPressureHandler(appContext.reactContext!!.applicationContext) {
      engineBridge.hibernate()
    }.also { it.register() }
  }

  override fun definition() = ModuleDefinition {
    Name("LitertlmNative")

    Events(
      "onEngineStatusChanged",
      "onInferenceLifecycleChanged",
      "onStreamDelta",
      "onMessageComplete",
      "onToolApprovalRequired",
      "onError",
      "onSha256VerifyProgress",
    )

    Function("getNativeModuleVersion") {
      "0.2.0-phase2-tools"
    }

    Function("getLifecycle") {
      engineBridge.getLifecycle()
    }

    AsyncFunction("initialize") { modelPath: String, backend: String, cacheDir: String? ->
      runBlocking { engineBridge.initialize(modelPath, backend, cacheDir) }
    }

    AsyncFunction("warmUp") { modelPath: String, backend: String, cacheDir: String? ->
      runBlocking { engineBridge.warmUp(modelPath, backend, cacheDir) }
    }

    AsyncFunction("shutdown") {
      runBlocking { engineBridge.shutdown() }
    }

    AsyncFunction("createConversation") {
      conversationId: String,
      systemInstruction: String?,
      configJson: String?,
      ->
      runBlocking { engineBridge.createConversation(conversationId, systemInstruction, configJson) }
    }

    AsyncFunction("approveToolCall") {
      conversationId: String,
      toolCallId: String,
      approved: Boolean,
      ->
      engineBridge.approveToolCall(conversationId, toolCallId, approved)
    }

    AsyncFunction("rejectToolCall") { conversationId: String, toolCallId: String, reason: String? ->
      engineBridge.rejectToolCall(conversationId, toolCallId, reason)
    }

    AsyncFunction("closeConversation") { conversationId: String ->
      runBlocking { engineBridge.closeConversation(conversationId) }
    }

    AsyncFunction("sendMessage") { conversationId: String, text: String, extraContextJson: String? ->
      val extraContext = EngineBridge.parseExtraContext(extraContextJson)
      engineBridge.sendMessage(conversationId, text, extraContext)
    }

    AsyncFunction("abortGeneration") { conversationId: String ->
      engineBridge.abortGeneration(conversationId)
    }

    AsyncFunction("enterIdle") {
      runBlocking { engineBridge.enterIdle() }
    }

    AsyncFunction("hibernate") { conversationIds: List<String>? ->
      runBlocking { engineBridge.hibernate(conversationIds) }
    }

    Function("setHibernationPolicy") {
      persistKvOnHibernate: Boolean,
      hibernateOnMemoryWarning: Boolean,
      ->
      memoryPressureHandler.register()
      engineBridge.setHibernationPolicy(persistKvOnHibernate, hibernateOnMemoryWarning)
    }

    AsyncFunction("persistSession") { conversationId: String, messageCount: Int? ->
      runBlocking { engineBridge.persistSession(conversationId, messageCount ?: 0) }
    }

    AsyncFunction("restoreSession") { conversationId: String ->
      runBlocking { engineBridge.restoreSession(conversationId) }
    }

    AsyncFunction("deleteSessionSnapshot") { conversationId: String ->
      runBlocking { engineBridge.deleteSessionSnapshot(conversationId) }
    }

    AsyncFunction("verifyFileSha256") { filePath: String, expectedSha256: String ->
      runBlocking {
        withContext(Dispatchers.IO) {
          val result =
            Sha256Verifier.verify(filePath, expectedSha256) { bytesHashed, totalBytes ->
              sendEvent(
                "onSha256VerifyProgress",
                mapOf(
                  "bytesHashed" to bytesHashed,
                  "totalBytes" to totalBytes,
                ),
              )
            }
          mapOf(
            "ok" to result.ok,
            "digest" to result.digest,
            "error" to result.error,
          )
        }
      }
    }
  }
}
