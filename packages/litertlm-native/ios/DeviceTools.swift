import Foundation
import UIKit

enum BuiltinToolContext {
  static var conversationId: String = ""
  static var approvalGate = ToolApprovalGate()
  static var runJsGate = RunJsGate()
  static var onApprovalRequired: (
    _ conversationId: String,
    _ toolCallId: String,
    _ name: String,
    _ argumentsJson: String,
    _ riskLevel: String
  ) -> Void = { _, _, _, _, _ in }
  static var onRunJsRequired: (
    _ conversationId: String,
    _ toolCallId: String,
    _ argumentsJson: String
  ) -> Void = { _, _, _ in }

  static func configure(
    conversationId: String,
    approvalGate: ToolApprovalGate,
    runJsGate: RunJsGate,
    onApprovalRequired: @escaping (
      _ conversationId: String,
      _ toolCallId: String,
      _ name: String,
      _ argumentsJson: String,
      _ riskLevel: String
    ) -> Void,
    onRunJsRequired: @escaping (
      _ conversationId: String,
      _ toolCallId: String,
      _ argumentsJson: String
    ) -> Void
  ) {
    Self.conversationId = conversationId
    Self.approvalGate = approvalGate
    Self.runJsGate = runJsGate
    Self.onApprovalRequired = onApprovalRequired
    Self.onRunJsRequired = onRunJsRequired
  }

  static func builtinTools() -> [Tool] {
    [
      GetCurrentTimeTool(),
      GetDeviceInfoTool(),
      OpenUrlTool(),
      RunJsTool(),
      ShareTextTool(),
      CopyToClipboardTool(),
      ReadClipboardTool(),
    ]
  }
}

struct GetCurrentTimeTool: Tool {
  static let name = "getCurrentTime"
  static let description = "Get the current local time as an ISO-8601 string."

  init() {}

  func run() async throws -> Any {
    ["iso": ISO8601DateFormatter().string(from: Date())]
  }
}

struct GetDeviceInfoTool: Tool {
  static let name = "getDeviceInfo"
  static let description = "Get basic device info (platform, model, OS version)."

  init() {}

  func run() async throws -> Any {
    await MainActor.run {
      [
        "platform": "ios",
        "modelName": UIDevice.current.model,
        "osVersion": UIDevice.current.systemVersion,
        "isDevice": !isSimulator(),
      ] as [String: Any]
    }
  }

  private func isSimulator() -> Bool {
    #if targetEnvironment(simulator)
      return true
    #else
      return false
    #endif
  }
}

struct OpenUrlTool: Tool {
  static let name = "openUrl"
  static let description = "Open a URL in the system browser."

  @ToolParam(description: "HTTPS URL to open")
  var url: String

  init() {
    self.url = ""
  }

  func run() async throws -> Any {
    let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://") else {
      return ["opened": false, "url": trimmed, "error": "Only http(s) URLs are supported"]
    }

    let conversationId = BuiltinToolContext.conversationId
    let toolCallId = "\(conversationId)-tool-openUrl-\(Int(Date().timeIntervalSince1970 * 1000))"
    let argsData = try JSONSerialization.data(withJSONObject: ["url": trimmed], options: [])
    let argumentsJson = String(data: argsData, encoding: .utf8) ?? "{}"

    let approved = await BuiltinToolContext.approvalGate.awaitApproval(toolCallId: toolCallId) {
      BuiltinToolContext.onApprovalRequired(
        conversationId, toolCallId, Self.name, argumentsJson, "destructive"
      )
    }

    if !approved {
      return ["opened": false, "url": trimmed, "error": "User denied"]
    }

    guard let openURL = URL(string: trimmed) else {
      return ["opened": false, "url": trimmed, "error": "Invalid URL"]
    }

    let canOpen = await MainActor.run {
      UIApplication.shared.canOpenURL(openURL)
    }
    if !canOpen {
      return ["opened": false, "url": trimmed, "error": "URL cannot be opened"]
    }

    await MainActor.run {
      UIApplication.shared.open(openURL)
    }
    return ["opened": true, "url": trimmed]
  }
}

struct RunJsTool: Tool {
  static let name = "run_js"
  static let description =
    "Execute the active JavaScript skill in a sandboxed WebView. Pass stringified JSON in `data` per the skill SKILL.md schema."

  @ToolParam(description: "Stringified JSON parameters for window.ai_edge_gallery_get_result")
  var data: String

  @ToolParam(description: "Skill script entrypoint, typically index.html")
  var scriptName: String

  @ToolParam(description: "Optional skill id override when multiple JS skills are installed")
  var skillName: String

  init() {
    self.data = ""
    self.scriptName = ""
    self.skillName = ""
  }

