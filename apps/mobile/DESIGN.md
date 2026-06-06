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

## 10. 테스트 전략 (구현 시)

- Unit: AgentRuntime + **PromptTemplateEngine**; ModelManager verify ( corrupt file )
- UI: **mock mode** default — Detox/Maestro without .litertlm
- Integration: lifecycle — background → idle → hibernate → warmUp → restore

---

## Commands

> 코드 미구현. Phase 1 시작 시 아래를 실제 명령으로 갱신한다.

<!-- Phase 1 이후 추가 -->
