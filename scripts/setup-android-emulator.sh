#!/usr/bin/env bash
# Create liteRTLM_E2B AVD — 8 GB RAM for Gemma 4 E2B (minRamMb 4096).
set -euo pipefail

AVD_ID="liteRTLM_E2B"
SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
AVD_HOME="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
SYSTEM_IMAGE="system-images/android-36.1/google_apis/arm64-v8a"

if [[ ! -d "$SDK_ROOT/$SYSTEM_IMAGE" ]]; then
  echo "Missing system image: $SDK_ROOT/$SYSTEM_IMAGE"
  echo "Install via Android Studio → SDK Manager → Android 16 (API 36) Google APIs ARM 64."
  exit 1
fi

mkdir -p "$AVD_HOME/${AVD_ID}.avd"

cat > "$AVD_HOME/${AVD_ID}.ini" <<EOF
avd.ini.encoding=UTF-8
path=$AVD_HOME/${AVD_ID}.avd
path.rel=avd/${AVD_ID}.avd
target=android-36.1
EOF

cat > "$AVD_HOME/${AVD_ID}.avd/config.ini" <<EOF
AvdId=${AVD_ID}
PlayStore.enabled=false
abi.type=arm64-v8a
avd.ini.displayname=liteRTLM E2B (8GB RAM)
avd.ini.encoding=UTF-8
disk.dataPartition.size=12G
fastboot.forceColdBoot=no
fastboot.forceFastBoot=yes
hw.accelerometer=yes
hw.arc=false
hw.audioInput=yes
hw.battery=yes
hw.camera.back=virtualscene
hw.camera.front=emulated
hw.cpu.arch=arm64
hw.cpu.ncore=4
hw.dPad=no
hw.device.manufacturer=Google
hw.device.name=pixel_6
hw.gps=yes
hw.gpu.enabled=yes
hw.gpu.mode=auto
hw.gyroscope=yes
hw.initialOrientation=portrait
hw.keyboard=yes
hw.lcd.density=420
hw.lcd.height=2400
hw.lcd.width=1080
hw.mainKeys=no
hw.ramSize=8192
hw.sdCard=yes
hw.sensors.light=yes
hw.sensors.magnetic_field=yes
hw.sensors.orientation=yes
hw.sensors.pressure=yes
hw.sensors.proximity=yes
hw.trackBall=no
image.sysdir.1=${SYSTEM_IMAGE}/
runtime.network.latency=none
runtime.network.speed=full
sdcard.size=512M
showDeviceFrame=yes
skin.dynamic=yes
skin.name=pixel_6
skin.path=${SDK_ROOT}/skins/pixel_6
tag.display=Google APIs
tag.displaynames=Google APIs
tag.id=google_apis
tag.ids=google_apis
target=android-36.1
vm.heapSize=512
EOF

echo "Created AVD: ${AVD_ID} (8192 MB RAM, 12G data)"
echo "Run: pnpm mobile android   # uses ${AVD_ID} by default"
echo "Or:  emulator -avd ${AVD_ID}"
