const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @noble/hashes/utils imports "@noble/hashes/crypto"; Metro appends ".js" and
// misses package exports. Shim to the browser build (globalThis.crypto).
const nobleHashesRoot = path.dirname(require.resolve('@noble/hashes/sha2'));
const nobleCryptoEntry = path.join(nobleHashesRoot, 'esm', 'crypto.js');

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@noble/hashes/crypto' || moduleName === '@noble/hashes/crypto.js') {
    return { type: 'sourceFile', filePath: nobleCryptoEntry };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
