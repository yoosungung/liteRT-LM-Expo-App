require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'LitertlmNative'
  s.version        = package['version']
  s.summary        = 'LiteRT-LM Expo native module for liteRTLM'
  s.description    = 'Expo Modules bridge for LiteRT-LM Engine on iOS and Android'
  s.license        = package['license']
  s.author         = package['author'] || ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '17.0',
    :tvos => '17.0',
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.cocoapods_version = '>= 1.10.0'

  # Avoid static_framework + vendored dylibs (@rpath launch crashes). Binary xcframework
  # lives in CLiteRTLMBinary (see expo-litert-lm / CocoaPods #11948 pattern).

  s.dependency 'ExpoModulesCore'
  s.dependency 'CLiteRTLMBinary'

  s.source_files = [
    'LitertlmNativeModule.swift',
    'EngineBridge.swift',
    'DeviceTools.swift',
    'ToolApprovalGate.swift',
    'Sha256Verifier.swift',
    'TokenBatcher.swift',
    'MemoryPressureHandler.swift',
    'SessionSnapshotStore.swift',
    'vendor/LiteRTLM/**/*.swift',
  ]
  s.exclude_files = ['BinaryPods/**/*']

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'OTHER_LDFLAGS' => '$(inherited) -all_load',
    'LD_RUNPATH_SEARCH_PATHS' => '$(inherited) @executable_path/Frameworks @loader_path/Frameworks',
  }

  s.user_target_xcconfig = {
    'OTHER_LDFLAGS' => '$(inherited) -all_load',
  }
end
