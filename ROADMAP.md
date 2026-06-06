# liteRTLM Roadmap

Expo dev client + LiteRT-LM + Gemma 4(E2B/E4B) **Agent Chat** 앱 구현 순서.

계약: [ARCHITECTURE.md](./ARCHITECTURE.md) §1  
참조: [.references/](./.references/)

---

## 목표 (North Star)

> iOS/Android에서 **완전 오프라인** Gemma 4 채팅·에이전트 경험을 Expo 앱으로 제공한다.  
> Google AI Edge Gallery의 추론·에이전트 패턴을 참고하되, UI/스택은 **React Native(Expo)** 로 재구현한다.

---

## Phase 0 — 검증·Scaffold (1–2주)

**목표:** 리스크 제거, monorepo 골격, 데스크톱에서 모델·프롬프트 스모크 테스트.

| # | 작업 | 산출물 | 완료 기준 |
|---|------|--------|-----------|
| 0.1 | Monorepo 초기화 | `apps/mobile`, `packages/litertlm-native` 디렉터리 | `pnpm` workspace + `create-expo-app` |
| 0.2 | LiteRT-LM CLI 설치·E2B 스모크 | `.references` 검증 노트 | 로컬에서 E2B 1-turn 대화 성공 |
| 0.3 | `expo-dev-client` 빌드 파이프라인 | `eas.json` development profile | Android emulator dev build 설치 |
| 0.4 | Native module skeleton + **Mock backend** | `litertlm-native` | RN mock mode streaming without model |
| 0.5 | Gallery Android + **iOS LLM 샘플** 리딩 | DESIGN.md · `.references` | Android Engine/KV; iOS는 [mediapipe-samples llm_inference/ios](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/llm_inference/ios) 임베딩 패턴 |
| 0.6 | Defensive design 검토 | ARCHITECTURE §1.7–1.11 | 계약 반영 완료 |
| 0.7 | **LiteRT-LM KV persist API** 스파이크 | `.references` 노트 | Kotlin/Swift `persist`/`restore` 가능 여부 · fallback 확정 |

**Phase 0 결정 (2026-06-06)**

- [x] Package manager: **pnpm** (monorepo workspace)
- [x] HF 다운로드: **`HF_TOKEN`** env — `Authorization: Bearer` 헤더로 Hub 파일 fetch (OAuth는 Phase 4 optional)
- [x] LiteRT-LM 버전 pin: **v0.13.0** (Android Gradle artifact + iOS SPM tag)

---

## Phase 1 — Core Chat (3–4주)

**목표:** E2B 단일 모델, Android 우선, 스트리밍 채팅 + 모델 다운로드.

| # | 작업 | 컴포넌트 |
|---|------|----------|
| 1.1 | LiteRT-LM Android Engine bridge | `litertlm-native` |
| 1.2 | `initialize` / `sendMessage` stream + **token batching** | bridge API §2.3, §1.7 |
| 1.3 | Chat UI (FlatList, input, streaming) — **mock mode default in dev** | `apps/mobile` |
| 1.4 | Model Manager — E2B download + **SHA-256 verify** (현재 JS `@noble/hashes` interim) | `apps/mobile` |
| 1.5 | SessionStore — 로컬 대화 저장 | `apps/mobile` |
| 1.6 | **PromptTemplateEngine** (system instruction, extraContext) | `apps/mobile` |
| 1.7 | GPU backend + Manifest config plugin | `litertlm-native` plugin |
| 1.8 | iOS Swift Engine bridge (parity) | `litertlm-native` ios ✅ |
| 1.9 | EAS dev build iOS simulator + live E2E | CI/manual ✅ |
| 1.10 | **InferenceCoordinator** — AppState `warmUp` on active | `apps/mobile` |
| 1.11 | **InferenceStateBridge** skeleton — `enterIdle`, lifecycle events | `litertlm-native` |
| 1.12 | **Native SHA-256 verify** — Android `MessageDigest` · iOS CryptoKit ✅ · verify progress | `litertlm-native` |

**Phase 1 완료 기준**

- ~~Android 실기기/에뮬레이터: E2B 다운로드 → live 채팅 → 앱 재시작 후 히스토리 유지~~ ✅ (2026-06-06, manual; 에뮬레이터는 CPU)
- ~~iOS Simulator: E2B live 채팅 → 앱 재시작 후 히스토리 유지~~ ✅ (2026-06-06, manual; CPU)

**의도적 제외:** Tools, Skills, MCP, multimodal, E4B default.

