# liteRTLM

**온디바이스 Gemma 4 Agent Chat** — Expo(React Native) + LiteRT-LM.

Android·iOS에서 Gemma 4 (E2B, E4B)를 휴대폰 내부에서 실행하고, 멀티턴 채팅·에이전트 도구를 **오프라인·프라이버시 우선**으로 제공하는 앱.

## 왜 이 프로젝트인가

- [Google AI Edge Gallery](https://github.com/google-ai-edge/gallery)는 Kotlin/Swift 네이티브 쇼케이스 앱이다.
- **liteRTLM**은 동일한 [LiteRT-LM](https://ai.google.dev/edge/litert-lm) 추론 스택을 쓰되, **Expo dev client + React Native**로 Agent Chat UX를 구현한다.
- 추론·tool 선택은 기기 내부; 네트워크는 모델 다운로드·(선택) MCP에만 사용 ([ARCHITECTURE.md](./ARCHITECTURE.md) §1).

## 기술 스택

| Layer | Technology |
|-------|------------|
| UI / Agent UX | Expo SDK, React Native, TypeScript |
| Dev workflow | `expo-dev-client`, EAS Build (optional) |
| On-device LLM | LiteRT-LM, Gemma 4 E2B/E4B (`.litertlm`) |
| Native bridge | Expo Modules API (`packages/litertlm-native`) |

## 저장소 구조

```
apps/mobile/                 # Expo Agent Chat app
packages/litertlm-native/    # LiteRT-LM Expo native module
.references/                 # 외부 문서·패턴 정리 (참고용)
ARCHITECTURE.md              # 계약 + 컴포넌트 간 API
ROADMAP.md                   # Phase별 구현 계획
```

## 문서

| 문서 | 용도 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 불변 계약, Bridge/Agent API (**§1.13 TDD**) |
| [ROADMAP.md](./ROADMAP.md) | Phase 0–4 + **TDD Rollout** |
| [.references/](./.references/) | Expo, LiteRT-LM, Gallery 참조 |
| [apps/mobile/DESIGN.md](./apps/mobile/DESIGN.md) | 모바일 앱 내부 설계 |
| [packages/litertlm-native/DESIGN.md](./packages/litertlm-native/DESIGN.md) | 네이티브 모듈 설계 |

## Phase 1 Quickstart (로컬)

### 사전 요구

- Node.js 20+, **pnpm**, Android Studio (Android) / Xcode (iOS)
- Expo account (EAS 사용 시)
- **Hugging Face read token** — `HF_TOKEN` env (모델 다운로드·CLI 스모크)
- LiteRT-LM CLI (모델 스모크 테스트용, optional)

### 1. Monorepo + mock 앱 (Phase 0)

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env.local   # EXPO_PUBLIC_LITERTLM_MODE=mock

pnpm mobile start          # JS 번들
pnpm mobile android        # dev client (첫 빌드는 시간 소요)
```

앱 화면에서 **Send (mock)** → 스트리밍 응답 확인 (모델 파일 불필요).

### 2. 테스트 (TDD — Wave T0+)

```bash
pnpm test          # 전 워크스페이스 (Vitest/Jest)
pnpm typecheck     # TypeScript
```

신규·변경 로직은 **테스트 선행** ([ARCHITECTURE.md](./ARCHITECTURE.md) §1.13). 롤아웃 순서: [ROADMAP.md](./ROADMAP.md) TDD Rollout.

### 3. LiteRT-LM CLI로 모델 확인 (선택)

```bash
# LiteRT-LM CLI 설치 후 (HF gated repo)
export HF_TOKEN=hf_...   # read token, 저장소에 커밋 금지
litert-lm run --from-huggingface-repo=litert-community/gemma-4-E2B-it-litert-lm \
  gemma-4-E2B-it.litertlm --prompt="Hello"
```

자세한 절차: [.references/phase0-cli-smoke.md](./.references/phase0-cli-smoke.md)

### 4. EAS development build (optional)

```bash
cd apps/mobile
eas build --platform android --profile development
```

### 5. Phase 1 이후 (목표)

1. Model Manager에서 **Gemma 4 E2B** 다운로드
2. Backend **GPU** 선택 (지원 기기)
3. 새 채팅 → 메시지 전송 → 스트리밍 응답 확인

## 참고 링크

- [Expo Documentation](https://docs.expo.dev)
- [Expo GitHub](https://github.com/expo/expo)
- [Google AI Edge](https://developers.google.com/edge)
- [LiteRT-LM](https://github.com/google-ai-edge/LiteRT-LM)
- [Gemma 4 on LiteRT-LM](https://ai.google.dev/edge/litert-lm/models/gemma-4)
- [AI Edge Gallery](https://github.com/google-ai-edge/gallery)
- [MediaPipe iOS LLM Inference](https://developers.google.com/mediapipe/solutions/genai/llm_inference/ios) · [샘플 코드](https://github.com/google-ai-edge/mediapipe-samples/tree/main/examples/llm_inference/ios)

## License

TBD (Gemma / LiteRT-LM 각 라이선스 준수 필요).
