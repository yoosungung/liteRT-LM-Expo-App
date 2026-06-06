import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 60_000,
    server: {
      deps: {
        inline: ['expo-device', 'expo-constants', 'expo-linking', 'expo-file-system', 'expo-clipboard'],
      },
    },
  },
});
