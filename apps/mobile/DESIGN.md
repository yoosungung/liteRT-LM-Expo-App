# apps/mobile — Expo Agent Chat App

Expo dev client 기반 React Native 앱. 채팅 UI, 세션·모델 관리, AgentRuntime 오케스트레이션.

상위 계약: [ARCHITECTURE.md](../../ARCHITECTURE.md)  
구현 순서: [ROADMAP.md](../../ROADMAP.md) Phase 1+

---

## 1. 역할

- 사용자-facing **Agent Chat** UI (iOS + Android)
- `AgentRuntime` — `packages/litertlm-native` 브릿지의 **유일한** 소비자
- Model Manager, SessionStore, (Phase 2+) Tool/Skill registry

LiteRT-LM Engine/Conversation 코드는 **이 패키지에 두지 않는다**.

---

## 2. 디렉터리 구조 (목표)

```
apps/mobile/
├── app/                    # Expo Router screens
│   ├── (tabs)/
│   │   ├── index.tsx       # Chat list
│   │   ├── chat/[id].tsx   # Active conversation
│   │   └── models.tsx      # Model Manager
│   └── _layout.tsx
├── src/
│   ├── agent/
│   │   ├── AgentRuntime.ts
│   │   ├── InferenceCoordinator.ts  # §1.12 AppState, warmUp, hibernate
│   │   ├── PromptTemplateEngine.ts   # §1.9
│   │   ├── StreamChunk.ts
│   │   └── tools/          # Phase 2+ JS tools
│   ├── skills/             # Phase 3 Agent Skills
│   ├── mcp/                # Phase 4 MCP registry + client
│   ├── models/
│   │   ├── ModelManager.ts
│   │   ├── manifest.ts     # gemma-4-e2b, e4b + sha256
│   │   └── verifyModel.ts  # streaming SHA-256
│   ├── storage/
│   │   └── SessionStore.ts
│   └── components/
│       ├── ChatMessageList.tsx
│       ├── ChatInput.tsx
│       ├── StreamingText.tsx
│       └── ThinkingBlock.tsx   # Phase 2
├── app.json
└── eas.json
```

---

## 3. 화면 (Phase별)

| Screen | Phase | 설명 |
|--------|-------|------|
| Chat list | 1 | 세션 목록, 새 채팅 |
| Chat | 1 | 스트리밍 메시지, 입력 |
| Tool approval sheet | 2 | side-effect 도구 승인 (§1.10) |
| Models | 1 | 다운로드/삭제, backend 선택 |
| Settings | 2 | sampler, thinking; **"메모리 확보"** → hibernate |
| Skills | 3 | SKILL.md import |
| Connected (MCP) | 4 | MCP server URL 등록·enable |
| Benchmark | 2 | 간단 perf 측정 |

---

## 4. AgentRuntime

[ARCHITECTURE.md §2.4](../../ARCHITECTURE.md) 구현.

### 책임

1. `litertlm-native` Engine lifecycle; dev에서는 **mock mode** 우선
2. **InferenceCoordinator** — `AppState`, chat focus/blur, `warmUp`/`hibernate` (§1.12)
3. Session ↔ `conversationId` 매핑
4. **PromptTemplateEngine** — system instruction·extraContext·semantic turns (§1.9)
5. `sendUserMessage` → native **batched** `onStreamDelta` → `StreamChunk`
6. Phase 2: tools, approval, **Snapshot UI / restoring skeleton**
7. Phase 3: Skill → PromptTemplateEngine merge

### InferenceCoordinator (§1.12)

```typescript
// App.tsx — earliest hook
useEffect(() => {
  const sub = AppState.addEventListener('change', (s) =>
    coordinator.onAppStateChange(mapAppState(s)));
  return () => sub.remove();
}, []);

// Chat screen focus
useFocusEffect(() => {
  coordinator.onChatFocus(conversationId);
  return () => { void coordinator.onChatBlur(conversationId); };
});
```

- `active` → `warmUp(lastModelId)` (UI 전, non-blocking)
- `background` + no stream → `enterIdle()`; timer 후 `hibernate()`
- `lifecycle` stream chunk → Chat overlay (skeleton / snapshot)

### 상태 머신 (generation)

```
idle → sending → streaming → (tool_approval_pending) → (tool_executing) → done | error | aborted
```

---

## 5. ModelManager

