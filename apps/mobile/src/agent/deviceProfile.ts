import Constants from 'expo-constants';
import type { Backend } from 'litertlm-native';

/** Physical device vs simulator/emulator (Expo Constants). */
export function isEmulator(): boolean {
  return Constants.isDevice === false;
}

/** Emulators lack reliable GPU memory; force CPU to reduce OOM risk. */
export function resolvePreferredBackend(preferred: Backend): Backend {
  if (isEmulator()) {
    return 'cpu';
  }
  return preferred;
}

export function defaultPreferredBackend(): Backend {
  return isEmulator() ? 'cpu' : 'gpu';
}
