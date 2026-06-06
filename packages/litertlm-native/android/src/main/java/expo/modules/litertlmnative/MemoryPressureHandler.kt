package expo.modules.litertlmnative

import android.content.ComponentCallbacks2
import android.content.Context
import android.content.res.Configuration
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Phase 2 S4 — Smart Eviction (ARCHITECTURE §1.12.3).
 * Critical memory only → hibernate (never shutdown on moderate trim).
 */
class MemoryPressureHandler(
  context: Context,
  private val onCriticalMemory: suspend () -> Unit,
) : ComponentCallbacks2 {
  private val appContext = context.applicationContext
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  @Volatile
  private var registered = false
  @Volatile
  private var hibernateOnMemoryWarning = true

  fun register() {
    if (registered) {
      return
    }
    appContext.registerComponentCallbacks(this)
    registered = true
  }

  fun unregister() {
    if (!registered) {
      return
    }
    appContext.unregisterComponentCallbacks(this)
    registered = false
  }

  fun setHibernateOnMemoryWarning(enabled: Boolean) {
    hibernateOnMemoryWarning = enabled
  }

  override fun onTrimMemory(level: Int) {
    if (!hibernateOnMemoryWarning) {
      return
    }
    if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL) {
      scope.launch { onCriticalMemory() }
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) = Unit

  override fun onLowMemory() {
    if (!hibernateOnMemoryWarning) {
      return
    }
    scope.launch { onCriticalMemory() }
  }
}
