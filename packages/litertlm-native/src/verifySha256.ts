import { requireNativeModule, type EventSubscription } from 'expo-modules-core';
import { Platform } from 'react-native';

export type Sha256VerifyResult = { ok: true } | { ok: false; error: string };

type NativeSha256VerifyResult = {
  ok: boolean;
  digest?: string | null;
  error?: string | null;
};

type Sha256ProgressEvent = {
  bytesHashed: number;
  totalBytes: number;
};

declare class LitertlmNativeSha256Module {
  verifyFileSha256(filePath: string, expectedSha256: string): Promise<NativeSha256VerifyResult>;
  addListener(
    eventName: 'onSha256VerifyProgress',
    listener: (event: Sha256ProgressEvent) => void,
  ): EventSubscription;
}

function loadNativeModule(): LitertlmNativeSha256Module {
  return requireNativeModule<LitertlmNativeSha256Module>('LitertlmNative');
}

export function isNativeSha256VerifyAvailable(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

export async function verifyFileSha256Native(
  filePath: string,
  expectedSha256: string,
  onProgress?: (bytesHashed: number, totalBytes: number) => void,
): Promise<Sha256VerifyResult> {
  if (!isNativeSha256VerifyAvailable()) {
    return { ok: false, error: 'Native SHA-256 verify is not available on this platform' };
  }

  const native = loadNativeModule();
  const subscription =
    onProgress != null
      ? native.addListener('onSha256VerifyProgress', (event) => {
          onProgress(event.bytesHashed, event.totalBytes);
        })
      : null;

  try {
    const result = await native.verifyFileSha256(filePath, expectedSha256);
    if (result.ok) {
      return { ok: true };
    }
    return { ok: false, error: result.error ?? 'SHA-256 verify failed' };
  } finally {
    subscription?.remove();
  }
}