---

## Phase 2 — Agent & Gemma 4 완성 (3–4주)

**목표:** Function calling, Thinking Mode, E4B, sampler UI, KV persist/hibernate UX.

**구현 계획:** [.references/phase2-plan.md](./.references/phase2-plan.md)  
**전제:** Phase 1 완료 ✅ · Mock-first 개발 (`EXPO_PUBLIC_LITERTLM_MODE=mock`)

### Kickoff 체크리스트

- [x] Phase 2 계획 문서 (`phase2-plan.md`)
- [x] TypeScript 계약 확장 — `ToolDefinition`, `ToolCall`, approval 이벤트 ([ARCHITECTURE §2.3](./ARCHITECTURE.md))
- [x] JS tool registry·built-in 스켈레톤 (`apps/mobile/src/agent/tools/`)
- [x] UI 스켈레톤 — `ThinkingBlock`, `ToolApprovalSheet`
- [x] S1 Mock tools + approval UI + Settings toggle (`mock-tool-smoke`)
- [x] S2 Native `@Tool` + Thinking UI + Sampler settings
- [x] 2.1 live E2E — LLM → time tool (`getCurrentTime`) ✅ (manual)
- [x] 2.4 Thinking UI — `ThinkingBlock` 표시 ✅ (manual)
- [x] 2.3 live — `openUrl` approval E2E ✅ iOS iPhone 16e · Android `liteRTLM_E2B` (manual 2026-06-06)
- [x] Phase 2 S4 — KV persist/hibernate + Snapshot UI + Smart Eviction
- [x] Phase 2 S4 iOS live E2E — iPhone 16e: build + hibernate/restore ✅ (manual 2026-06-06)

### 작업표

| # | 작업 | 컴포넌트 | Wave |
|---|------|----------|------|
| 2.1 | Native `@Tool` — built-in 3개 (time, device info, open URL) | `litertlm-native` | 1 |
| 2.2 | `automaticToolCalling` + JS manual mode 토글 | bridge + Settings | 1 |
| 2.3 | **Tool approval UI** + `onToolApprovalRequired` / `approveToolCall` | `apps/mobile` | 2 |
| 2.4 | Thinking Mode UI (`enable_thinking`) | `apps/mobile` | 2 |
| 2.5 | E4B manifest + **기기 RAM gate** (`deviceRam.ts`) | `apps/mobile` | 2 ✅ |
| 2.6 | Sampler settings (temperature, top-k) — Prompt Lab lite | Settings | 1 |
| 2.7 | Generation abort, 백그라운드 처리 | Coordinator + native | 1 ✅ |
| 2.8 | Benchmark 화면 (prefill/decode rough metrics) | `apps/mobile` | 2 ✅ |
| 2.9 | **`persistSession` / `restoreSession`** + `.kvsnapshot` | `litertlm-native` | 3 ✅ |
| 2.10 | **Smart Eviction** — `onTrimMemory`, memory warning | `litertlm-native` | 3 ✅ |
| 2.11 | **Snapshot UI** + loading skeleton (`restoring`) | `apps/mobile` | 3 ✅ |
| 2.12 | Background **Idle → Hibernate** timer (`T_idle`) | InferenceCoordinator | 3 ✅ |

**레퍼런스:** [.references/gallery-function-calling.md](./.references/gallery-function-calling.md) · [.references/phase0-kv-persist-spike.md](./.references/phase0-kv-persist-spike.md)

---

## TDD Rollout — 테스트 인프라·레거시 회귀 (Phase 2.5)

**목표:** ARCHITECTURE §1.13 준수. 기존 Phase 1–2 코드에 **역방향 TDD**(실패 테스트 → 통과)로 회귀 스위트 구축. 이후 Phase 3+는 **순방향 TDD**(테스트 선행)만 허용.

**전제:** Mock-first (`EXPO_PUBLIC_LITERTLM_MODE=mock`) · 수동 live E2E는 Wave T4 완료 후 보조.

### Wave 요약

