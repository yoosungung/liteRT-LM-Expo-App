import UIKit

/// Phase 2 S4 — Smart Eviction (ARCHITECTURE §1.12.3).
final class MemoryPressureHandler {
  private var observer: NSObjectProtocol?
  private var hibernateOnMemoryWarning = true
  private var onCriticalMemory: (() -> Void)?

  func register(onCriticalMemory: @escaping () -> Void) {
    self.onCriticalMemory = onCriticalMemory
    if observer != nil {
      return
    }
    observer = NotificationCenter.default.addObserver(
      forName: UIApplication.didReceiveMemoryWarningNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      guard let self, self.hibernateOnMemoryWarning else {
        return
      }
      self.onCriticalMemory?()
    }
  }

  func setHibernateOnMemoryWarning(_ enabled: Bool) {
    hibernateOnMemoryWarning = enabled
  }

  deinit {
    if let observer {
      NotificationCenter.default.removeObserver(observer)
    }
  }
}
