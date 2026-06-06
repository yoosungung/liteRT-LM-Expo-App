import ExpoModulesCore

public class LitertlmNativeModule: Module {
  private lazy var memoryPressureHandler = MemoryPressureHandler()

  private lazy var engineBridge: EngineBridge = {
    let bridge = EngineBridge()
    bridge.onLifecycleChanged = { [weak self] from, to in
      self?.sendEvent("onInferenceLifecycleChanged", ["from": from, "to": to])
      self?.sendEvent("onEngineStatusChanged", ["lifecycle": to])
    }
    bridge.onHibernationPolicyChanged = { [weak self] enabled in
      self?.memoryPressureHandler.setHibernateOnMemoryWarning(enabled)
    }
    bridge.onStreamDelta = { [weak self] conversationId, delta, kind in
      self?.sendEvent(
        "onStreamDelta",
        ["conversationId": conversationId, "delta": delta, "kind": kind]
      )
    }
    bridge.onMessageComplete = { [weak self] conversationId, content in
      self?.sendEvent(
        "onMessageComplete",
        [
          "conversationId": conversationId,
          "message": [
            "id": "\(conversationId)-\(Int(Date().timeIntervalSince1970 * 1000))",
            "role": "assistant",
            "content": content,
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
          ],
        ]
      )
    }
    bridge.onError = { [weak self] code, message in
      self?.sendEvent("onError", ["code": code, "message": message])
    }
    bridge.onToolApprovalRequired = { [weak self] conversationId, toolCallId, name, argumentsJson, riskLevel in
      self?.sendEvent(
        "onToolApprovalRequired",
        [
          "conversationId": conversationId,
          "toolCall": [
            "id": toolCallId,
            "name": name,
            "argumentsJson": argumentsJson,
          ],
          "riskLevel": riskLevel,
        ]
      )
    }
    bridge.onRunJsRequired = { [weak self] conversationId, toolCallId, argumentsJson in
      self?.sendEvent(
        "onRunJsRequired",
        [
          "conversationId": conversationId,
          "toolCallId": toolCallId,
          "argumentsJson": argumentsJson,
        ]
      )
    }
    return bridge
  }()

  public func definition() -> ModuleDefinition {
    Name("LitertlmNative")

    OnCreate {
      self.memoryPressureHandler.register { [weak self] in
        Task {
          await self?.engineBridge.hibernate()
        }
      }
    }

    Events(
      "onEngineStatusChanged",
      "onInferenceLifecycleChanged",
      "onStreamDelta",
      "onMessageComplete",
      "onToolApprovalRequired",
      "onRunJsRequired",
      "onError",
      "onSha256VerifyProgress"
    )

    Function("getNativeModuleVersion") {
      "0.2.0-phase2-tools"
    }

    Function("getLifecycle") {
      self.engineBridge.getLifecycle()
    }

    AsyncFunction("initialize") { (modelPath: String, backend: String, cacheDir: String?) in
      try await self.engineBridge.initialize(
        modelPath: modelPath,
        backend: backend,
        cacheDir: cacheDir
      )
    }

    AsyncFunction("warmUp") { (modelPath: String, backend: String, cacheDir: String?) in
      try await self.engineBridge.warmUp(
        modelPath: modelPath,
        backend: backend,
        cacheDir: cacheDir
      )
    }

    AsyncFunction("shutdown") {
      await self.engineBridge.shutdown()
    }

    AsyncFunction("createConversation") {
      (conversationId: String, systemInstruction: String?, configJson: String?) in
      try await self.engineBridge.createConversation(
        conversationId: conversationId,
        systemInstruction: systemInstruction,
        configJson: configJson
      )
    }

    AsyncFunction("approveToolCall") {
      (conversationId: String, toolCallId: String, approved: Bool) in
      self.engineBridge.approveToolCall(
        conversationId: conversationId,
        toolCallId: toolCallId,
        approved: approved
      )
    }

    AsyncFunction("completeRunJs") { (toolCallId: String, resultJson: String) in
      self.engineBridge.completeRunJs(toolCallId: toolCallId, resultJson: resultJson)
    }

    AsyncFunction("rejectToolCall") { (conversationId: String, toolCallId: String, reason: String?) in
      self.engineBridge.rejectToolCall(
        conversationId: conversationId,
        toolCallId: toolCallId,
        reason: reason
      )
    }

    AsyncFunction("closeConversation") { (conversationId: String) in
      await self.engineBridge.closeConversation(conversationId: conversationId)
    }

    AsyncFunction("sendMessage") {
      (conversationId: String, text: String, extraContextJson: String?) in
      let extraContext = EngineBridge.parseExtraContext(extraContextJson)
      self.engineBridge.sendMessage(
        conversationId: conversationId,
        text: text,
        extraContext: extraContext
      )
    }

    AsyncFunction("abortGeneration") { (conversationId: String) in
      self.engineBridge.abortGeneration(conversationId: conversationId)
    }

    AsyncFunction("enterIdle") {
      self.engineBridge.enterIdle()
    }

    AsyncFunction("hibernate") { (conversationIds: [String]?) in
      await self.engineBridge.hibernate(conversationIds: conversationIds)
    }

    Function("setHibernationPolicy") {
      (persistKvOnHibernate: Bool, hibernateOnMemoryWarning: Bool) in
      self.engineBridge.setHibernationPolicy(
        persistKvOnHibernate: persistKvOnHibernate,
        hibernateOnMemoryWarning: hibernateOnMemoryWarning
      )
    }

    AsyncFunction("persistSession") {
      (conversationId: String, messageCount: Int?) -> [String: Any] in
      self.engineBridge.persistSession(
        conversationId: conversationId,
        messageCount: messageCount ?? 0
      )
    }

    AsyncFunction("restoreSession") { (conversationId: String) -> [String: Any] in
      try await self.engineBridge.restoreSession(conversationId: conversationId)
    }

    AsyncFunction("deleteSessionSnapshot") { (conversationId: String) in
      self.engineBridge.deleteSessionSnapshot(conversationId: conversationId)
    }

    AsyncFunction("verifyFileSha256") { (filePath: String, expectedSha256: String) -> [String: Any?] in
      await withCheckedContinuation { (continuation: CheckedContinuation<[String: Any?], Never>) in
        DispatchQueue.global(qos: .utility).async { [weak self] in
          let result = Sha256Verifier.verify(
            filePath: filePath,
            expectedSha256: expectedSha256
          ) { bytesHashed, totalBytes in
            DispatchQueue.main.async {
              self?.sendEvent(
                "onSha256VerifyProgress",
                ["bytesHashed": bytesHashed, "totalBytes": totalBytes]
              )
            }
          }
          continuation.resume(
            returning: [
              "ok": result.ok,
              "digest": result.digest,
              "error": result.error,
            ] as [String: Any?]
          )
        }
      }
    }
  }
}
