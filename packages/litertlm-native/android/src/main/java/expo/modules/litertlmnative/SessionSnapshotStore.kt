package expo.modules.litertlmnative

import org.json.JSONObject
import java.io.File

/**
 * Phase 2 S4 — KV snapshot metadata (native serialize unavailable → message replay fallback).
 * Binary `.kvsnapshot` is reserved for future LiteRT-LM KV serialize; metadata drives JS replay.
 */
object SessionSnapshotStore {
  private const val META_SUFFIX = ".kvsnapshot.meta.json"
  private const val SNAPSHOT_SUFFIX = ".kvsnapshot"

  data class SnapshotMeta(
    val conversationId: String,
    val usedNativeKvSerialize: Boolean,
    val messageCount: Int,
    val updatedAt: Long,
  )

  fun inferenceDir(cacheDir: String): File = File(cacheDir, "inference")

  fun metaFile(cacheDir: String, conversationId: String): File =
    File(inferenceDir(cacheDir), "$conversationId$META_SUFFIX")

  fun snapshotFile(cacheDir: String, conversationId: String): File =
    File(inferenceDir(cacheDir), "$conversationId$SNAPSHOT_SUFFIX")

  fun writeMeta(
    cacheDir: String,
    conversationId: String,
    messageCount: Int,
    usedNativeKvSerialize: Boolean = false,
  ): SnapshotMeta {
    val dir = inferenceDir(cacheDir)
    dir.mkdirs()
    val meta =
      SnapshotMeta(
        conversationId = conversationId,
        usedNativeKvSerialize = usedNativeKvSerialize,
        messageCount = messageCount,
        updatedAt = System.currentTimeMillis(),
      )
    val json =
      JSONObject()
        .put("version", 1)
        .put("conversationId", meta.conversationId)
        .put("usedNativeKvSerialize", meta.usedNativeKvSerialize)
        .put("messageCount", meta.messageCount)
        .put("updatedAt", meta.updatedAt)
    metaFile(cacheDir, conversationId).writeText(json.toString())
    // Placeholder path for future native KV bytes.
    snapshotFile(cacheDir, conversationId).writeText("")
    return meta
  }

  fun readMeta(cacheDir: String, conversationId: String): SnapshotMeta? {
    val file = metaFile(cacheDir, conversationId)
    if (!file.exists()) {
      return null
    }
    return runCatching {
      val json = JSONObject(file.readText())
      SnapshotMeta(
        conversationId = json.getString("conversationId"),
        usedNativeKvSerialize = json.optBoolean("usedNativeKvSerialize", false),
        messageCount = json.optInt("messageCount", 0),
        updatedAt = json.optLong("updatedAt", 0L),
      )
    }.getOrNull()
  }

  fun hasSnapshot(cacheDir: String, conversationId: String): Boolean =
    metaFile(cacheDir, conversationId).exists()

  fun deleteSnapshot(cacheDir: String, conversationId: String) {
    metaFile(cacheDir, conversationId).delete()
    snapshotFile(cacheDir, conversationId).delete()
  }

  fun restoredFrom(meta: SnapshotMeta?): String =
    when {
      meta == null -> "empty"
      meta.usedNativeKvSerialize -> "kv_snapshot"
      meta.messageCount > 0 -> "message_replay"
      else -> "empty"
    }
}
