import { getSafeExpoDevice } from '../native/safeExpoDevice';
import type { ModelId } from './manifest';
import { getManifestEntry } from './manifest';

/** Total device RAM in MB, or null if unavailable (incl. expo-device not in dev build). */
export function getDeviceRamMb(): number | null {
  const bytes = getSafeExpoDevice().totalMemoryBytes;
  if (bytes == null || bytes <= 0) {
    return null;
  }
  return Math.floor(bytes / (1024 * 1024));
}

export function meetsMinRamForModel(modelId: ModelId): boolean {
  const required = getManifestEntry(modelId).minRamMb;
  const available = getDeviceRamMb();
  if (available == null) {
    return true;
  }
  return available >= required;
}

export function ramGateMessage(modelId: ModelId): string | null {
  if (meetsMinRamForModel(modelId)) {
    return null;
  }
  const required = getManifestEntry(modelId).minRamMb;
  const available = getDeviceRamMb();
  const availLabel = available != null ? `${available} MB` : 'unknown';
  return `Requires ~${required} MB RAM (device: ${availLabel}). E2B is recommended.`;
}
