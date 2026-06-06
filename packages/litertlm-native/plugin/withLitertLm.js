const {
  withAndroidManifest,
  withProjectBuildGradle,
  AndroidConfig,
  withDangerousMod,
  createRunOncePlugin,
} = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const OPENCL_LIBRARIES = ['libOpenCL.so', 'libvndksupport.so'];

const MARKER_BEGIN = '# >>> litertlm-native binary pods (managed by withLitertLm.js) >>>';
const MARKER_END = '# <<< litertlm-native binary pods (managed by withLitertLm.js) <<<';

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

function podBlock(modulePath) {
  return [
    MARKER_BEGIN,
    `  pod 'CLiteRTLMBinary', :path => '${modulePath}'`,
    MARKER_END,
  ].join('\n');
}

function injectIntoPodfile(podfile, modulePath) {
  const stripped = podfile.replace(
    new RegExp(`${MARKER_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, 'g'),
    '',
  );

  const targetRegex = /(target\s+'[^']+'\s+do\b)/;
  if (!targetRegex.test(stripped)) {
    throw new Error(
      'litertlm-native plugin: no `target ... do` block found in Podfile',
    );
  }

  return stripped.replace(targetRegex, `$1\n${podBlock(modulePath)}`);
}

function withLitertLmBinaryPods(config) {
  return withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return modConfig;
      }

      const modulePath = '../node_modules/litertlm-native/ios/BinaryPods';
      const before = fs.readFileSync(podfilePath, 'utf8');
      const after = injectIntoPodfile(before, modulePath);
      if (after !== before) {
        fs.writeFileSync(podfilePath, after, 'utf8');
      }
      return modConfig;
    },
  ]);
}

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withLitertLm = (config) => {
  config = withKotlinGradlePlugin(config);
  config = withAndroidManifest(config, (modConfig) => {
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
  config = withLitertLmBinaryPods(config);
  return config;
};

module.exports = createRunOncePlugin(withLitertLm, 'litertlm-native', '0.1.0');
