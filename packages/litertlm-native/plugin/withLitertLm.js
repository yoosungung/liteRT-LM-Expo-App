const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const OPENCL_LIBRARIES = ['libOpenCL.so', 'libvndksupport.so'];

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withLitertLm = (config) => {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    AndroidConfig.Manifest.ensureToolsAvailable(manifest);

    const existing = application['uses-native-library'] ?? [];
    const entries = Array.isArray(existing) ? existing : [existing];

    for (const libraryName of OPENCL_LIBRARIES) {
      const alreadyPresent = entries.some(
        (entry) => entry.$?.['android:name'] === libraryName,
      );
      if (!alreadyPresent) {
        entries.push({
          $: {
            'android:name': libraryName,
            'android:required': 'false',
          },
        });
      }
    }

    application['uses-native-library'] = entries;
    return modConfig;
  });
};

module.exports = withLitertLm;
