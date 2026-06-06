# packages/litertlm-native — LiteRT-LM Expo Module

Expo Modules API로 LiteRT-LM(Kotlin/Swift)을 React Native에 노출하는 네이티브 패키지.

상위 계약: [ARCHITECTURE.md](../../ARCHITECTURE.md) §2.3  
참조: [.references/litert-lm-kotlin-api.md](../../.references/litert-lm-kotlin-api.md)

---

## 1. 역할

- `Engine` / `Conversation` 생명주기
- **InferenceStateBridge** — §1.12 lifecycle, `persistSession`/`restoreSession`
- **Token Batcher** — §1.7 (~50ms / 8 tok flush) 후 JS emit
- **Mock Engine** — §1.11
- **OS memory hooks** — Android `ComponentCallbacks2`, iOS memory warning

UI·네비게이션·세션 저장은 **포함하지 않는다**.

---

## 2. 패키지 구조 (목표)

```
packages/litertlm-native/
├── android/
│   └── src/main/java/.../
│       ├── LitertLmModule.kt
│       ├── InferenceStateBridge.kt
│       └── MemoryPressureHandler.kt
├── ios/
│   ├── LitertLmModule.swift
│   └── InferenceStateBridge.swift
├── src/
│   ├── index.ts              # public API + live/mock factory
│   ├── LitertLm.types.ts
│   ├── LitertLmModule.ts
│   └── mock/
│       └── MockEngine.ts     # §1.11
├── plugin/
│   └── withLitertLm.ts       # config plugin
├── app.plugin.js
├── expo-module.config.json
└── package.json
```

생성 명령 (Phase 0):

```bash
npx create-expo-module litertlm-native --local
```

---

## 3. Android 구현

### Gradle

```kotlin
dependencies {
    implementation("com.google.ai.edge.litertlm:litertlm-android:0.13.0")
}
```

### LitertLmModule (개념)

| Method | Native |
|--------|--------|
| `initialize` | `Engine(config).use { initialize() }` on `Dispatchers.IO` |
| `shutdown` | `engine.close()` |
| `createConversation` | `engine.createConversation(config)` |
| `sendMessage` | `sendMessageAsync().collect` → **TokenBatcher** → emit `onStreamDelta` |

### Token Batcher (§1.7)

```kotlin
// Pseudocode
class TokenBatcher(
  flushIntervalMs: Long = 50,
  maxTokens: Int = 8,
  onFlush: (delta: String, kind: StreamKind) -> Unit,
) {
  // accumulate tokens; flush on interval OR maxTokens OR stream end
}
```

- Turn/thinking 경계에서 kind 구분 (`token` | `thinking`)
- Per-token `onToken` emit **금지** (debug flag만)

### Mock Engine (§1.11)

- `mode === 'mock'`: LiteRT-LM Gradle/SPM 로드 생략 가능 (JS-only mock도 허용)
- Native mock: `Handler`/`Timer`로 tokens/sec simulate, 동일 batcher 경유
- `EXPO_PUBLIC_LITERTLM_MODE=mock` → `EngineConfig.mode = 'mock'`

### Threading

- `initialize`: strictly background; **mock는 즉시 ready**
- Stream delta emit: main-safe callback to JS
- Engine singleton per app process (ARCHITECTURE: one active model)

### InferenceStateBridge (§1.12)

| Method | Native |
|--------|--------|
| `warmUp` | load model → `active` |
| `enterIdle` | release GPU, keep weights |
| `hibernate` | persist open convos → unload model → `hibernated` |
| `persistSession` | LiteRT-LM KV `Serialize` → file (or mark fallback) |
| `restoreSession` | KV `Load` or replay via JS-provided messages |

### KV snapshot (§1.12.2)

- Path: `{cacheDir}/inference/{conversationId}.kvsnapshot`
- Phase 0.7: Gallery Android + LiteRT-LM C++ `KVCacheInterface::Serialize` / Kotlin exposure 확인
- Fallback: `usedNativeKvSerialize: false` → Coordinator triggers message replay prefill

