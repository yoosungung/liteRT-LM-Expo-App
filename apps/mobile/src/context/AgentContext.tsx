import { createContext, useContext, type ReactNode } from 'react';

import { AgentRuntime, getAgentRuntime } from '../agent/AgentRuntime';

const AgentContext = createContext<AgentRuntime | null>(null);

export function AgentProvider({
  children,
  runtime,
}: {
  children: ReactNode;
  runtime?: AgentRuntime;
}) {
  return (
    <AgentContext.Provider value={runtime ?? getAgentRuntime()}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentRuntime(): AgentRuntime {
  const runtime = useContext(AgentContext);
  if (!runtime) {
    throw new Error('useAgentRuntime must be used within AgentProvider');
  }
  return runtime;
}
