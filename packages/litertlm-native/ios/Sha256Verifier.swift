import CryptoKit
import Foundation

enum Sha256Verifier {
  private static let chunkSize = 4 * 1024 * 1024
  private static let progressIntervalMs: UInt64 = 100

  struct VerifyResult {
    let ok: Bool
    let digest: String?
    let error: String?
  }

  static func normalizeFilePath(_ filePath: String) -> String {
    if filePath.hasPrefix("file://") {
      return String(filePath.dropFirst("file://".count))
    }
    return filePath
  }

  static func verify(
    filePath: String,
    expectedSha256: String,
    onProgress: ((Int64, Int64) -> Void)? = nil
  ) -> VerifyResult {
    let path = normalizeFilePath(filePath)
    let fileURL = URL(fileURLWithPath: path)

    guard FileManager.default.fileExists(atPath: path) else {
      return VerifyResult(ok: false, digest: nil, error: "File not found")
    }

    let totalBytes: Int64
    do {
      let attrs = try FileManager.default.attributesOfItem(atPath: path)
      totalBytes = (attrs[.size] as? NSNumber)?.int64Value ?? 0
    } catch {
      return VerifyResult(ok: false, digest: nil, error: error.localizedDescription)
    }

    if totalBytes <= 0 {
      return VerifyResult(ok: false, digest: nil, error: "File is empty")
    }

    var hasher = SHA256()
    var bytesHashed: Int64 = 0
    var lastProgressMs: UInt64 = 0

    do {
      let handle = try FileHandle(forReadingFrom: fileURL)
      defer { try? handle.close() }

      while true {
        guard let chunk = try handle.read(upToCount: chunkSize), !chunk.isEmpty else {
          break
        }
        hasher.update(data: chunk)
        bytesHashed += Int64(chunk.count)

        let nowMs = DispatchTime.now().uptimeNanoseconds / 1_000_000
        if onProgress != nil,
           nowMs - lastProgressMs >= progressIntervalMs || bytesHashed >= totalBytes
        {
          lastProgressMs = nowMs
          onProgress?(bytesHashed, totalBytes)
        }
      }
    } catch {
      return VerifyResult(ok: false, digest: nil, error: error.localizedDescription)
    }

    if onProgress != nil && bytesHashed > 0 {
      onProgress?(bytesHashed, totalBytes)
    }

    let digest = hasher.finalize().map { String(format: "%02x", $0) }.joined()
    let expected = expectedSha256.lowercased()
    if digest != expected {
      return VerifyResult(
        ok: false,
        digest: digest,
        error: "SHA-256 mismatch: expected \(expected.prefix(12))…, got \(digest.prefix(12))…"
      )
    }

    return VerifyResult(ok: true, digest: digest, error: nil)
  }
}
