# AGENTS.md

This file provides guidance to AI coding assistants (Claude Code, Codex, Gemini, ...) when working with code in this repository. `CLAUDE.md`와 `GEMINI.md`는 이 파일로의 심볼릭 링크다 — 정본은 `AGENTS.md` 하나.

## 1. Documentation layout (문서 용도)

각 문서는 하나의 명확한 용도만 가진다. 같은 내용을 여러 문서에 중복하지 않는다. 한쪽을 고칠 때 다른 쪽이 같이 바뀌어야 한다면 잘못 나눈 것이므로 합치거나 한쪽이 다른 쪽을 참조하게 만든다.

| 파일 | 용도 | 위치 |
|------|------|------|
| `AGENTS.md` (이 파일, 정본) ← `CLAUDE.md`, `GEMINI.md` 심볼릭 | 수행 방법 + 문서 레이아웃 + 현황 | 루트 |
| `ARCHITECTURE.md` | **계약사항(불변 규칙)** + 컴포넌트 *간* 인터페이스 형태(스키마·레이아웃·이벤트) | 루트 |
| `README.md` | 프로젝트 소개 + Phase 1 로컬 quickstart | 루트 |
| `ROADMAP.md` | 수행 계획(마일스톤·순서·미결정 항목) | 루트 |
| `<comp>/DESIGN.md` | 컴포넌트 *내부* 설계 + `## Commands` (빌드/실행/테스트) | `apps/`, `packages/` ... |
| `.references/` | 외부 문서·레퍼런스 앱 패턴 (비계약, 참고용) | `.references/` |
| `.github/workflows/ci.yml` | PR/push CI (`pnpm test` · `pnpm typecheck`) | `.github/workflows/` |

규칙:

- **ARCHITECTURE.md §1 (계약) vs §2 이후 (형태).** §1은 "지켜야 하는 규칙(왜)" — 짧고 단정적. §2 이후는 "그 규칙을 구현하는 모양(어떻게)" — 스키마·필드·이벤트 목록. 규칙이 바뀌면 §1을 먼저 고치고 §2 이후를 따라 고친다. 두 부분을 다른 파일로 쪼개면 동기화 부담만 늘어 단일 문서로 둔다.
- **ARCHITECTURE.md vs `<comp>/DESIGN.md`.** ARCHITECTURE는 컴포넌트 *간*, 서브폴더 DESIGN은 해당 컴포넌트 *내부*. 두 쪽에 같은 내용을 적지 않는다.

## 2. 수행 방법 (How we work in this repo)

- 계획·설계·구현 변경은 해당 문서를 먼저(또는 함께) 고친다: 계획 변경 → `ROADMAP.md`, 설계·규칙 변경 → `ARCHITECTURE.md`(또는 해당 컴포넌트의 `DESIGN.md`), 워크플로 변경 → 이 파일.
- 코드가 처음 들어오는 컴포넌트는 그 폴더의 `DESIGN.md`를 함께 만들고, 이 파일의 §1 표 또는 `ARCHITECTURE.md` §1 계약사항을 필요 시 갱신한다.
- 컴포넌트에 첫 코드가 들어오면, 해당 폴더의 `DESIGN.md`에 **`## Commands`** 섹션을 추가해 빌드/실행/테스트 방법을 기록한다. 그 전까지는 비워둔다(존재하지 않는 명령을 만들어 적지 않는다).
- 한국어/영어 혼용을 허용한다. 한 문서 내 일관성만 지킨다(현재 AGENTS/ARCHITECTURE/ROADMAP/DESIGN은 한국어 본문 + 영어 식별자).

### 2.1 TDD (필수 — ARCHITECTURE §1.13)

**신규·변경 로직은 테스트 없이 구현하지 않는다.** 예외는 ARCHITECTURE §1.13.2 표에 한정.

#### AI·인간 공통 워크플로

1. **요구사항 → 실패 테스트** — `*.test.ts` / `*.test.tsx`에 `describe`·`it`으로 기대 동작을 먼저 적는다.
2. **`pnpm test` Red 확인** — 의도적으로 실패하는지 본다.
3. **최소 구현** — 테스트만 통과시키는 코드를 추가한다.
4. **`pnpm test` Green** — 해당 패키지·루트 전체 통과.
5. **리팩터** — 테스트 유지하며 정리. DESIGN.md 테스트 매트릭스에 ✅ 표시.

#### 파일 배치

| 패키지 | 위치 | 러너 |
|--------|------|------|
| `packages/litertlm-native` | `src/**/*.test.ts` | Vitest (`node`) |
| `apps/mobile` 순수 로직 | `src/**/*.test.ts` | Vitest (`node`) |
| `apps/mobile` RN 컴포넌트 | `src/**/*.test.tsx` | Jest + `jest-expo` |

#### PR 체크리스트 (자가 검증)

- [ ] ARCHITECTURE §1에 영향 있으면 **회귀 테스트** 추가
- [ ] `pnpm test` · `pnpm typecheck` 통과
- [x] 기존 `mock-smoke` 시나리오 Vitest 흡수 · 스크립트 삭제 ✅

롤아웃 순서: [ROADMAP.md](./ROADMAP.md) **TDD Rollout** (Wave T0 → T8).

