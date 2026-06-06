require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'CLiteRTLMBinary'
  s.version        = package['version']
  s.summary        = 'Binary pod for CLiteRTLM.xcframework (LiteRT-LM v0.13.0)'
  s.description    = 'Top-level vendored_frameworks pod. Split from LitertlmNative to work around CocoaPods #11948 under static linkage.'
  s.license        = package['license']
  s.author         = package['author'] || ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '17.0',
    :tvos => '17.0',
  }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.cocoapods_version = '>= 1.10.0'

  s.prepare_command = "bash \"#{__dir__}/prepare-ios-vendor.sh\""
  s.vendored_frameworks = 'Frameworks/CLiteRTLM.xcframework'

  s.pod_target_xcconfig = {
    'LD_RUNPATH_SEARCH_PATHS' => '$(inherited) @executable_path/Frameworks @loader_path/Frameworks',
  }
end
