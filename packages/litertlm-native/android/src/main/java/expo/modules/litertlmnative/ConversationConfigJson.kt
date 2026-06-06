package expo.modules.litertlmnative

import com.google.ai.edge.litertlm.SamplerConfig
import com.google.gson.JsonParser

data class ParsedConversationConfig(
  val automaticToolCalling: Boolean = true,
  val enableBuiltinTools: Boolean = true,
  val sampler: SamplerConfig? = null,
)

object ConversationConfigJson {
  fun parse(configJson: String?): ParsedConversationConfig {
    if (configJson.isNullOrBlank()) {
      return ParsedConversationConfig()
    }

    val json = JsonParser.parseString(configJson).asJsonObject
    val automaticToolCalling =
      if (json.has("automaticToolCalling")) json.get("automaticToolCalling").asBoolean else true
    val enableBuiltinTools =
      if (json.has("enableBuiltinTools")) json.get("enableBuiltinTools").asBoolean else true

    val sampler =
      json.getAsJsonObject("sampler")?.let { samplerJson ->
        val topK = samplerJson.get("topK")?.asInt ?: 40
        val topP = samplerJson.get("topP")?.asDouble ?: 0.95
        val temperature = samplerJson.get("temperature")?.asDouble ?: 0.8
        SamplerConfig(topK = topK, topP = topP, temperature = temperature)
      }

    return ParsedConversationConfig(
      automaticToolCalling = automaticToolCalling,
      enableBuiltinTools = enableBuiltinTools,
      sampler = sampler,
    )
  }
}
