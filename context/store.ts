import { create } from 'zustand';
import type { AgentStates, AuditReport, ChatMessage, ReconciliationResult } from '../types';

export const initialAgentStates: AgentStates = {
  ocr: { name: 'ocr', status: 'pending' },
  auditor: { name: 'auditor', status: 'pending' },
  classifier: { name: 'classifier', status: 'pending' },
  crossValidator: { name: 'crossValidator', status: 'pending' },
  intelligence: { name: 'intelligence', status: 'pending' },
  accountant: { name: 'accountant', status: 'pending' },
  reconciliation: { name: 'reconciliation', status: 'pending' },
};

interface AppState {
  agentStates: AgentStates;
  auditReport: AuditReport | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  pipelineError: string | null;
  isPipelineRunning: boolean;
  isPipelineComplete: boolean;
  isAIEnriching: boolean;
  isAIMode: 'manual' | 'auto';

  setAgentStates: (agentStates: AgentStates) => void;
  mergeAgentStates: (partial: Partial<AgentStates>) => void;
  setAuditReport: (report: AuditReport | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (text: string, chartData?: any) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setPipelineError: (error: string | null) => void;
  setIsPipelineRunning: (isRunning: boolean) => void;
  setIsPipelineComplete: (isComplete: boolean) => void;
  setIsAIEnriching: (isEnriching: boolean) => void;
  setIsAIMode: (mode: 'manual' | 'auto') => void;
  setReconciliationResult: (result: ReconciliationResult) => void;
  reset: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  agentStates: initialAgentStates,
  auditReport: null,
  messages: [],
  isStreaming: false,
  pipelineError: null,
  isPipelineRunning: false,
  isPipelineComplete: false,
  isAIEnriching: false,
  isAIMode: 'auto',

  setAgentStates: (agentStates) => set({ agentStates }),
  mergeAgentStates: (partial) => set(state => ({
    agentStates: {
      ...state.agentStates,
      ...Object.entries(partial).reduce((acc, [key, value]) => {
        if (!value) return acc;
        acc[key as keyof AgentStates] = {
          ...(state.agentStates[key as keyof AgentStates] ?? { name: key, status: 'pending' }),
          ...value,
        };
        return acc;
      }, {} as Partial<AgentStates>),
    }
  })),
  setAuditReport: (auditReport) => set({ auditReport }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set(state => ({ messages: [...state.messages, message] })), 
  updateLastMessage: (text, chartData) => set(state => ({
    messages: state.messages.map((msg, index) => 
      index === state.messages.length - 1 ? { ...msg, text, chartData } : msg
    ),
  })),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setPipelineError: (pipelineError) => set({ pipelineError }),
  setIsPipelineRunning: (isPipelineRunning) => set({ isPipelineRunning }),
  setIsPipelineComplete: (isPipelineComplete) => set({ isPipelineComplete }),
  setIsAIEnriching: (isAIEnriching) => set({ isAIEnriching }),
  setIsAIMode: (isAIMode) => set({ isAIMode }),
  setReconciliationResult: (reconciliationResult) => set(state => ({
    auditReport: state.auditReport ? { ...state.auditReport, reconciliationResult } : null,
  })),
  reset: () => set({
    agentStates: initialAgentStates,
    auditReport: null,
    messages: [],
    isStreaming: false,
    pipelineError: null,
    isPipelineRunning: false,
    isPipelineComplete: false,
    isAIEnriching: false,
  }),
}));
