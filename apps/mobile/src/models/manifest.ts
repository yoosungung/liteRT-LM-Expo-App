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
  bytesDownloaded?: number;
  verifyError?: string;
}

export interface ModelDownloadProgress {
  progress: number;
  bytesDownloaded: number;
  status?: ModelInstallStatus;
}

export const MODEL_MANIFEST: ModelManifestEntry[] = [
  {
    id: 'gemma-4-e2b',
    displayName: 'Gemma 4 E2B IT',
    hfRepo: 'litert-community/gemma-4-E2B-it-litert-lm',
    fileName: 'gemma-4-E2B-it.litertlm',
    sizeBytes: 2_588_147_712,
    sha256: '181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c',
    modalities: ['text', 'image', 'audio'],
    minRamMb: 4096,
  },
  {
    id: 'gemma-4-e4b',
    displayName: 'Gemma 4 E4B IT',
    hfRepo: 'litert-community/gemma-4-E4B-it-litert-lm',
    fileName: 'gemma-4-E4B-it.litertlm',
    sizeBytes: 3_659_530_240,
    sha256: '0b2a8980ce155fd97673d8e820b4d29d9c7d99b8fa6806f425d969b145bd52e0',
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
