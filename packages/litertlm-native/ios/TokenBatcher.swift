import Foundation

/// §1.7 token batching — flush on interval OR max tokens OR stream end.
final class TokenBatcher {
  private let flushIntervalMs: TimeInterval
  private let maxTokensPerBatch: Int
  private let onFlush: (String, String) -> Void

  private var buffer = ""
  private var kind = "token"
  private var tokenCount = 0
  private var flushWorkItem: DispatchWorkItem?
  private let lock = NSLock()
  private let timerQueue = DispatchQueue.main

  init(
    flushIntervalMs: TimeInterval = 0.05,
    maxTokensPerBatch: Int = 8,
    onFlush: @escaping (String, String) -> Void
  ) {
    self.flushIntervalMs = flushIntervalMs
    self.maxTokensPerBatch = maxTokensPerBatch
    self.onFlush = onFlush
  }

  func append(_ text: String, kind nextKind: String = "token") {
    lock.lock()
    defer { lock.unlock() }

    if !buffer.isEmpty && nextKind != kind {
      flushLocked()
    }
    kind = nextKind
    buffer.append(text)
    tokenCount += 1

    if tokenCount >= maxTokensPerBatch {
      flushLocked()
      return
    }

    if flushWorkItem == nil {
      let workItem = DispatchWorkItem { [weak self] in
        self?.flush()
      }
      flushWorkItem = workItem
      timerQueue.asyncAfter(deadline: .now() + flushIntervalMs, execute: workItem)
    }
  }

  func flush() {
    lock.lock()
    defer { lock.unlock() }
    flushLocked()
  }

  private func flushLocked() {
    flushWorkItem?.cancel()
    flushWorkItem = nil

    guard !buffer.isEmpty else {
      tokenCount = 0
      return
    }

    let delta = buffer
    let flushKind = kind
    buffer = ""
    tokenCount = 0
    onFlush(delta, flushKind)
  }
}
