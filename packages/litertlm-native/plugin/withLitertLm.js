const {
  withAndroidManifest,
  withProjectBuildGradle,
  AndroidConfig,
} = require('@expo/config-plugins');

const OPENCL_LIBRARIES = ['libOpenCL.so', 'libvndksupport.so'];

function withKotlinGradlePlugin(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes("findProperty('android.kotlinVersion')")) {
      contents = contents.replace(
        'buildscript {',
        `buildscript {
  ext {
    kotlinVersion = findProperty('android.kotlinVersion') ?: '2.1.20'
  }`,
      );
      contents = contents.replace(
        "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
        'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")',
      );
      modConfig.modResults.contents = contents;
    }
    return modConfig;
  });
}

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withLitertLm = (config) => {
  config = withKotlinGradlePlugin(config);
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
