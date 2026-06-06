package expo.modules.litertlmnative

import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

object Sha256Verifier {
  private const val CHUNK_SIZE = 4 * 1024 * 1024
  private const val PROGRESS_INTERVAL_MS = 100L

  data class VerifyResult(
    val ok: Boolean,
    val digest: String?,
    val error: String?,
  )

  fun normalizeFilePath(filePath: String): String =
    when {
      filePath.startsWith("file://") -> filePath.removePrefix("file://")
      else -> filePath
    }

  fun verify(
    filePath: String,
    expectedSha256: String,
    onProgress: ((bytesHashed: Long, totalBytes: Long) -> Unit)? = null,
  ): VerifyResult {
    val file = File(normalizeFilePath(filePath))
    if (!file.exists()) {
      return VerifyResult(ok = false, digest = null, error = "File not found")
    }

    val totalBytes = file.length()
    if (totalBytes <= 0L) {
      return VerifyResult(ok = false, digest = null, error = "File is empty")
    }

    val digest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(CHUNK_SIZE)
    var bytesHashed = 0L
    var lastProgressMs = 0L

    FileInputStream(file).use { input ->
      while (true) {
        val read = input.read(buffer)
        if (read == -1) {
          break
        }
        digest.update(buffer, 0, read)
        bytesHashed += read

        val now = System.currentTimeMillis()
        if (
          onProgress != null &&
            (now - lastProgressMs >= PROGRESS_INTERVAL_MS || bytesHashed >= totalBytes)
        ) {
          lastProgressMs = now
          onProgress(bytesHashed, totalBytes)
        }
      }
    }

    if (onProgress != null && bytesHashed > 0L) {
      onProgress(bytesHashed, totalBytes)
    }

    val hex = digest.digest().joinToString(separator = "") { byte -> "%02x".format(byte) }
    val expected = expectedSha256.lowercase()
    if (hex != expected) {
      return VerifyResult(
        ok = false,
        digest = hex,
        error = "SHA-256 mismatch: expected ${expected.take(12)}…, got ${hex.take(12)}…",
      )
    }

    return VerifyResult(ok = true, digest = hex, error = null)
  }
}