  func run() async throws -> Any {
    let conversationId = BuiltinToolContext.conversationId
    let toolCallId = "\(conversationId)-tool-runJs-\(Int(Date().timeIntervalSince1970 * 1000))"
    var args: [String: Any] = ["data": data]
    if !scriptName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      args["scriptName"] = scriptName
    }
    if !skillName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      args["skillName"] = skillName
    }
    let argumentsJson =
      String(data: try JSONSerialization.data(withJSONObject: args), encoding: .utf8) ?? "{}"

    let resultJson = await BuiltinToolContext.runJsGate.awaitResult(toolCallId: toolCallId) {
      BuiltinToolContext.onRunJsRequired(conversationId, toolCallId, argumentsJson)
    }

    if let jsonData = resultJson.data(using: String.Encoding.utf8),
       let obj = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any]
    {
      return obj
    }
    return ["raw": resultJson]
  }
}

struct ShareTextTool: Tool {
  static let name = "shareText"
  static let description = "Share plain text via the system share sheet."

  @ToolParam(description: "Text to share")
  var text: String

  @ToolParam(description: "Optional share dialog title")
  var title: String

  init() {
    self.text = ""
    self.title = ""
  }

  func run() async throws -> Any {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      return ["shared": false, "error": "Text is required"]
    }

    let conversationId = BuiltinToolContext.conversationId
    let toolCallId = "\(conversationId)-tool-shareText-\(Int(Date().timeIntervalSince1970 * 1000))"
    var args: [String: Any] = ["text": trimmed]
    if !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      args["title"] = title
    }
    let argumentsJson =
      String(data: try JSONSerialization.data(withJSONObject: args), encoding: .utf8) ?? "{}"

    let approved = await BuiltinToolContext.approvalGate.awaitApproval(toolCallId: toolCallId) {
      BuiltinToolContext.onApprovalRequired(
        conversationId, toolCallId, Self.name, argumentsJson, "destructive"
      )
    }

    if !approved {
      return ["shared": false, "error": "User denied"]
    }

    await MainActor.run {
      let activityVC = UIActivityViewController(activityItems: [trimmed], applicationActivities: nil)
      guard
        let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
        let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
      else {
        return
      }
      var presenter = root
      while let presented = presenter.presentedViewController {
        presenter = presented
      }
      presenter.present(activityVC, animated: true)
    }

    return ["shared": true]
  }
}

struct CopyToClipboardTool: Tool {
  static let name = "copyToClipboard"
  static let description = "Copy plain text to the system clipboard."

  @ToolParam(description: "Text to copy")
  var text: String

  init() {
    self.text = ""
  }

  func run() async throws -> Any {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      return ["copied": false, "error": "Text is required"]
    }

    let conversationId = BuiltinToolContext.conversationId
    let toolCallId = "\(conversationId)-tool-copyToClipboard-\(Int(Date().timeIntervalSince1970 * 1000))"
    let argumentsJson =
      String(
        data: try JSONSerialization.data(withJSONObject: ["text": trimmed]),
        encoding: .utf8
      ) ?? "{}"

    let approved = await BuiltinToolContext.approvalGate.awaitApproval(toolCallId: toolCallId) {
      BuiltinToolContext.onApprovalRequired(
        conversationId, toolCallId, Self.name, argumentsJson, "write"
      )
    }

    if !approved {
      return ["copied": false, "error": "User denied"]
    }

    await MainActor.run {
      UIPasteboard.general.string = trimmed
    }
    return ["copied": true]
  }
}

struct ReadClipboardTool: Tool {
  static let name = "readClipboard"
  static let description = "Read plain text from the system clipboard."

  init() {}

  func run() async throws -> Any {
    let value = await MainActor.run {
      UIPasteboard.general.string ?? ""
    }
    return ["text": value]
  }
}

enum ConversationConfigJson {
  struct Parsed {
    var automaticToolCalling: Bool = true
    var enableBuiltinTools: Bool = true
    var sampler: SamplerConfig? = nil
  }

  static func parse(_ configJson: String?) -> Parsed {
    guard let configJson,
          let data = configJson.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      return Parsed()
    }

    var parsed = Parsed()
    if let automatic = json["automaticToolCalling"] as? Bool {
      parsed.automaticToolCalling = automatic
    }
    if let builtin = json["enableBuiltinTools"] as? Bool {
      parsed.enableBuiltinTools = builtin
    }
    if let sampler = json["sampler"] as? [String: Any] {
      let topK = sampler["topK"] as? Int ?? 40
      let topP = (sampler["topP"] as? NSNumber)?.floatValue ?? 0.95
      let temperature = (sampler["temperature"] as? NSNumber)?.floatValue ?? 0.8
      parsed.sampler = try? SamplerConfig(topK: topK, topP: topP, temperature: temperature)
    }
    return parsed
  }
}
