import { SHA256 } from '@noble/hashes/sha2';
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { isNativeSha256VerifyAvailable, verifyFileSha256Native } from 'litertlm-native';

const JS_CHUNK_SIZE = 4 * 1024 * 1024;
const YIELD_EVERY_CHUNKS = 8;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function modelsDirectory(): Directory {
  return new Directory(Paths.document, 'models');
}

export function modelFile(modelId: string): File {
  return new File(modelsDirectory(), `${modelId}.litertlm`);
}

export function ensureModelsDirectory(): Directory {
  const dir = modelsDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

async function verifyModelSha256Js(
  file: File,
  expectedSha256: string,
  onProgress?: (bytesHashed: number, totalBytes: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const size = file.size ?? 0;
  const hasher = new SHA256();
  const handle = file.open(FileMode.ReadOnly);
  let chunksSinceYield = 0;

  try {
    const fileSize = handle.size ?? size;
    onProgress?.(0, fileSize);
    while (handle.offset != null && handle.offset < fileSize) {
      const remaining = fileSize - handle.offset;
      const toRead = Math.min(JS_CHUNK_SIZE, remaining);
      const chunk = handle.readBytes(toRead);
      if (chunk.length === 0) {
        break;
      }
      hasher.update(chunk);
      chunksSinceYield += 1;
      if (chunksSinceYield >= YIELD_EVERY_CHUNKS) {
        chunksSinceYield = 0;
        onProgress?.(handle.offset, fileSize);
        await yieldToUi();
      }
    }
    onProgress?.(fileSize, fileSize);
  } finally {
    handle.close();
  }

  const digest = bytesToHex(hasher.digest());
  const expected = expectedSha256.toLowerCase();
  if (digest !== expected) {
    return {
      ok: false,
      error: `SHA-256 mismatch: expected ${expected.slice(0, 12)}…, got ${digest.slice(0, 12)}…`,
    };
  }
  return { ok: true };
}

export async function verifyModelSha256(
  file: File,
  expectedSha256: string,
  onProgress?: (bytesHashed: number, totalBytes: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (expectedSha256 === '0'.repeat(64)) {
    return {
      ok: false,
      error: 'Manifest sha256 is not pinned yet. Update manifest.ts before live download.',
    };
  }

  if (!file.exists) {
    return { ok: false, error: 'File not found' };
  }

  const size = file.size ?? 0;
  if (size <= 0) {
    return { ok: false, error: 'File is empty' };
  }

  if (isNativeSha256VerifyAvailable()) {
    return verifyFileSha256Native(file.uri, expectedSha256, onProgress);
  }

  return verifyModelSha256Js(file, expectedSha256, onProgress);
}

export function modelLocalPath(modelId: string): string {
  return modelFile(modelId).uri;
}

/** LiteRT-LM native expects a plain filesystem path (no `file://`). */
export function toNativeFilesystemPath(uriOrPath: string): string {
  if (!uriOrPath.startsWith('file://')) {
    return uriOrPath;
  }
  try {
    return decodeURIComponent(new URL(uriOrPath).pathname);
  } catch {
    return uriOrPath.replace(/^file:\/\//, '');
  }
}

export function modelNativePath(modelId: string): string {
  return toNativeFilesystemPath(modelFile(modelId).uri);
}

export function isModelFileReady(modelId: string, expectedBytes: number): boolean {
  const file = modelFile(modelId);
  if (!file.exists) {
    return false;
  }
  const size = file.size ?? 0;
  return size > 0 && Math.abs(size - expectedBytes) <= expectedBytes * 0.02;
}

export function inferenceCacheDirectory(): Directory {
  const dir = new Directory(Paths.cache, 'litertlm');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/** Native LiteRT-LM expects a filesystem path, not a `file://` URI. */
export function inferenceCachePath(): string {
  return inferenceCacheDirectory().uri.replace(/^file:\/\//, '');
}