## 3. Status

**Phase 4 S1 완료 (2026-06-06).** MCP·알림·HF OAuth·audio·EAS internal-test·warm-up ✅

| 항목 | 상태 |
|------|------|
| `.references/` | Expo, LiteRT-LM, Gemma 4, Gallery + **Phase 0 spike 노트** |
| `ARCHITECTURE.md` | 계약 + Bridge/Agent API (**§1.7–1.12** 방어적·메모리 설계) |
| `ROADMAP.md` | Phase 0–4 |
| Phase 0 결정 | **pnpm**, **`HF_TOKEN`**, LiteRT-LM **v0.13.0** |
| Phase 0.1 monorepo | `pnpm` workspace, `apps/mobile` Expo SDK 56 |
| Phase 0.3 dev client | `expo-dev-client`, `eas.json` development profile |
| Phase 0.4 mock module | `packages/litertlm-native` JS MockEngine + native skeleton |
| Phase 0.2 CLI 스모크 | **완료** — E2B 1-turn (`Hello!`), `.references/phase0-cli-smoke.md` |
| Phase 0.5 / 0.7 | Gallery·KV persist spike 노트 |
| Phase 1.3 Chat UI | Expo Router, mock mode default |
| Phase 1.1 Android bridge | LiteRT-LM **0.13.0** Gradle + `Engine.sendMessageAsync` live wiring |
| Phase 1.2 NativeEngine | JS `NativeEngine` + `createEngine('live')` |
| Phase 1.4–1.6 | ModelManager (SHA-256 pin+verify), SessionStore, PromptTemplateEngine |
| Phase 1.10–1.11 | InferenceCoordinator + `warmUp`/`persistSession` skeleton |
| Phase 1.12 | Native SHA-256 verify — **Android** `MessageDigest` · **iOS** CryptoKit ✅ |
| Phase 1.8 | iOS Swift Engine bridge — LiteRT-LM **0.13.0** SPM + `EngineBridge` parity ✅ |
| Phase 1 Android live E2E | **완료** — E2B download → live 채팅 → force-stop 재시작 후 히스토리 유지 (manual 2026-06-06) |
| Phase 1.9 iOS live E2E | **완료** — Simulator → E2B download → live 채팅 → 재시작 후 히스토리 유지 (manual 2026-06-06) |
| Phase 2 S1 | **완료** — Mock tool loop, approval UI, Settings toggle |
| Phase 2 S2 | **완료** — Native `@Tool` (Kotlin/Swift), Thinking UI, Sampler settings |
| Phase 2.1 live tool E2E | **완료** — LLM → `getCurrentTime` tool 호출 확인 (manual) |
| Phase 2.4 Thinking UI | **완료** — `ThinkingBlock` 스트리밍·저장 표시 확인 (manual) |
| Phase 2 S3 | **완료** — E4B RAM gate, generation abort (native+Stop), Benchmark 탭 |
| Phase 2 S3 iOS live E2E | **완료** — iPhone **16e** Simulator: E2B, tools, `openUrl` approval, Stop, Benchmark (manual 2026-06-06) |
| Phase 2 S3 Android live E2E | **완료** — `liteRTLM_E2B` AVD (8GB): E2B, tools, `openUrl` approval, Stop, Benchmark (manual 2026-06-06) |
| Phase 2 S4 | **완료** — KV snapshot metadata + message replay fallback, Smart Eviction, Snapshot UI, Idle→Hibernate |
| Phase 2 S4 iOS live E2E | **완료** — iPhone **16e** Simulator: build, hibernate/restore, restoring UI (manual 2026-06-06) |
| Phase 2 S4 Android live E2E | **완료** — `liteRTLM_E2B` AVD: hibernate/restore, restoring UI (manual 2026-06-06) |
| TDD T0–T6 | **완료** — `pnpm test` 103건 (Vitest+Jest) · CI · mock-smoke 흡수 |
| Phase 3 kickoff | **완료** — `phase3-plan.md`, `SkillParser`, `SkillRegistry` + tests |
| Phase 3 S1 | **완료** — `skillCatalog`, PromptTemplateEngine merge, AgentRuntime invoke |
| Phase 3 S2 | **완료** — Skills tab, `skillImport`, `SkillStore`, bundled `fitness-coach` |
| Phase 3 S3 | **완료** — `run_js` tool, `JsSkillRunner`, `JsSkillHost`, bundled `hash-demo` |
| Phase 3 S3 live E2E | **완료** — iOS·Android `hash-demo` / `run_js` (manual 2026-06-06) |
| Phase 3 S4 | **완료** — intent tools (share/clipboard), Ask Image (`Content.ImageFile`) |
| Phase 3 S4 live E2E | **완료** — iOS·Android intent tools + camera/gallery Ask Image (manual 2026-06-06) |
**Phase 4 S1 (2026-06-06).** 4.1–4.6 TDD 구현 ✅ · live MCP E2E는 manual 보조.

| Phase 4 kickoff | **완료** — `phase4-plan.md`, §1.15/§2.12, `McpServerRegistry`, `MockMcpClient` + tests |
| Phase 4 S1 | **완료** — MCP client/store/catalog, Connected tab, notifications, HF OAuth, audio, EAS internal-test, warm-up |
