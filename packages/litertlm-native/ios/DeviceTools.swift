import Foundation
import UIKit

enum BuiltinToolContext {
  static var conversationId: String = ""
  static var approvalGate = ToolApprovalGate()
  static var onApprovalRequired: (
    _ conversationId: String,
    _ toolCallId: String,
    _ name: String,
    _ argumentsJson: String,
    _ riskLevel: String
  ) -> Void = { _, _, _, _, _ in }

  static func configure(
    conversationId: String,
    approvalGate: ToolApprovalGate,
    onApprovalRequired: @escaping (
      _ conversationId: String,
      _ toolCallId: String,
      _ name: String,
      _ argumentsJson: String,
      _ riskLevel: String
    ) -> Void
  ) {
    Self.conversationId = conversationId
    Self.approvalGate = approvalGate
    Self.onApprovalRequired = onApprovalRequired
  }

  static func builtinTools() -> [Tool] {
    [GetCurrentTimeTool(), GetDeviceInfoTool(), OpenUrlTool()]
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
    [
      "platform": "ios",
      "modelName": UIDevice.current.model,
      "osVersion": UIDevice.current.systemVersion,
      "isDevice": !isSimulator(),
    ] as [String: Any]
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
