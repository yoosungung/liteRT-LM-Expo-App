export type ModelId = 'gemma-4-e2b' | 'gemma-4-e4b';

export interface ModelManifestEntry {
  id: ModelId;
  displayName: string;
  hfRepo: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  modalities: ('text' | 'image' | 'audio')[];
  minRamMb: number;
}

export type ModelInstallStatus =
  | 'not_downloaded'
  | 'downloading'
  | 'verifying'
  | 'verified'
  | 'failed';

export interface ModelInstallState {
  id: ModelId;
  status: ModelInstallStatus;
  localPath?: string;
  progress?: number;
  verifyError?: string;
}

export const MODEL_MANIFEST: ModelManifestEntry[] = [
  {
    id: 'gemma-4-e2b',
    displayName: 'Gemma 4 E2B IT',
    hfRepo: 'litert-community/gemma-4-E2B-it-litert-lm',
    fileName: 'gemma-4-E2B-it.litertlm',
    sizeBytes: 2_770_000_000,
    // Update when pinning a specific artifact revision.
    sha256: '0000000000000000000000000000000000000000000000000000000000000000',
    modalities: ['text', 'image', 'audio'],
    minRamMb: 4096,
  },
  {
    id: 'gemma-4-e4b',
    displayName: 'Gemma 4 E4B IT',
    hfRepo: 'litert-community/gemma-4-E4B-it-litert-lm',
    fileName: 'gemma-4-E4B-it.litertlm',
    sizeBytes: 4_500_000_000,
    sha256: '0000000000000000000000000000000000000000000000000000000000000000',
    modalities: ['text', 'image', 'audio'],
    minRamMb: 8192,
  },
];

export function getManifestEntry(id: ModelId): ModelManifestEntry {
  const entry = MODEL_MANIFEST.find((m) => m.id === id);
  if (!entry) {
    throw new Error(`Unknown model: ${id}`);
  }
  return entry;
}
