import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SHA256 } from '@noble/hashes/sha2';
import { File } from 'expo-file-system';

import * as litertlmNative from 'litertlm-native';

import {
  isModelFileReady,
  modelFile,
  toNativeFilesystemPath,
  verifyModelSha256,
} from './verifyModel';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('verifyModel helpers', () => {
  it('toNativeFilesystemPath strips file:// prefix', () => {
    expect(toNativeFilesystemPath('file:///data/model.litertlm')).toBe('/data/model.litertlm');
    expect(toNativeFilesystemPath('/data/model.litertlm')).toBe('/data/model.litertlm');
  });

  it('isModelFileReady checks size within tolerance', async () => {
    const file = modelFile('gemma-4-e2b');
    const expoFs = await import('expo-file-system');
    (expoFs as { __seedFile: (uri: string, c: Uint8Array) => void }).__seedFile(
      file.uri,
      new Uint8Array(1000),
    );
    expect(isModelFileReady('gemma-4-e2b', 1000)).toBe(true);
    expect(isModelFileReady('gemma-4-e2b', 10_000)).toBe(false);
  });
});

describe('verifyModelSha256', () => {
  beforeEach(() => {
    vi.spyOn(litertlmNative, 'isNativeSha256VerifyAvailable').mockReturnValue(false);
  });

  it('rejects unpinned manifest placeholder (§1.8)', async () => {
    const file = new File({} as never, 'bad.litertlm');
    Object.defineProperty(file, 'exists', { value: true });
    Object.defineProperty(file, 'size', { value: 10 });
    const result = await verifyModelSha256(file, '0'.repeat(64));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('not pinned');
    }
  });

  it('rejects missing file', async () => {
    const file = new File({} as never, 'missing.litertlm');
    const result = await verifyModelSha256(file, 'a'.repeat(64));
    expect(result).toEqual({ ok: false, error: 'File not found' });
  });

  it('verifies matching JS digest', async () => {
    const content = new TextEncoder().encode('model-bytes');
    const hasher = new SHA256();
    hasher.update(content);
    const digest = bytesToHex(hasher.digest());
    const file = new File({} as never, 'good.litertlm');
    const expoFs = await import('expo-file-system');
    (expoFs as { __seedFile: (uri: string, c: Uint8Array) => void }).__seedFile(
      file.uri,
      content,
    );
    Object.defineProperty(file, 'exists', { value: true });
    Object.defineProperty(file, 'size', { value: content.length });

    const result = await verifyModelSha256(file, digest);
    expect(result).toEqual({ ok: true });
  });

  it('fails on digest mismatch', async () => {
    const content = new TextEncoder().encode('corrupt');
    const file = new File({} as never, 'corrupt.litertlm');
    const expoFs = await import('expo-file-system');
    (expoFs as { __seedFile: (uri: string, c: Uint8Array) => void }).__seedFile(
      file.uri,
      content,
    );
    Object.defineProperty(file, 'exists', { value: true });
    Object.defineProperty(file, 'size', { value: content.length });

    const result = await verifyModelSha256(file, 'b'.repeat(64));
    expect(result.ok).toBe(false);
  });
});
