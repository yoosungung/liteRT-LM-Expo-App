import Foundation
import os

/// Phase 1 — LiteRT-LM Engine wrapper + InferenceStateBridge skeleton (iOS parity with Android).
final class EngineBridge {
  private var lifecycle = "unloaded"
  private var engine: Engine?
  private var conversations: [String: Conversation] = [:]
  private var generationTasks: [String: Task<Void, Never>] = [:]
  private let toolApprovalGate = ToolApprovalGate()
  private var lastModelPath: String?
  private var lastBackend = "cpu"
  private var lastCacheDir: String?
  private var persistKvOnHibernate = true
  var onHibernationPolicyChanged: ((Bool) -> Void)?
  private let stateLock = OSAllocatedUnfairLock()

  var onLifecycleChanged: ((String, String) -> Void)?
  var onStreamDelta: ((String, String, String) -> Void)?
  var onMessageComplete: ((String, String) -> Void)?
  var onError: ((String, String) -> Void)?
  var onToolApprovalRequired: ((
    _ conversationId: String,
    _ toolCallId: String,
    _ name: String,
    _ argumentsJson: String,
    _ riskLevel: String
  ) -> Void)?

  func getLifecycle() -> String {
    lifecycle
  }

  func initialize(modelPath: String, backend: String, cacheDir: String?) async throws {
    let normalizedPath = try Self.normalizeRequiredPath(modelPath)
    let normalizedCache = Self.normalizeOptionalPath(cacheDir) ?? Self.defaultCacheDir()

    lastModelPath = normalizedPath
    lastBackend = backend
    lastCacheDir = normalizedCache

    transition("loading")
    do {
      await closeEngineLocked()
      try Self.validateModelFile(at: normalizedPath)

      let parsedBackend = Self.parseBackend(backend)
      let newEngine = try await Self.createEngineOnBackground(
        modelPath: normalizedPath,
        backend: parsedBackend,
        cacheDir: normalizedCache
      )

      withStateLock {
        engine = newEngine
      }
      transition("active")
    } catch {
      await closeEngineLocked()
      transition("error")
      let message = Self.describeInitFailure(error, modelPath: normalizedPath, backend: backend)
      onError?("ENGINE_INIT_FAILED", message)
      throw NSError(
        domain: "LitertlmNative",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: message]
      )
    }
  }

  func warmUp(modelPath: String, backend: String, cacheDir: String?) async throws {
    if lifecycle == "active" || lifecycle == "idle" || lifecycle == "loading" {
      return
    }
    try await initialize(modelPath: modelPath, backend: backend, cacheDir: cacheDir)
  }

  func shutdown() async {
    await closeEngineLocked()
    transition("unloaded")
  }

  func createConversation(
    conversationId: String,
    systemInstruction: String?,
    configJson: String? = nil
  ) async throws {
    let activeEngine = withStateLock { engine }

    guard let activeEngine else {
      throw NSError(
        domain: "LitertlmNative",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "ENGINE_NOT_READY"]
      )
    }
    if lifecycle != "active" && lifecycle != "idle" {
      throw NSError(
        domain: "LitertlmNative",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "ENGINE_NOT_READY"]
      )
    }

    let parsed = ConversationConfigJson.parse(configJson)
    var config = ConversationConfig()
    if let instruction = systemInstruction?.trimmingCharacters(in: .whitespacesAndNewlines),
       !instruction.isEmpty
    {
      config = ConversationConfig(systemMessage: Message(instruction, role: .system))
    }

    if parsed.enableBuiltinTools {
      BuiltinToolContext.configure(
        conversationId: conversationId,
        approvalGate: toolApprovalGate,
        onApprovalRequired: { [weak self] convId, toolCallId, name, argumentsJson, riskLevel in
          self?.onToolApprovalRequired?(convId, toolCallId, name, argumentsJson, riskLevel)
        }
      )
      config = ConversationConfig(
        systemMessage: config.systemMessage,
        initialMessages: config.initialMessages,
        tools: BuiltinToolContext.builtinTools(),
        samplerConfig: parsed.sampler
      )
    } else if let sampler = parsed.sampler {
      config = ConversationConfig(
        systemMessage: config.systemMessage,
        initialMessages: config.initialMessages,
        tools: config.tools,
        samplerConfig: sampler
      )
    }

    let conversation = try await activeEngine.createConversation(with: config)
    withStateLock {
      conversations[conversationId] = conversation
    }
  }

  func approveToolCall(conversationId: String, toolCallId: String, approved: Bool) {
    toolApprovalGate.resolve(toolCallId: toolCallId, approved: approved)
  }

  func rejectToolCall(conversationId: String, toolCallId: String, reason: String?) {
    toolApprovalGate.resolve(toolCallId: toolCallId, approved: false)
  }

  func abortGeneration(conversationId: String) {
    generationTasks.removeValue(forKey: conversationId)?.cancel()
    if let conversation = withStateLock({ conversations[conversationId] }) {
      try? conversation.cancel()
    }
    onError?("GENERATION_ABORTED", "Generation aborted")
  }

  func closeConversation(conversationId: String) async {
    withStateLock {
      _ = conversations.removeValue(forKey: conversationId)
    }
  }

  func sendMessage(
    conversationId: String,
    text: String,
    extraContext: [String: Any] = [:]
  ) {
    if lifecycle != "active" && lifecycle != "idle" {
      onError?("ENGINE_NOT_READY", "Engine lifecycle=\(lifecycle)")
      return
    }

    let conversation = withStateLock { conversations[conversationId] }

    guard let conversation else {
      onError?("CONVERSATION_NOT_FOUND", conversationId)
      return
    }

    let batcher = TokenBatcher { [weak self] delta, kind in
      self?.onStreamDelta?(conversationId, delta, kind)
    }

    let task = Task {
      var fullResponse = ""
      do {
        for try await chunk in conversation.sendMessageStream(Message(text), extraContext: extraContext) {
          if Task.isCancelled {
            throw CancellationError()
          }
          for (_, value) in chunk.channels where !value.isEmpty {
            batcher.append(value, kind: "thinking")
          }
          let tokenText = chunk.toString
          if !tokenText.isEmpty {
            batcher.append(tokenText, kind: "token")
            fullResponse += tokenText
          }
        }
        batcher.flush()
        onMessageComplete?(conversationId, fullResponse)
      } catch is CancellationError {
        batcher.flush()
        onError?("GENERATION_ABORTED", "Generation aborted")
      } catch {
        onError?("GENERATION_FAILED", error.localizedDescription)
      }
      generationTasks.removeValue(forKey: conversationId)
    }
    generationTasks[conversationId] = task
  }

  func enterIdle() {
    if lifecycle == "active" {
      transition("idle")
    }
  }

  func setHibernationPolicy(persistKvOnHibernate: Bool, hibernateOnMemoryWarning: Bool) {
    self.persistKvOnHibernate = persistKvOnHibernate
    onHibernationPolicyChanged?(hibernateOnMemoryWarning)
  }

  func hibernate(conversationIds: [String]? = nil) async {
    transition("hibernating")
    if persistKvOnHibernate {
      let ids: [String]
      if let conversationIds, !conversationIds.isEmpty {
        ids = conversationIds
      } else {
        ids = withStateLock { Array(conversations.keys) }
      }
      for conversationId in ids {
        _ = persistSession(conversationId: conversationId, messageCount: 0)
      }
    }
    await closeEngineLocked()
    transition("hibernated")
  }

  func persistSession(conversationId: String, messageCount: Int = 0) -> [String: Any] {
    let cacheDir = lastCacheDir ?? Self.defaultCacheDir()
    let meta =
      (try? SessionSnapshotStore.writeMeta(
        cacheDir: cacheDir,
        conversationId: conversationId,
        messageCount: messageCount,
        usedNativeKvSerialize: false
      ))
    let snapshotPath = SessionSnapshotStore.snapshotFile(cacheDir: cacheDir, conversationId: conversationId).path
    return [
      "conversationId": conversationId,
      "snapshotPath": snapshotPath,
      "snapshotBytes": 0,
      "usedNativeKvSerialize": meta?.usedNativeKvSerialize ?? false,
    ]
  }

  func restoreSession(conversationId: String) async throws -> [String: Any] {
    let cacheDir = lastCacheDir ?? Self.defaultCacheDir()
    let meta = SessionSnapshotStore.readMeta(cacheDir: cacheDir, conversationId: conversationId)
    let restoredFrom = SessionSnapshotStore.restoredFrom(meta)

    transition("restoring")
    defer {
      if lifecycle == "restoring" {
        transition(engine != nil ? "active" : "idle")
      }
    }

    let hasConversation = withStateLock { conversations[conversationId] != nil }
    let hasEngine = withStateLock { engine != nil }

    if !hasConversation && hasEngine {
      try await createConversation(conversationId: conversationId, systemInstruction: nil, configJson: nil)
    }
    return [
      "conversationId": conversationId,
      "restoredFrom": restoredFrom,
      "prefillSkippedTokens": restoredFrom == "kv_snapshot" ? (meta?.messageCount ?? 0) : 0,
    ]
  }

  func deleteSessionSnapshot(conversationId: String) {
    let cacheDir = lastCacheDir ?? Self.defaultCacheDir()
    SessionSnapshotStore.deleteSnapshot(cacheDir: cacheDir, conversationId: conversationId)
  }

  private func transition(_ next: String) {
    let from = lifecycle
    lifecycle = next
    DispatchQueue.main.async { [weak self] in
      self?.onLifecycleChanged?(from, next)
    }
  }

  private func closeEngineLocked() async {
    let hadEngine = withStateLock { () -> Bool in
      let hadEngine = engine != nil
      conversations.removeAll()
      engine = nil
      return hadEngine
    }

    // Let the Engine actor deinit and release native handles before re-create.
    if hadEngine {
      try? await Task.sleep(nanoseconds: 150_000_000)
    }
  }

  private func withStateLock<T>(_ body: () -> T) -> T {
    stateLock.withLock(body)
  }

  private static func createEngineOnBackground(
    modelPath: String,
    backend: Backend,
    cacheDir: String
  ) async throws -> Engine {
    try await Task.detached(priority: .userInitiated) {
      let engineConfig = try EngineConfig(
        modelPath: modelPath,
        backend: backend,
        cacheDir: cacheDir
      )
      let newEngine = Engine(engineConfig: engineConfig)
      try await newEngine.initialize()
      return newEngine
    }.value
  }

  private static func validateModelFile(at path: String) throws {
    var isDirectory: ObjCBool = false
    guard FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory) else {
      throw NSError(
        domain: "LitertlmNative",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "MODEL_NOT_FOUND: \(path)"]
      )
    }
    if isDirectory.boolValue {
      throw NSError(
        domain: "LitertlmNative",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "MODEL_NOT_FOUND: path is a directory: \(path)"]
      )
    }

    let size = (try? FileManager.default.attributesOfItem(atPath: path)[.size] as? NSNumber)?
      .int64Value ?? 0
    if size <= 0 {
      throw NSError(
        domain: "LitertlmNative",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "MODEL_NOT_FOUND: model file is empty"]
      )
    }
  }

  private static func describeInitFailure(_ error: Error, modelPath: String, backend: String) -> String {
    let base = (error as NSError).userInfo[NSLocalizedDescriptionKey] as? String
      ?? error.localizedDescription
    if base.contains("MODEL_NOT_FOUND") {
      return base
    }
    if base.contains("Failed to create engine") {
      return """
        \(base) (backend=\(backend)). \
        Check model path and free memory. Path: \(modelPath)
        """
    }
    return base
  }

  private static func defaultCacheDir() -> String {
    FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?.path
      ?? NSTemporaryDirectory()
  }

  private static func parseBackend(_ backend: String) -> Backend {
    switch backend.lowercased() {
    case "gpu":
      return .gpu
    default:
      return .cpu()
    }
  }

  private static func normalizeRequiredPath(_ path: String) throws -> String {
    let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      throw NSError(
        domain: "LitertlmNative",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "MODEL_NOT_FOUND: modelPath is empty"]
      )
    }
    return normalizeOptionalPath(trimmed) ?? trimmed
  }

  private static func normalizeOptionalPath(_ path: String?) -> String? {
    guard let path, !path.isEmpty else {
      return nil
    }
    if path.hasPrefix("file://") {
      return URL(string: path)?.path ?? String(path.dropFirst("file://".count))
    }
    return path
  }

  static func parseExtraContext(_ extraContextJson: String?) -> [String: Any] {
    guard let extraContextJson, !extraContextJson.isEmpty,
          let data = extraContextJson.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      return [:]
    }
    return json
  }
}
