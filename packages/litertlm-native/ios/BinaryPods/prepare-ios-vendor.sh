#!/usr/bin/env bash
# Fetches LiteRT-LM xcframework + Swift wrapper for CocoaPods vendoring.
# SPM is not used: LiteRTLM declares unsafe linker flags and cannot be a Pod dependency.
set -euo pipefail

BINARY_PODS_DIR="$(cd "$(dirname "$0")" && pwd)"
IOS_DIR="$(cd "${BINARY_PODS_DIR}/.." && pwd)"
FRAMEWORKS_DIR="${BINARY_PODS_DIR}/Frameworks"
VENDOR_DIR="${IOS_DIR}/vendor/LiteRTLM"
XCFRAMEWORK="${FRAMEWORKS_DIR}/CLiteRTLM.xcframework"
XCZIP_URL="https://github.com/google-ai-edge/LiteRT-LM/releases/download/v0.13.0/CLiteRTLM.xcframework.zip"
LITERTLM_TAG="v0.13.0"

mkdir -p "$FRAMEWORKS_DIR" "$VENDOR_DIR"

if [ ! -d "$XCFRAMEWORK" ]; then
  echo "[CLiteRTLMBinary] Downloading CLiteRTLM.xcframework (${LITERTLM_TAG})…"
  tmpzip="$(mktemp -t CLiteRTLM.XXXXXX.zip)"
  curl -fsSL "$XCZIP_URL" -o "$tmpzip"
  unzip -q -o "$tmpzip" -d "$FRAMEWORKS_DIR"
  rm -f "$tmpzip"
fi

if [ ! -f "$VENDOR_DIR/Engine.swift" ]; then
  echo "[CLiteRTLMBinary] Fetching LiteRT-LM ${LITERTLM_TAG} Swift sources…"
  tmpdir="$(mktemp -d)"
  curl -fsSL "https://github.com/google-ai-edge/LiteRT-LM/archive/refs/tags/${LITERTLM_TAG}.tar.gz" \
    | tar xz -C "$tmpdir"
  srcdir="$(echo "$tmpdir"/LiteRT-LM-*/swift)"
  for f in "$srcdir"/*.swift; do
    base="$(basename "$f")"
    case "$base" in
      *Tests.swift) continue ;;
    esac
    cp "$f" "$VENDOR_DIR/"
  done
  rm -rf "$tmpdir"
fi

echo "[CLiteRTLMBinary] iOS vendor ready."
