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
| 1.4 | Model Manager — E2B download + **SHA-256 verify** | `apps/mobile` |
| 1.5 | SessionStore — 로컬 대화 저장 | `apps/mobile` |
| 1.6 | **PromptTemplateEngine** (system instruction, extraContext) | `apps/mobile` |
| 1.7 | GPU backend + Manifest config plugin | `litertlm-native` plugin |
| 1.8 | iOS Swift Engine bridge (parity) | `litertlm-native` ios |
| 1.9 | EAS dev build iOS simulator | CI/manual |
| 1.10 | **InferenceCoordinator** — AppState `warmUp` on active | `apps/mobile` |
| 1.11 | **InferenceStateBridge** skeleton — `enterIdle`, lifecycle events | `litertlm-native` |

**Phase 1 완료 기준**

- Android 실기기/에뮬레이터: E2B 다운로드 → GPU 채팅 → 앱 재시작 후 히스토리 유지
- iOS Simulator: E2B CPU/GPU 채팅 (Swift API 안정성에 따라 CPU fallback 허용)

**의도적 제외:** Tools, Skills, MCP, multimodal, E4B default.

---

## Phase 2 — Agent & Gemma 4 완성 (3–4주)

**목표:** Function calling, Thinking Mode, E4B, sampler UI.

| # | 작업 |
|---|------|
| 2.1 | Native `@Tool` — 2–3개 built-in (time, device info, open URL) |
| 2.2 | `automaticToolCalling` + JS manual mode 토글 |
| 2.3 | **Tool approval UI** + `onToolApprovalRequired` / `approveToolCall` |
| 2.4 | Thinking Mode UI (`enable_thinking`) |
| 2.5 | E4B model manifest + 기기 RAM gate |
| 2.6 | Sampler settings (temperature, top-k) — Prompt Lab lite |
| 2.7 | Generation abort, 백그라운드 처리 |
| 2.8 | Benchmark 화면 (prefill/decode rough metrics) |
| 2.9 | **`persistSession` / `restoreSession`** + `.kvsnapshot` | `litertlm-native` |
| 2.10 | **Smart Eviction** — Android `onTrimMemory`, iOS memory warning | `litertlm-native` |
| 2.11 | **Snapshot UI** + loading skeleton (`restoring`) | `apps/mobile` |
| 2.12 | Background **Idle → Hibernate** timer (`T_idle`) | InferenceCoordinator |

**레퍼런스:** [.references/gallery-function-calling.md](./.references/gallery-function-calling.md)

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
| R7 | Corrupted model download | native crash | **§1.8 SHA-256 verify** before Engine |
| R8 | Tool misuse (auto exec) | UX/보안 | **§1.10 approval UI** |
| R9 | Slow UI dev cycle | 생산성 | **§1.11 mock backend** |
| R10 | Memory pressure (OOM) / OS kill | crash, UX | **§1.12** 3-tier lifecycle, Smart Eviction, KV persist |
| R11 | KV persist API gap (Kotlin/Swift) | restore slow | Phase 0.7 spike; **message replay fallback** |

---

## 성공 지표 (Phase 1–2)

- [ ] Cold start → first token < 3s (E2B GPU, 플래그십 Android)
- [ ] 10-turn conversation without crash
- [ ] Tool call round-trip < 5s (simple native tool)
- [ ] Zero network during inference (packet capture spot check)
- [ ] Mock mode: chat UI full flow without model load
- [ ] Download corrupt file → verify fails → Engine never called
- [ ] Stream UI: no jank at 50+ tok/s decode (batched deltas)
- [ ] Background → Idle; memory warning → Hibernated (no crash)
- [ ] Restore from KV snapshot: 10-turn session TTFT < restore-from-scratch prefill case

---

## 다음 액션 (즉시)

1. Phase 1.1: Android `EngineBridge` → LiteRT-LM `Engine.initialize` / `sendMessageAsync` 실연결
2. Phase 1.4: manifest `sha256` pin + streaming verify (multi-GB)
3. `pnpm mobile start` → Chats → New chat → mock 스트리밍 확인
4. Android dev rebuild: `pnpm mobile android` (Kotlin bridge 변경 후)