- Manifest: `gemma-4-e2b`, `gemma-4-e4b` — **`sha256` 필수** ([ARCHITECTURE §1.8](../../ARCHITECTURE.md))
- Download: `expo-file-system` + resumable; Hub URL + `Authorization: Bearer ${HF_TOKEN}` ([ARCHITECTURE §2.6](../../ARCHITECTURE.md))
- `HF_TOKEN`: dev — `process.env.HF_TOKEN` / `.env.local`(gitignore); prod — secure storage (구현 시)
- Post-download: `verifyModel.ts` — streaming SHA-256, `verified` 전 Engine 금지
- `minRamMb` check — `expo-device` memory hint (상세 메모리 전략은 미정)
- 설치 경로: `FileSystem.documentDirectory + 'models/'`

## 5.1 PromptTemplateEngine

[ARCHITECTURE §2.4 PromptTemplateEngine](../../ARCHITECTURE.md)

- Gemma turn token(`<start_of_turn>` 등) **미포함** — LiteRT-LM Conversation API 위임
- 담당: systemInstruction 합성, skill preface, `enable_thinking` extraContext

---

## 6. SessionStore

- Phase 1: `@react-native-async-storage/async-storage` 또는 `expo-sqlite`
- **UI 메시지 전용** — KV 스냅샷은 native `.kvsnapshot` (§1.12.2)
- `restoreSession` fallback 시 replay 소스로 사용

---

## 7. Perceived latency UX (§1.12.5)

| State | UI |
|-------|-----|
| `loading` / `restoring` | Snapshot of last chat + animated skeleton copy |
| `hibernated` → `active` | Input disabled until `lifecycle: active` |
| User "메모리 확보" | Confirm → `requestHibernate()` |

## 8. Expo 설정 (목표)

```json
{
  "expo": {
    "plugins": ["expo-dev-client", "litertlm-native"],
    "ios": { "deploymentTarget": "17.0" },
    "android": { "minSdkVersion": 31 }
  }
}
```

- Android 12 = API 31
- iOS 17+ (Gallery·LiteRT-LM 정합)

---

## 9. Gallery 대비 차별

| Gallery | mobile |
|---------|--------|
| Jetpack Compose | React Native |
| Kotlin-only tools | Native bridge + JS tools |
| Built-in tiles | Chat-first, skills optional |

추론·모델 포맷 동작은 Gallery와 **동일 LiteRT-LM** 스택.

---

## 11. Phase 2 (완료)

구현 계획: [.references/phase2-plan.md](../../.references/phase2-plan.md)

| 작업 | 경로 | 상태 |
|------|------|------|
| Tool registry | `src/agent/tools/` | ✅ S1 — builtins + registry |
| Agent preferences | `src/agent/AgentPreferences.ts` | ✅ auto-tools toggle (Settings) |
| Settings | `app/(tabs)/settings.tsx` | ✅ automaticToolCalling |
| Tool approval | `src/components/ToolApprovalSheet.tsx` | ✅ Chat wiring |
| RAM gate | `src/models/deviceRam.ts` | ✅ E4B `minRamMb` |
| Thinking UI | `src/components/ThinkingBlock.tsx` | ✅ |
| Benchmark | `app/(tabs)/benchmark.tsx` | ✅ |
| KV persist/hibernate | InferenceCoordinator + native | ✅ S4 |

---

## 12. Phase 3 (완료 2026-06-06)

구현 계획: [.references/phase3-plan.md](../../.references/phase3-plan.md)

| 작업 | 경로 | 상태 |
|------|------|------|
| Skill types | `src/skills/types.ts` | ✅ |
| SKILL.md parser | `src/skills/SkillParser.ts` | ✅ |
| Skill registry | `src/skills/registry.ts` | ✅ |
| Skill catalog + invoke | `src/skills/skillCatalog.ts` | ✅ S1 |
| Text skill merge | `PromptTemplateEngine` + `AgentRuntime` | ✅ S1 |
| Skill import + store | `skillImport.ts`, `SkillStore.ts` | ✅ S2 |
| Skills tab | `app/(tabs)/skills.tsx` | ✅ S2 |
| Bundled sample | `src/skills/bundledSkills.ts` | ✅ S2 |
| JS skill runner | `src/skills/JsSkillRunner.ts` | ✅ S3 |
| WebView host | `src/skills/JsSkillHost.tsx` | ✅ S3 |
| Intent tools | `src/agent/tools/intentTools.ts` + native `@Tool` | ✅ S4 |
| allowed-tools filter | `src/agent/tools/filterToolsByAllowed.ts` | ✅ S4 |
| Ask Image | `src/media/pickChatImage.ts`, `imageAttachment.ts`, chat UI | ✅ S4 |

---

## 10. 테스트·TDD (필수)

계약: [ARCHITECTURE.md](../../ARCHITECTURE.md) §1.13 · 롤아웃 순서: [ROADMAP.md](../../ROADMAP.md) TDD Rollout.

