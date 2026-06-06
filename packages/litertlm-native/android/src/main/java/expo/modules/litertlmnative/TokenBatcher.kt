package expo.modules.litertlmnative

import android.os.Handler
import android.os.Looper

/**
 * §1.7 token batching — flush on interval OR max tokens OR stream end.
 */
class TokenBatcher(
  private val flushIntervalMs: Long = 50,
  private val maxTokensPerBatch: Int = 8,
  private val onFlush: (delta: String, kind: String) -> Unit,
) {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val buffer = StringBuilder()
  private var kind: String = "token"
  private var tokenCount = 0
  private var flushRunnable: Runnable? = null

  @Synchronized
  fun append(text: String, nextKind: String = "token") {
    if (buffer.isNotEmpty() && nextKind != kind) {
      flush()
    }
    kind = nextKind
    buffer.append(text)
    tokenCount += 1

    if (tokenCount >= maxTokensPerBatch) {
      flush()
      return
    }

    if (flushRunnable == null) {
      flushRunnable = Runnable {
        flushRunnable = null
        flush()
      }.also { mainHandler.postDelayed(it, flushIntervalMs) }
    }
  }

  @Synchronized
  fun flush() {
    flushRunnable?.let { mainHandler.removeCallbacks(it) }
    flushRunnable = null

    if (buffer.isEmpty()) {
      tokenCount = 0
      return
    }

    val delta = buffer.toString()
    val flushKind = kind
    buffer.clear()
    tokenCount = 0
    onFlush(delta, flushKind)
  }
}
