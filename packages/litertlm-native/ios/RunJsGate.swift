import Foundation

final class RunJsGate {
  private var pending: [String: CheckedContinuation<String, Never>] = [:]
  private let lock = NSLock()

  func awaitResult(
    toolCallId: String,
    onAwaiting: @escaping () -> Void
  ) async -> String {
    await withCheckedContinuation { continuation in
      lock.lock()
      pending[toolCallId] = continuation
      lock.unlock()
      onAwaiting()
    }
  }

  func complete(toolCallId: String, resultJson: String) {
    lock.lock()
    let continuation = pending.removeValue(forKey: toolCallId)
    lock.unlock()
    continuation?.resume(returning: resultJson)
  }
}