### MemoryPressureHandler

```kotlin
// Android — register in Application or Module init
override fun onTrimMemory(level: Int) {
  if (level >= TRIM_MEMORY_RUNNING_CRITICAL) {
    inferenceStateBridge.hibernateOnMemoryPressure()
  }
}
```

```swift
// iOS
NotificationCenter.default.addObserver(
  forName: UIApplication.didReceiveMemoryWarningNotification, ...
)
```

### Config plugin (Android)

`withLitertLm.ts` — `withAndroidManifest`:

```xml
<uses-native-library android:name="libOpenCL.so" android:required="false"/>
<uses-native-library android:name="libvndksupport.so" android:required="false"/>
```

---

## 4. iOS 구현

- LiteRT-LM **Swift Package** — SPM **v0.13.0** tag pin (Android artifact와 동일 버전)
- Metal `Backend.GPU()` default when available
- API parity with Android ([ARCHITECTURE §2.3](../../ARCHITECTURE.md))

### Config plugin (iOS)

- SPM: `https://github.com/google-ai-edge/LiteRT-LM` — **exact version v0.13.0**
- 통합 경로: `expo-build-properties` 또는 custom plugin (Phase 0.5 Gallery iOS 참고)

---

## 5. JS Public API

`src/index.ts` — re-export types from [ARCHITECTURE §2.3](../../ARCHITECTURE.md):

- `initialize`, `shutdown`, `getStatus`
- `createConversation`, `closeConversation`
- `sendMessage` → `AsyncGenerator<string>`
- `addListener('onEngineStatusChanged', ...)`

Implementation note: Expo Modules [`AsyncIterator`](https://docs.expo.dev/modules/module-api/#asynciterator) 또는 manual event subscription.

---

## 6. Native Tools (Phase 2)

```kotlin
class DeviceToolSet(private val context: Context) : ToolSet {
    @Tool(description = "Get current local time ISO string")
    fun getCurrentTime(): String = Instant.now().toString()
}
```

Register in `createConversation` when JS passes `tools: ['device']` shorthand — internal map to ToolSet instances.

**Approval gate (§1.10):** before executing `@Tool` with `requiresApproval`, emit `onToolApprovalRequired` to JS; await `approveToolCall` / `rejectToolCall`.

JS-defined tools: `automaticToolCalling: false` + events (ARCHITECTURE §2.7 Mode B).

---

## 7. 에러 코드

| Code | Meaning |
|------|---------|
| `MODEL_NOT_FOUND` | invalid modelPath |
| `ENGINE_NOT_READY` | send before initialize |
| `OUT_OF_MEMORY` | native OOM |
| `BACKEND_UNAVAILABLE` | GPU/NPU missing |
| `MODEL_CHECKSUM_MISMATCH` | verify failed (JS layer may also report) |
| `HIBERNATE_FAILED` | persist partial, unload anyway |
| `RESTORE_FAILED` | fallback to message replay |
| `GENERATION_ABORTED` | user abort |

---

## 8. Gallery Android 참고 파일

| Gallery path | 용도 |
|--------------|------|
| `Android/src/.../llm/` | Engine wrapper 패턴 (경로는 구현 시 grep) |
| `Function_Calling_Guide.md` | Tool wiring |

Gallery는 RN이 아니므로 **API 호출 순서·config만** 참고.

---

## 9. 버전 정책

- **LiteRT-LM v0.13.0** 고정 (2026-06-06 결정)
- Android: `com.google.ai.edge.litertlm:litertlm-android:0.13.0` in `build.gradle`
- iOS: SPM tag `v0.13.0` in config plugin
- 버전 상향 시 ROADMAP·ARCHITECTURE §4·이 섹션을 함께 갱신

---

## Commands

> 코드 미구현. Phase 0.4 이후 갱신.

<!-- 예정:
cd packages/litertlm-native/example
npx expo run:android
-->
