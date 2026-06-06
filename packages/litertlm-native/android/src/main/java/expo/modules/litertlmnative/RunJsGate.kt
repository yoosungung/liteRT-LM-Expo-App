package expo.modules.litertlmnative

import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.ConcurrentHashMap

class RunJsGate {
  private val pending = ConcurrentHashMap<String, CompletableDeferred<String>>()

  suspend fun awaitResult(
    toolCallId: String,
    onAwaiting: () -> Unit,
  ): String {
    val deferred = CompletableDeferred<String>()
    pending[toolCallId] = deferred
    onAwaiting()
    return try {
      deferred.await()
    } finally {
      pending.remove(toolCallId)
    }
  }

  fun complete(toolCallId: String, resultJson: String) {
    pending.remove(toolCallId)?.complete(resultJson)
  }
}
