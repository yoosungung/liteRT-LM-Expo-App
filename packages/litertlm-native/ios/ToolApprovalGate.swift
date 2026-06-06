import Foundation

final class ToolApprovalGate {
  private var pending: [String: CheckedContinuation<Bool, Never>] = [:]
  private let lock = NSLock()

  func awaitApproval(
    toolCallId: String,
    onAwaiting: @escaping () -> Void
  ) async -> Bool {
    await withCheckedContinuation { continuation in
      lock.lock()
      pending[toolCallId] = continuation
      lock.unlock()
      onAwaiting()
    }
  }

  func resolve(toolCallId: String, approved: Bool) {
    lock.lock()
    let continuation = pending.removeValue(forKey: toolCallId)
    lock.unlock()
    continuation?.resume(returning: approved)
  }
}
