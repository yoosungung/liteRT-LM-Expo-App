import { Directory, File, Paths } from 'expo-file-system';

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

export async function verifyModelSha256(
  file: File,
  expectedSha256: string,
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

  // Phase 1.4: multi-GB streaming SHA-256 (native or chunked) — placeholder rejects until pinned.
  return {
    ok: false,
    error: 'Streaming SHA-256 verify not implemented yet. Pin manifest sha256 and add native verify.',
  };
}

export function modelLocalPath(modelId: string): string {
  return modelFile(modelId).uri;
}
