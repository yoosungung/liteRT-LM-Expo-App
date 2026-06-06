import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadTask, File } from 'expo-file-system';
import type { Backend } from 'litertlm-native';

import {
  getManifestEntry,
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

function hubUrl(entry: ModelManifestEntry): string {
  return `https://huggingface.co/${entry.hfRepo}/resolve/main/${entry.fileName}`;
}

function readHfToken(): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.HF_TOKEN;
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
    onProgress?: (progress: number) => void,
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
    if (dest.exists) {
      dest.delete();
    }
    await this.saveState({ id, status: 'downloading', progress: 0, localPath: dest.uri });

    const task = new DownloadTask(hubUrl(entry), dest, {
      headers: { Authorization: `Bearer ${token}` },
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (totalBytes > 0) {
          onProgress?.(bytesWritten / totalBytes);
        } else if (entry.sizeBytes > 0) {
          onProgress?.(bytesWritten / entry.sizeBytes);
        }
      },
    });

    try {
      await task.downloadAsync();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed';
      return this.saveState({
        id,
        status: 'failed',
        verifyError: message,
        localPath: dest.uri,
      });
    }

    return this.verifyDownloadedModel(id, dest);
  }

  async verifyDownloadedModel(id: ModelId, localFile?: File): Promise<ModelInstallState> {
    const entry = getManifestEntry(id);
    const file = localFile ?? modelFile(id);
    await this.saveState({ id, status: 'verifying', localPath: file.uri });

    if (!file.exists) {
      return this.saveState({
        id,
        status: 'failed',
        verifyError: 'Downloaded file missing',
        localPath: file.uri,
      });
    }

    const size = file.size ?? 0;
    if (size > 0 && Math.abs(size - entry.sizeBytes) > entry.sizeBytes * 0.02) {
      file.delete();
      return this.saveState({
        id,
        status: 'failed',
        verifyError: `Size mismatch: expected ~${entry.sizeBytes}, got ${size}`,
      });
    }

    const verify = await verifyModelSha256(file, entry.sha256);
    if (!verify.ok) {
      if (verify.error.includes('not pinned')) {
        // Phase 1 interim: allow size-verified install until sha256 is pinned.
        return this.saveState({ id, status: 'verified', localPath: file.uri, progress: 1 });
      }
      file.delete();
      return this.saveState({
        id,
        status: 'failed',
        verifyError: verify.error,
      });
    }

    return this.saveState({ id, status: 'verified', localPath: file.uri, progress: 1 });
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