**규칙:** `src/` 순수 로직·상태 모듈은 **테스트 없이 변경·추가하지 않는다.** 레거시(Phase 1–2)는 역방향 TDD, Phase 3+는 순방향 TDD.

### 10.1 러너·배치

| 종류 | 경로 | 러너 |
|------|------|------|
| 순수 TS | `src/**/*.test.ts` | Vitest (`environment: node`) |
| RN 컴포넌트 | `src/**/*.test.tsx` | Jest + `jest-expo` + `@testing-library/react-native` |

Mock: `@react-native-async-storage/async-storage/jest/async-storage-mock`, `litertlm-native` → `MockEngine` 직접 주입.

### 10.2 Wave별 파일 매트릭스

상태: ✅ Green (T0–T5, 2026-06-06)

#### Wave T2 — 순수 로직

| ✅ | 소스 | 테스트 | 필수 `it` 케이스 |
|----|------|--------|------------------|
| ✅ | `src/agent/PromptTemplateEngine.ts` | `PromptTemplateEngine.test.ts` | custom `systemInstruction`; default fallback; `buildExtraContext({ thinking: true })` → `enable_thinking` |
| ✅ | `src/agent/StreamChunk.ts` | `StreamChunk.test.ts` | `kind: token` 누적; thinking 분리; complete 시 flush |
| ✅ | `src/agent/tools/registry.ts` | `registry.test.ts` | register·getByName; unknown tool |
| ✅ | `src/agent/tools/builtins.ts` | `builtins.test.ts` | `getCurrentTime` read; `openUrl` write+approval |
| ✅ | `src/models/manifest.ts` | `manifest.test.ts` | E2B/E4B `sha256`·`minRamMb` non-empty |
| ✅ | `src/models/deviceRam.ts` | `deviceRam.test.ts` | RAM < min → blocked; RAM ≥ min → allowed |
| ✅ | `src/models/verifyModel.ts` | `verifyModel.test.ts` | wrong digest → `{ ok: false }`; match → `{ ok: true }` (§1.8) |
| ✅ | `src/agent/MessageReplayer.ts` | `MessageReplayer.test.ts` | `countReplayableUserTurns`; empty content skip; `replaySessionMessages` 호출 수 |
| ✅ | `src/agent/deviceProfile.ts` | `deviceProfile.test.ts` | low-RAM → E2B default |
| ✅ | `src/benchmark/runBenchmark.ts` | `runBenchmark.test.ts` | 성공 메트릭 shape; engine throw 시 error |
| ✅ | `src/native/safeExpoDevice.ts` | `safeExpoDevice.test.ts` | module missing → safe default |

#### Wave T3 — 상태·I/O

| ✅ | 소스 | 테스트 | 필수 `it` 케이스 |
|----|------|--------|------------------|
| ✅ | `src/storage/SessionStore.ts` | `SessionStore.test.ts` | create·append·list; corrupt JSON recovery |
| ✅ | `src/models/ModelPreferences.ts` | `ModelPreferences.test.ts` | get/set selectedModelId |
| ✅ | `src/agent/AgentPreferences.ts` | `AgentPreferences.test.ts` | automaticToolCalling persist |
| ✅ | `src/models/ModelManager.ts` | `ModelManager.test.ts` | verified 전까지 `initialize` 미호출; failed 시 파일 삭제 (§1.8) |
| ✅ | `src/agent/InferenceCoordinator.ts` | `InferenceCoordinator.test.ts` | `active` → `warmUp`; `T_idle` → hibernate; generation 중 abort (§1.12) |

#### Wave T4 — 통합

| ✅ | 소스 | 테스트 | 필수 `it` 케이스 |
|----|------|--------|------------------|
| ✅ | `src/agent/AgentRuntime.ts` | `AgentRuntime.test.ts` | mock send 1-turn; tool approval deny/approve; `stopGeneration`; restore+`MessageReplayer` |

#### Wave T5 — 컴포넌트

| ✅ | 소스 | 테스트 | 필수 `it` 케이스 |
|----|------|--------|------------------|
| ✅ | `src/components/ThinkingBlock.tsx` | `ThinkingBlock.test.tsx` | thinking 텍스트 표시; 접기/펼치기 |
| ✅ | `src/components/ToolApprovalSheet.tsx` | `ToolApprovalSheet.test.tsx` | Approve/Deny → callback |
| ✅ | `src/components/ChatInput.tsx` | `ChatInput.test.tsx` | 전송; streaming 중 disabled |
| ✅ | `src/components/ChatMessageList.tsx` | `ChatMessageList.test.tsx` | role별 bubble |

