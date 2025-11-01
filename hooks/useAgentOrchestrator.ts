// hooks/useAgentOrchestrator.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import type { AgentStates, AuditReport, ChatMessage, ClassificationResult } from '../types';
import { logger } from '../services/logger';
import { streamChatMessage } from '../services/geminiService';
import { apiClient } from '../services/apiClient';
import type { Chat } from '@google/genai';

const initialAgentStates: AgentStates = {
  ocr: { name: 'ocr', status: 'pending' },
  auditor: { name: 'auditor', status: 'pending' },
  classifier: { name: 'classifier', status: 'pending' },
  crossValidator: { name: 'crossValidator', status: 'pending' },
  intelligence: { name: 'intelligence', status: 'pending' },
  accountant: { name: 'accountant', status: 'pending' },
  reconciliation: { name: 'reconciliation', status: 'pending' },
};

export const useAgentOrchestrator = () => {
    const [agentStates, setAgentStates] = useState<AgentStates>(initialAgentStates);
    const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPipelineRunning, setIsPipelineRunning] = useState(false);
    const [isPipelineComplete, setIsPipelineComplete] = useState(false);
    const [isAI