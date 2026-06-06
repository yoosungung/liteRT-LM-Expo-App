package expo.modules.litertlmnative

import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.ConcurrentHashMap

class ToolApprovalGate {
  private val pending = ConcurrentHashMap<String, CompletableDeferred<Boolean>>()

  suspend fun awaitApproval(
    toolCallId: String,
    onAwaiting: () -> Unit,
  ): Boolean {
    val deferred = CompletableDeferred<Boolean>()
    pending[toolCallId] = deferred
    onAwaiting()
    return try {
      deferred.await()
    } finally {
      pending.remove(toolCallId)
    }
  }

  fun resolve(toolCallId: String, approved: Boolean) {
    pending.remove(toolCallId)?.complete(approved)
  }
}