`app/(tabs)/**` — T7 Maestro mock-chat flow로 보조 (단위 테스트 최소화).

### 10.3 Phase 3 신규 모듈 (순방향 TDD)

| ✅ | 예정 소스 | 테스트 (선행) | 핵심 케이스 |
|----|-----------|---------------|-------------|
| ✅ | `src/skills/SkillParser.ts` | `SkillParser.test.ts` | frontmatter split; name/description validation; `run_js` → javascript kind; HTTPS URL |
| ✅ | `src/skills/registry.ts` | `registry.test.ts` | register; duplicate reject; enable/disable; unregister |
| ✅ | `src/skills/skillCatalog.ts` | `skillCatalog.test.ts` | catalog format; slash invoke; active skill block |
| ✅ | `PromptTemplateEngine.ts` | `PromptTemplateEngine.test.ts` | skill catalog append; active skill merge (§1.14) |
| ✅ | `AgentRuntime.ts` | `AgentRuntime.test.ts` | skill catalog in systemInstruction; slash strips prefix; URL import persist |
| ✅ | `src/skills/SkillStore.ts` | `SkillStore.test.ts` | save/load round-trip; corrupt JSON |
| ✅ | `src/skills/skillImport.ts` | `skillImport.test.ts` | GitHub blob→raw; HTTPS SKILL.md fetch parse |
| ✅ | `src/skills/JsSkillRunner.ts` | `JsSkillRunner.test.ts` | mock bridge; active skill; disabled skill |
| ✅ | `src/skills/jsSkillBridge.ts` | `jsSkillBridge.test.ts` | Gallery `run_js` args; network gate; bridge response |
| ✅ | `src/agent/tools/intentTools.ts` | `intentTools.test.ts` | share/clipboard handlers; approval classification |
| ✅ | `src/agent/tools/filterToolsByAllowed.ts` | `filterToolsByAllowed.test.ts` | `allowed-tools` frontmatter filter; `run_js` keep |
| ✅ | `src/media/imageAttachment.ts` | `imageAttachment.test.ts` | model image gate; image-only prompt default |
| ✅ | `AgentRuntime.ts` | `AgentRuntime.test.ts` | mock multimodal `imagePath` turn |

### 10.4 Phase 4 신규 모듈 (순방향 TDD)

| ✅ | 예정 소스 | 테스트 (선행) | 핵심 케이스 |
|----|-----------|---------------|-------------|
| ✅ | `src/mcp/validateMcpUrl.ts` | `validateMcpUrl.test.ts` | HTTPS only; kebab-case id; namespaced tool name |
| ✅ | `src/mcp/McpServerRegistry.ts` | `McpServerRegistry.test.ts` | register; duplicate reject; enable/disable; namespaced tools |
| ✅ | `src/mcp/mcpToolCatalog.ts` | `mcpToolCatalog.test.ts` | catalog format; disabled server exclusion |
| ✅ | `src/mcp/mock/MockMcpClient.ts` | `MockMcpClient.test.ts` | connect; listTools; callTool mock result |
| | `PromptTemplateEngine.ts` | `PromptTemplateEngine.test.ts` | MCP catalog append (§1.15) |
| | `AgentRuntime.ts` | `AgentRuntime.test.ts` | mock MCP tool execute round-trip |
| | `StreamableHttpMcpClient.ts` | `StreamableHttpMcpClient.test.ts` | tools/list + tools/call (mock fetch) |
| | `McpStore.ts` | `McpStore.test.ts` | AsyncStorage persist; corrupt JSON |

---

## Commands

```bash
# monorepo root
pnpm install

# TDD (Wave T0+)
pnpm test
pnpm typecheck

# JS dev server (mock mode default in __DEV__)
pnpm mobile start

# Android dev client (requires Android SDK / emulator, **JDK 17 or 21** — JDK 24+ breaks native prefab/CMake)
# First time: bash ../../scripts/setup-android-emulator.sh  → liteRTLM_E2B (8 GB RAM, E2B용)
pnpm mobile android   # default AVD: liteRTLM_E2B (not Pixel_9 2GB)

# iOS simulator dev client (requires Xcode)
pnpm mobile ios

# EAS development build (set real projectId in app.json extra.eas first)
cd apps/mobile && eas build --platform android --profile development

# typecheck / test (package)
pnpm mobile typecheck
pnpm mobile test
pnpm litertlm-native typecheck
```

환경 변수: `apps/mobile/.env.example` → `.env.local` (`EXPO_PUBLIC_LITERTLM_MODE=mock`).