| Wave | 범위 | 완료 기준 |
|------|------|-----------|
| **T0** | Vitest/Jest, 루트 `pnpm test`, CI | PR에서 `test`+`typecheck` green |
| **T1** | `litertlm-native` 순수 TS | §1.7·§1.11 회귀 Vitest |
| **T2** | `apps/mobile` 순수 로직 | §1.8·§1.9·§1.10 단위 커버 |
| **T3** | storage·coordinator·ModelManager | AsyncStorage/RN mock 통합 |
| **T4** | AgentRuntime + MockEngine E2E | `mock-tool-smoke` Vitest 흡수 |
| **T5** | RN 컴포넌트 | jest-expo + Testing Library |
| **T6** | 스모크 스크립트 제거 | `mock-smoke`/`mock-tool-smoke` 삭제 |
| **T7** | Maestro (선택) | mock mode 채팅 1-flow |
| **T8** | Kotlin/Swift (선택) | Robolectric/XCTest 핵심 1–2건 |

상세 테스트 케이스: [apps/mobile/DESIGN.md](./apps/mobile/DESIGN.md) §10 · [packages/litertlm-native/DESIGN.md](./packages/litertlm-native/DESIGN.md) §테스트.

### T0 — 인프라 (1–2일)

| # | 작업 | 산출물 |
|---|------|--------|
| T0.1 | 루트 `package.json` — `test`, `typecheck` 스크립트 | `pnpm test` = 전 워크스페이스 |
| T0.2 | `packages/litertlm-native` — Vitest + `test` 스크립트 | `vitest.config.ts`, `src/**/*.test.ts` |
| T0.3 | `apps/mobile` — Vitest(node) + Jest(jest-expo) 이중 설정 또는 Vitest 통합 | `test` 스크립트 |
| T0.4 | `.github/workflows/ci.yml` — Node 20, `pnpm i`, `test`, `typecheck` | PR 게이트 |
| T0.5 | 첫 통과 테스트 1건 (스캐폴딩 검증) | `PromptTemplateEngine.test.ts` Red→Green |

### T1 — `litertlm-native` (의존성 순)

| 순서 | 소스 | 테스트 파일 | 핵심 케이스 (§) |
|------|------|-------------|----------------|
| 1 | `src/mock/TokenBatcher.ts` | `TokenBatcher.test.ts` | maxTokens flush, interval flush, kind 경계 flush (§1.7) |
| 2 | `src/conversationConfigJson.ts` | `conversationConfigJson.test.ts` | `automaticToolCalling` 기본 true, sampler 직렬화 |
| 3 | `src/mock/mockToolTriggers.ts` | `mockToolTriggers.test.ts` | time/url/device 트리거 매칭 |
| 4 | `src/mock/MockEngine.ts` | `MockEngine.test.ts` | streaming, `onMessageComplete`, thinking chunk |
| 5 | `src/mock/MockEngine.ts` (tools) | `MockEngine.tools.test.ts` | read / approval / manual loop (§1.10) — **mock-tool-smoke 흡수** |
| 6 | `src/verifySha256.ts` | `verifySha256.test.ts` | native unavailable 시 JS fallback 표면 (mock) |
| 7 | `src/LitertLm.types.ts` | — | 타입만; 런타임 테스트 불필요 |

`NativeEngine.ts` / `LitertLmModule.ts`: Expo native binding — **T4 AgentRuntime 통합**으로 간접 검증.

### T2 — `apps/mobile` 순수 로직 (의존성 순)

| 순서 | 소스 | 테스트 파일 | 핵심 케이스 (§) |
|------|------|-------------|----------------|
| 1 | `src/agent/PromptTemplateEngine.ts` | `PromptTemplateEngine.test.ts` | default system, custom instruction, `enable_thinking` extraContext (§1.9) |
| 2 | `src/agent/StreamChunk.ts` | `StreamChunk.test.ts` | token/thinking/complete 파싱·누적 |
| 3 | `src/agent/tools/types.ts` + `registry.ts` | `registry.test.ts` | register, duplicate, policy lookup |
| 4 | `src/agent/tools/builtins.ts` | `builtins.test.ts` | read/write/destructive 분류 (§1.10) |
| 5 | `src/models/manifest.ts` | `manifest.test.ts` | E2B/E4B sha256·minRamMb 존재 |
| 6 | `src/models/deviceRam.ts` | `deviceRam.test.ts` | RAM gate — mock `totalMemory` |
| 7 | `src/models/verifyModel.ts` | `verifyModel.test.ts` | corrupt hash → fail; match → ok (§1.8) |
| 8 | `src/agent/MessageReplayer.ts` | `MessageReplayer.test.ts` | user turn count, empty skip, replay 호출 횟수 |
| 9 | `src/agent/deviceProfile.ts` | `deviceProfile.test.ts` | backend·RAM 프로필 선택 |
| 10 | `src/benchmark/runBenchmark.ts` | `runBenchmark.test.ts` | 메트릭 집계·에러 경로 |
| 11 | `src/native/safeExpoDevice.ts` | `safeExpoDevice.test.ts` | expo-device 없을 때 fallback |

