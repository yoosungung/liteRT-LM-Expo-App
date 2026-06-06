package expo.modules.litertlmnative

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.net.toUri
import com.google.ai.edge.litertlm.Tool
import com.google.ai.edge.litertlm.ToolParam
import com.google.ai.edge.litertlm.ToolSet
import org.json.JSONObject
import java.time.Instant

class DeviceToolSet(
  private val context: Context,
  private val conversationId: String,
  private val approvalGate: ToolApprovalGate,
  private val runJsGate: RunJsGate,
  private val onApprovalRequired: (
    conversationId: String,
    toolCallId: String,
    name: String,
    argumentsJson: String,
    riskLevel: String,
  ) -> Unit,
  private val onRunJsRequired: (
    conversationId: String,
    toolCallId: String,
    argumentsJson: String,
  ) -> Unit,
) : ToolSet {
  @Tool(description = "Get the current local time as an ISO-8601 string.")
  fun getCurrentTime(): Map<String, String> =
    mapOf("iso" to Instant.now().toString())

  @Tool(description = "Get basic device info (platform, model, OS version).")
  fun getDeviceInfo(): Map<String, Any> =
    mapOf(
      "platform" to "android",
      "modelName" to (Build.MODEL ?: "unknown"),
      "osVersion" to (Build.VERSION.RELEASE ?: "unknown"),
      "sdkInt" to Build.VERSION.SDK_INT,
    )

  @Tool(description = "Open a URL in the system browser.")
  fun openUrl(
    @ToolParam(description = "HTTPS URL to open") url: String,
  ): Map<String, Any> {
    val trimmed = url.trim()
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      return mapOf("opened" to false, "url" to trimmed, "error" to "Only http(s) URLs are supported")
    }

    val toolCallId = "$conversationId-tool-openUrl-${System.currentTimeMillis()}"
    val argumentsJson = """{"url":"$trimmed"}"""

    val approved =
      kotlinx.coroutines.runBlocking {
        approvalGate.awaitApproval(toolCallId) {
          onApprovalRequired(
            conversationId,
            toolCallId,
            "openUrl",
            argumentsJson,
            "destructive",
          )
        }
      }

    if (!approved) {
      return mapOf("opened" to false, "url" to trimmed, "error" to "User denied")
    }

    return try {
      val intent = Intent(Intent.ACTION_VIEW, trimmed.toUri()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      mapOf("opened" to true, "url" to trimmed)
    } catch (error: Exception) {
      mapOf("opened" to false, "url" to trimmed, "error" to (error.message ?: "Failed to open URL"))
    }
  }

  @Tool(
    description =
      "Execute the active JavaScript skill in a sandboxed WebView. Pass stringified JSON in `data` per the skill SKILL.md schema.",
  )
  fun run_js(
    @ToolParam(description = "Stringified JSON parameters for window.ai_edge_gallery_get_result")
    data: String,
    @ToolParam(description = "Skill script entrypoint, typically index.html")
    scriptName: String? = null,
    @ToolParam(description = "Optional skill id override when multiple JS skills are installed")
    skillName: String? = null,
  ): Map<String, Any> {
    val toolCallId = "$conversationId-tool-runJs-${System.currentTimeMillis()}"
    val argumentsJson =
      JSONObject().apply {
        put("data", data)
        scriptName?.takeIf { it.isNotBlank() }?.let { put("scriptName", it) }
        skillName?.takeIf { it.isNotBlank() }?.let { put("skillName", it) }
      }.toString()

    val resultJson =
      kotlinx.coroutines.runBlocking {
        runJsGate.awaitResult(toolCallId) {
          onRunJsRequired(conversationId, toolCallId, argumentsJson)
        }
      }

    return parseRunJsResult(resultJson)
  }

  private fun parseRunJsResult(resultJson: String): Map<String, Any> {
    return try {
      val obj = JSONObject(resultJson)
      obj.keys().asSequence().associateWith { key -> obj.get(key) }
    } catch (_: Exception) {
      mapOf("raw" to resultJson)
    }
  }
}
