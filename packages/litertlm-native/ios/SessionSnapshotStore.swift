import Foundation

/// Phase 2 S4 — KV snapshot metadata (native serialize unavailable → message replay fallback).
enum SessionSnapshotStore {
  struct SnapshotMeta {
    let conversationId: String
    let usedNativeKvSerialize: Bool
    let messageCount: Int
    let updatedAt: TimeInterval
  }

  private static let metaSuffix = ".kvsnapshot.meta.json"
  private static let snapshotSuffix = ".kvsnapshot"

  static func inferenceDir(cacheDir: String) -> URL {
    URL(fileURLWithPath: cacheDir).appendingPathComponent("inference", isDirectory: true)
  }

  static func metaFile(cacheDir: String, conversationId: String) -> URL {
    inferenceDir(cacheDir: cacheDir).appendingPathComponent("\(conversationId)\(metaSuffix)")
  }

  static func snapshotFile(cacheDir: String, conversationId: String) -> URL {
    inferenceDir(cacheDir: cacheDir).appendingPathComponent("\(conversationId)\(snapshotSuffix)")
  }

  static func writeMeta(
    cacheDir: String,
    conversationId: String,
    messageCount: Int,
    usedNativeKvSerialize: Bool = false
  ) throws -> SnapshotMeta {
    let dir = inferenceDir(cacheDir: cacheDir)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let meta = SnapshotMeta(
      conversationId: conversationId,
      usedNativeKvSerialize: usedNativeKvSerialize,
      messageCount: messageCount,
      updatedAt: Date().timeIntervalSince1970 * 1000
    )
    let payload: [String: Any] = [
      "version": 1,
      "conversationId": meta.conversationId,
      "usedNativeKvSerialize": meta.usedNativeKvSerialize,
      "messageCount": meta.messageCount,
      "updatedAt": Int(meta.updatedAt),
    ]
    let data = try JSONSerialization.data(withJSONObject: payload)
    try data.write(to: metaFile(cacheDir: cacheDir, conversationId: conversationId))
    try Data().write(to: snapshotFile(cacheDir: cacheDir, conversationId: conversationId))
    return meta
  }

  static func readMeta(cacheDir: String, conversationId: String) -> SnapshotMeta? {
    let url = metaFile(cacheDir: cacheDir, conversationId: conversationId)
    guard let data = try? Data(contentsOf: url),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let id = json["conversationId"] as? String
    else {
      return nil
    }
    return SnapshotMeta(
      conversationId: id,
      usedNativeKvSerialize: json["usedNativeKvSerialize"] as? Bool ?? false,
      messageCount: json["messageCount"] as? Int ?? 0,
      updatedAt: TimeInterval(json["updatedAt"] as? Int ?? 0)
    )
  }

  static func hasSnapshot(cacheDir: String, conversationId: String) -> Bool {
    FileManager.default.fileExists(atPath: metaFile(cacheDir: cacheDir, conversationId: conversationId).path)
  }

  static func deleteSnapshot(cacheDir: String, conversationId: String) {
    try? FileManager.default.removeItem(at: metaFile(cacheDir: cacheDir, conversationId: conversationId))
    try? FileManager.default.removeItem(at: snapshotFile(cacheDir: cacheDir, conversationId: conversationId))
  }

  static func restoredFrom(_ meta: SnapshotMeta?) -> String {
    guard let meta else {
      return "empty"
    }
    if meta.usedNativeKvSerialize {
      return "kv_snapshot"
    }
    if meta.messageCount > 0 {
      return "message_replay"
    }
    return "empty"
  }
}