### T3 — 상태·I/O 레이어

| 순서 | 소스 | 테스트 파일 | 핵심 케이스 (§) |
|------|------|-------------|----------------|
| 1 | `src/storage/SessionStore.ts` | `SessionStore.test.ts` | save/load, corrupt JSON, multi-session |
| 2 | `src/models/ModelPreferences.ts` | `ModelPreferences.test.ts` | selected model persist |
| 3 | `src/agent/AgentPreferences.ts` | `AgentPreferences.test.ts` | automaticToolCalling toggle |
| 4 | `src/models/ModelManager.ts` | `ModelManager.test.ts` | download state machine, verify gate (§1.8) |
| 5 | `src/agent/InferenceCoordinator.ts` | `InferenceCoordinator.test.ts` | AppState active→warmUp, idle timer, hibernate (§1.12) |

### T4 — AgentRuntime 통합

| 순서 | 소스 | 테스트 파일 | 핵심 케이스 |
|------|------|-------------|-------------|
| 1 | `src/agent/AgentRuntime.ts` | `AgentRuntime.test.ts` | MockEngine send, tool approval flow, abort, restore+replay |

### T5 — RN 컴포넌트 (jest-expo)

| 순서 | 소스 | 테스트 파일 | 핵심 케이스 |
|------|------|-------------|-------------|
| 1 | `src/components/ThinkingBlock.tsx` | `ThinkingBlock.test.tsx` | collapsed/expanded, streaming text |
| 2 | `src/components/ToolApprovalSheet.tsx` | `ToolApprovalSheet.test.tsx` | approve/deny 콜백 |
| 3 | `src/components/ChatInput.tsx` | `ChatInput.test.tsx` | submit, disabled during stream |
| 4 | `src/components/ChatMessageList.tsx` | `ChatMessageList.test.tsx` | user/assistant/thinking 렌더 |

`app/(tabs)/**`: 라우터 화면 — T5 후 **Maestro(T7)** 또는 snapshot 최소화.

### T6–T8 — 정리·확장

- **T6:** `scripts/mock-smoke.ts`, `mock-tool-smoke.ts` 삭제; DESIGN Commands 갱신.
- **T7:** `.maestro/flows/mock-chat.yaml` — mock mode 1-turn (선택, Phase 3 전).
- **T8:** `TokenBatcher.kt/swift`, `Sha256Verifier` — 플랫폼 단위 1건씩 (선택).

### Phase 3+ TDD 규칙

Phase 3 작업(예: `SKILL.md` parser)은 ROADMAP 항목마다 **테스트 파일 경로를 먼저 PR에 포함**한다. 구현 PR에 테스트 diff가 없으면 merge 불가 (ARCHITECTURE §1.13).

---

## Phase 3 — Agent Skills & Multimodal (4–6주)

**목표:** Gallery Skills 패턴 이식, 이미지 입력.

| # | 작업 |
|---|------|
| 3.1 | `SKILL.md` 파서 + skill registry |
| 3.2 | Text-only skills (system prompt merge) |
| 3.3 | JS skills — hidden WebView (`ai_edge_gallery_get_result` 호환) |
| 3.4 | Native intent tools (expo-linking, share, clipboard) |
| 3.5 | Ask Image — camera/gallery → `Content.ImageFile` |
| 3.6 | Skill marketplace UI (URL import) |

**레퍼런스:** [.references/gallery-agent-skills.md](./.references/gallery-agent-skills.md)

---

## Phase 4 — Connected Agent (optional, 4+주)

**목표:** MCP, 알림, polish.

| # | 작업 |
|---|------|
| 4.1 | MCP client (Streamable HTTP) — ARCHITECTURE §1.1 준수 |
| 4.2 | Local notifications + skill deep link |
| 4.3 | Hugging Face OAuth (Gallery 패턴) — `HF_TOKEN` 대안, optional |
| 4.4 | App Store / Play 내부 테스트 배포 |
| 4.5 | Audio input (Gemma 4 E2B audio) — 기기·모델 검증 후 |
| 4.6 | **Predictive warm-up** — Notification Extension / App Intent pre-warm | optional |

---

## 마일스톤 타임라인 (개략)

