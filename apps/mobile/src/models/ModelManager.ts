import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import type { Backend } from 'litertlm-native';

import {
  getManifestEntry,
  type ModelDownloadProgress,
  type ModelId,
  type ModelInstallState,
  type ModelManifestEntry,
} from './manifest';
import {
  ensureModelsDirectory,
  modelFile,
  modelLocalPath,
  verifyModelSha256,
} from './verifyModel';

const STATE_KEY = '@litertlm/model-install-states';
const PROGRESS_POLL_MS = 500;
const PERSIST_PROGRESS_STEP = 0.02;

function hubUrl(entry: ModelManifestEntry): string {
  return `https://huggingface.co/${entry.hfRepo}/resolve/main/${entry.fileName}`;
}

function readHfToken(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  // Expo inlines only EXPO_PUBLIC_* into the JS bundle (babel-preset-expo).
  return env?.EXPO_PUBLIC_HF_TOKEN ?? env?.HF_TOKEN;
}

function computeProgress(bytesWritten: number, totalBytes: number, manifestSize: number): number {
  const total = totalBytes > 0 ? totalBytes : manifestSize;
  if (total <= 0 || bytesWritten <= 0) {
    return 0;
  }
  return Math.min(bytesWritten / total, 1);
}

function isCompleteDownloadSize(actualBytes: number, expectedBytes: number): boolean {
  if (actualBytes <= 0) {
    return false;
  }
  return Math.abs(actualBytes - expectedBytes) <= expectedBytes * 0.02;
}

function pollDownloadedBytes(
  dest: File,
  onBytes: (bytesWritten: number) => void,
): () => void {
  let lastBytes = 0;
  const timer = setInterval(() => {
    if (!dest.exists) {
      return;
    }
    const size = dest.size ?? 0;
    if (size > lastBytes) {
      lastBytes = size;
      onBytes(size);
    }
  }, PROGRESS_POLL_MS);
  return () => clearInterval(timer);
}

export class ModelManager {
  async listStates(): Promise<ModelInstallState[]> {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    const saved = raw ? (JSON.parse(raw) as Record<string, ModelInstallState>) : {};
    return MODEL_IDS.map((id) => {
      const state = saved[id];
      return state ?? { id, status: 'not_downloaded' as const };
    });
  }

  async getState(id: ModelId): Promise<ModelInstallState> {
    const states = await this.listStates();
    return states.find((s) => s.id === id) ?? { id, status: 'not_downloaded' };
  }

  async getVerifiedModelPath(id: ModelId): Promise<string | null> {
    const state = await this.getState(id);
    if (state.status !== 'verified' || !state.localPath) {
      return null;
    }
    return state.localPath;
  }

  async downloadModel(
    id: ModelId,
    onProgress?: (update: ModelDownloadProgress) => void,
  ): Promise<ModelInstallState> {
    const entry = getManifestEntry(id);
    const token = readHfToken();
    if (!token) {
      return this.saveState({
        id,
        status: 'failed',
        verifyError: 'HF_TOKEN is required for model download',
      });
    }

    ensureModelsDirectory();
    const dest = modelFile(id);
    const existingSize = dest.exists ? (dest.size ?? 0) : 0;
    if (isCompleteDownloadSize(existingSize, entry.sizeBytes)) {
      return this.verifyDownloadedModel(id, dest, onProgress);
    }

    if (dest.exists) {
      dest.delete();
    }
    await this.saveState({
      id,
      status: 'downloading',
      progress: 0,
      bytesDownloaded: 0,
      localPath: dest.uri,
    });

    let lastBytes = 0;
    let lastPersistedProgress = 0;

    const report = (bytesWritten: number, totalBytes = -1) => {
      lastBytes = Math.max(lastBytes, bytesWritten);
      const progress = computeProgress(lastBytes, totalBytes, entry.sizeBytes);
      onProgress?.({ progress, bytesDownloaded: lastBytes });

      if (progress - lastPersistedProgress >= PERSIST_PROGRESS_STEP || progress >= 0.99) {
        lastPersistedProgress = progress;
        void this.saveState({
          id,
          status: 'downloading',
          progress,
          bytesDownloaded: lastBytes,
          localPath: dest.uri,
        });
      }
    };

    const stopPolling = pollDownloadedBytes(dest, (bytes) => report(bytes));

    try {
      // File.downloadFileAsync emits downloadProgress events; DownloadTask progress
      // can be unreliable on Android for large redirected HF downloads.
      await File.downloadFileAsync(hubUrl(entry), dest, {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) => {
          report(bytesWritten, totalBytes);
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed';
      return this.saveState({
        id,
        status: 'failed',
        verifyError: message,
        localPath: dest.uri,
      });
    } finally {
      stopPolling();
    }

    const finalSize = dest.size ?? entry.sizeBytes;
    report(finalSize, entry.sizeBytes);
    return this.verifyDownloadedModel(id, dest, onProgress);
  }

  async verifyDownloadedModel(
    id: ModelId,
    localFile?: File,
    onProgress?: (update: ModelDownloadProgress) => void,
  ): Promise<ModelInstallState> {
    const entry = getManifestEntry(id);
    const file = localFile ?? modelFile(id);
    await this.saveState({
      id,
      status: 'verifying',
      localPath: file.uri,
      progress: 0,
      bytesDownloaded: 0,
    });
    onProgress?.({ progress: 0, bytesDownloaded: 0, status: 'verifying' });

    if (!file.exists) {
      return this.saveState({
        id,
        status: 'failed',
        verifyError: 'Downloaded file missing',
        localPath: file.uri,
      });
    }

    const size = file.size ?? 0;
    if (size > 0 && !isCompleteDownloadSize(size, entry.sizeBytes)) {
      file.delete();
      return this.saveState({
        id,
        status: 'failed',
        verifyError: `Size mismatch: expected ~${entry.sizeBytes}, got ${size}`,
      });
    }

    const verify = await verifyModelSha256(file, entry.sha256, (hashed, total) => {
      onProgress?.({
        progress: total > 0 ? hashed / total : 0,
        bytesDownloaded: hashed,
        status: 'verifying',
      });
    });
    if (!verify.ok) {
      file.delete();
      return this.saveState({
        id,
        status: 'failed',
        verifyError: verify.error,
      });
    }

    return this.saveState({
      id,
      status: 'verified',
      localPath: file.uri,
      progress: 1,
      bytesDownloaded: size,
    });
  }

  async deleteModel(id: ModelId): Promise<void> {
    const file = modelFile(id);
    if (file.exists) {
      file.delete();
    }
    await this.saveState({ id, status: 'not_downloaded' });
  }

  getHubUrl(id: ModelId): string {
    return hubUrl(getManifestEntry(id));
  }

  getManifestEntry(id: ModelId): ModelManifestEntry {
    return getManifestEntry(id);
  }

  private async saveState(state: ModelInstallState): Promise<ModelInstallState> {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    const saved = raw ? (JSON.parse(raw) as Record<string, ModelInstallState>) : {};
    saved[state.id] = state;
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(saved));
    return state;
  }
}

const MODEL_IDS: ModelId[] = ['gemma-4-e2b', 'gemma-4-e4b'];

export type { Backend };

export { modelLocalPath };
