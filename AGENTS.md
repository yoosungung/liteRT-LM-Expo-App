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
| `.github/workflows/ci.yml` | PR/push CI(apps `pytest`·`ruff`·`mypy` | `.github/workflows/` |

규칙:

- **ARCHITECTURE.md §1 (계약) vs §2 이후 (형태).** §1은 "지켜야 하는 규칙(왜)" — 짧고 단정적. §2 이후는 "그 규칙을 구현하는 모양(어떻게)" — 스키마·필드·이벤트 목록. 규칙이 바뀌면 §1을 먼저 고치고 §2 이후를 따라 고친다. 두 부분을 다른 파일로 쪼개면 동기화 부담만 늘어 단일 문서로 둔다.
- **ARCHITECTURE.md vs `<comp>/DESIGN.md`.** ARCHITECTURE는 컴포넌트 *간*, 서브폴더 DESIGN은 해당 컴포넌트 *내부*. 두 쪽에 같은 내용을 적지 않는다.

## 2. 수행 방법 (How we work in this repo)

- 계획·설계·구현 변경은 해당 문서를 먼저(또는 함께) 고친다: 계획 변경 → `ROADMAP.md`, 설계·규칙 변경 → `ARCHITECTURE.md`(또는 해당 컴포넌트의 `DESIGN.md`), 워크플로 변경 → 이 파일.
- 코드가 처음 들어오는 컴포넌트는 그 폴더의 `DESIGN.md`를 함께 만들고, 이 파일의 §1 표 또는 `ARCHITECTURE.md` §1 계약사항을 필요 시 갱신한다.
- 컴포넌트에 첫 코드가 들어오면, 해당 폴더의 `DESIGN.md`에 **`## Commands`** 섹션을 추가해 빌드/실행/테스트 방법을 기록한다. 그 전까지는 비워둔다(존재하지 않는 명령을 만들어 적지 않는다).
- 한국어/영어 혼용을 허용한다. 한 문서 내 일관성만 지킨다(현재 AGENTS/ARCHITECTURE/ROADMAP/DESIGN은 한국어 본문 + 영어 식별자).

## 3. Status

**Phase 1 Core Chat 진행 중 (2026-06-06~).** Android 우선, mock mode default.

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
| Phase 1.1 Android bridge | LiteRT-LM Gradle + Engine bridge 골격 |
| Phase 1.4–1.6 | ModelManager, SessionStore, PromptTemplateEngine |

다음: Android live Engine wiring, E2B download E2E, iOS bridge (1.8).
