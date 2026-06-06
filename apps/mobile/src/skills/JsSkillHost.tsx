import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { buildWebViewEvaluateScript } from './jsSkillBridge';
import {
  getJsSkillHostBridge,
  setJsSkillHostBridge,
  type JsSkillHostBridge,
} from './jsSkillHostBridge';

interface PendingJsSkillTask {
  scriptHtml: string;
  data: string;
  secret?: string;
  resolve: (raw: string) => void;
  reject: (error: Error) => void;
}

const JsSkillHostContext = createContext<JsSkillHostBridge | null>(null);

export function JsSkillHostProvider({ children }: { children: ReactNode }) {
  const webViewRef = useRef<WebView>(null);
  const mountedRef = useRef(false);
  const [html, setHtml] = useState('<!DOCTYPE html><html><body></body></html>');
  const pendingRef = useRef<PendingJsSkillTask | null>(null);
  const queueRef = useRef<PendingJsSkillTask[]>([]);
  const bridgeRef = useRef<JsSkillHostBridge | null>(null);

  const runNext = useCallback(() => {
    if (pendingRef.current || queueRef.current.length === 0) {
      return;
    }
    const task = queueRef.current.shift()!;
    pendingRef.current = task;
    setHtml(task.scriptHtml);
  }, []);

  if (!bridgeRef.current) {
    bridgeRef.current = {
      isReady: () => mountedRef.current,
      evaluate(scriptHtml, data, options) {
        return new Promise<string>((resolve, reject) => {
          queueRef.current.push({
            scriptHtml,
            data,
            secret: options?.secret,
            resolve,
            reject,
          });
          runNext();
        });
      },
    };
  }

  useEffect(() => {
    mountedRef.current = true;
    setJsSkillHostBridge(bridgeRef.current);
    return () => {
      mountedRef.current = false;
      setJsSkillHostBridge(null);
    };
  }, []);

  const onLoadEnd = useCallback(() => {
    const task = pendingRef.current;
    if (!task || !webViewRef.current) {
      return;
    }
    webViewRef.current.injectJavaScript(buildWebViewEvaluateScript(task.data, task.secret));
  }, []);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const task = pendingRef.current;
      if (!task) {
        return;
      }
      pendingRef.current = null;
      task.resolve(event.nativeEvent.data);
      runNext();
    },
    [runNext],
  );

  return (
    <JsSkillHostContext.Provider value={bridgeRef.current}>
      {children}
      <View pointerEvents="none" style={styles.hiddenHost}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html }}
          onLoadEnd={onLoadEnd}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess={false}
          allowUniversalAccessFromFileURLs={false}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          cacheEnabled={false}
          incognito
          style={styles.webview}
        />
      </View>
    </JsSkillHostContext.Provider>
  );
}

export function useJsSkillHostBridge(): JsSkillHostBridge {
  return useContext(JsSkillHostContext) ?? getJsSkillHostBridge();
}

export { getJsSkillHostBridge, type JsSkillHostBridge } from './jsSkillHostBridge';

const styles = StyleSheet.create({
  hiddenHost: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    left: -9999,
    top: -9999,
  },
  webview: {
    width: 1,
    height: 1,
  },
});
