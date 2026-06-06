import type { JsSkillWebViewBridge } from './jsSkillTypes';

export interface JsSkillHostBridge extends JsSkillWebViewBridge {
  isReady(): boolean;
}

let globalJsSkillHostBridge: JsSkillHostBridge | null = null;

export function setJsSkillHostBridge(bridge: JsSkillHostBridge | null): void {
  globalJsSkillHostBridge = bridge;
}

export function getJsSkillHostBridge(): JsSkillHostBridge {
  if (globalJsSkillHostBridge?.isReady()) {
    return globalJsSkillHostBridge;
  }
  return {
    isReady: () => false,
    evaluate: async () =>
      JSON.stringify({
        error:
          'JS skill WebView host is not mounted. Rebuild the dev client after adding react-native-webview.',
      }),
  };
}