```
2026 Q2  Phase 0 ──► Phase 1 (Android chat)
2026 Q3  Phase 1 iOS ──► Phase 2 (Agent)
2026 Q4  Phase 3 (Skills) ──► Phase 4 (optional)
```

일정은 Swift API 성숙도·인력에 따라 조정.

---

## 리스크 레지스터

| ID | 리스크 | 영향 | 완화 |
|----|--------|------|------|
| R1 | iOS Swift API Early Preview | iOS 지연 | Android first; CPU fallback |
| R2 | E4B RAM on mid devices | crash/OOM | `minRamMb` gate, E2B default |
| R3 | Expo + SPM/CocoaPods 충돌 | iOS build fail | LiteRT-LM SPM config plugin; [mediapipe-samples](../../.references/mediapipe-llm-inference-ios.md) Pod 패턴 참고·충돌 검증 |
| R4 | Model download size (2.5GB+) | UX 이탈 | Wi-Fi only option, resume download |
| R5 | RN bridge streaming perf | choppy UI | **§1.7 token batching** (50ms / 8 tok) |
| R6 | HF license / Gemma terms | 배포 제약 | 앱 내 라이선스 표시, accept flow |
| R7 | Corrupted model download | native crash | **§1.8 SHA-256 verify** before Engine; Phase **1.12** native streaming digest (JS verify는 E2B 2.5GB+ UX 병목) |
| R8 | Tool misuse (auto exec) | UX/보안 | **§1.10 approval UI** |
| R9 | Slow UI dev cycle | 생산성 | **§1.11 mock backend** |
| R10 | Memory pressure (OOM) / OS kill | crash, UX | **§1.12** 3-tier lifecycle, Smart Eviction, KV persist |
| R11 | KV persist API gap (Kotlin/Swift) | restore slow | Phase 0.7 spike; **message replay fallback** |

---

## 성공 지표 (Phase 1–2)

- [ ] Cold start → first token < 3s (E2B GPU, 플래그십 Android)
- [ ] 10-turn conversation without crash
- [x] Tool call round-trip < 5s (simple native tool) — `getCurrentTime` live ✅ (manual)
- [ ] Zero network during inference (packet capture spot check)
- [ ] Mock mode: chat UI full flow without model load — **T4 AgentRuntime + T7 Maestro**
- [ ] Download corrupt file → verify fails → Engine never called — **T2 `verifyModel` + T3 ModelManager**
- [ ] E2B post-download SHA-256 verify: native path (1.12) — 실기기에서 download 대비 체감 지연 없음 (에뮬레이터 JS interim은 제외)
- [ ] Stream UI: no jank at 50+ tok/s decode (batched deltas)
- [ ] Background → Idle; memory warning → Hibernated (no crash) — **T3 InferenceCoordinator + T8 native**
- [ ] Restore from KV snapshot: 10-turn session TTFT < restore-from-scratch prefill case — **T4 + manual**

---

## 다음 액션 (즉시)

1. ~~Phase 1 Android/iOS live E2E~~ ✅ (2026-06-06)
2. ~~Phase 2 kickoff — 계약·스켈레톤·`phase2-plan.md`~~ ✅ (2026-06-06)
3. ~~Phase 2 S1~~ ✅ · ~~Phase 2 S2 (native tools + thinking + sampler)~~ ✅
4. ~~Phase 2 live E2E — time tool + Thinking UI~~ ✅ (manual)
5. ~~Phase 2 S3~~ ✅ — E4B RAM gate + abort + Benchmark (2026-06-06)
6. ~~Phase 2 S3 iOS live E2E~~ ✅ — iPhone 16e (2026-06-06)
7. ~~Phase 2 S3 Android live E2E~~ ✅ — `liteRTLM_E2B` AVD (2026-06-06)
8. ~~Phase 2 S4~~ ✅ — KV persist/hibernate stack + Snapshot UI + Smart Eviction (2026-06-06)
9. ~~Phase 2 S4 iOS live E2E~~ ✅ — iPhone 16e: build + hibernate/restore (2026-06-06)
10. ~~**TDD Wave T0–T6**~~ ✅ — Vitest/Jest + CI + 레거시 회귀 + mock-smoke 흡수 (2026-06-06)
11. **Phase 3 kickoff** — Skills registry + `SKILL.md` parser (**테스트 선행**)
12. **TDD T7 (선택)** — Maestro `.maestro/flows/mock-chat.yaml` on device
13. **TDD T8 (선택)** — Kotlin `ConversationConfigJson` JUnit
