import { useState, useCallback, useRef } from 'react';
import type { AgentStates, AuditReport, ChatMessage, ClassificationResult, ReconciliationResult } from '../types';
import { logger } from '../services/logger';
import { apiClient } from '../services/apiClient';
import { streamChatMessage } from '../services/geminiService';
import type { Chat } from '../services/geminiService';

const initialAgentStates: AgentStates = {
  ocr: { name: 'ocr', status: 'pending' },
  auditor: { name: 'auditor', status: 'pending' },
  classifier: { name: 'classifier', status: 'pending' },
  crossValidator: { name: 'crossValidator', status: 'pending' },
  intelligence: { name: 'intelligence', status: 'pending' },
  accountant: { name: 'accountant', status: 'pending' },
  reconciliation: { name: 'reconciliation', status: 'pending' },
};

type ClassificationCorrections = Record<string, ClassificationResult['operationType']>;
type CostCenterCorrections = Record<string, string>;

const generateMessageId = (prefix: 'user' | 'ai') =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const useAgentOrchestrator = () => {
  const [agentStates, setAgentStates] = useState<AgentStates>(initialAgentStates);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [isPipelineComplete, setIsPipelineComplete] = useState(false);
  const [isAIEnriching, setIsAIEnriching] = useState(false);
  const [isAIMode, setIsAIMode] = useState<'manual' | 'auto'>('auto');

  const chatSessionRef = useRef<Chat | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const classificationCorrectionsRef = useRef<ClassificationCorrections>({});
  const costCenterCorrectionsRef = useRef<CostCenterCorrections>({});

  const mergeAgentStates = useCallback((partial: Partial<AgentStates>) => {
    setAgentStates(prev => ({
      ...prev,
      ...Object.entries(partial).reduce((acc, [key, value]) => {
        if (!value) return acc;
        acc[key as keyof AgentStates] = {
          ...(prev[key as keyof AgentStates] ?? { name: key, status: 'pending' }),
          ...value,
        };
        return acc;
      }, {} as Partial<AgentStates>),
    }));
  }, []);

  const resetState = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    chatSessionRef.current = null;
    classificationCorrectionsRef.current = {};
    costCenterCorrectionsRef.current = {};
    setAgentStates(initialAgentStates);
    setAuditReport(null);
    setMessages([]);
    setIsStreaming(false);
    setError(null);
    setPipelineError(null);
    setIsPipelineRunning(false);
    setIsPipelineComplete(false);
    setIsAIEnriching(false);
  }, []);

  const ensureChatSession = useCallback(async () => {
    if (chatSessionRef.current || !auditReport) {
      return chatSessionRef.current;
    }

    try {
      chatSessionRef.current = await apiClient.initializeChatSession(auditReport);
      return chatSessionRef.current;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao inicializar o chat.';
      setError(message);
      logger.log('Chat', 'ERROR', message, err);
      return null;
    }
  }, [auditReport]);

  const runPipeline = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) {
      setError('Selecione ao menos um arquivo para iniciar a análise.');
      return;
    }

    logger.clear();
    logger.log('Pipeline', 'INFO', `Iniciando análise com ${files.length} arquivo(s).`);

    resetState();
    setIsPipelineRunning(true);

    classificationCorrectionsRef.current = {};
    costCenterCorrectionsRef.current = {};

    apiClient.startAnalysisPipeline(
      {
        files,
        corrections: {
          classification: classificationCorrectionsRef.current,
          costCenter: costCenterCorrectionsRef.current,
        },
      },
      {
        onAgentUpdate: mergeAgentStates,
        onPipelineResult: async (report: AuditReport) => {
          logger.log('Pipeline', 'INFO', 'Pipeline concluído com sucesso.');
          setAuditReport(report);
          setIsPipelineRunning(false);
          setIsPipelineComplete(true);
          setIsAIEnriching(false);
          mergeAgentStates({
            intelligence: { name: 'intelligence', status: 'completed' },
            reconciliation: { name: 'reconciliation', status: report.reconciliationResult ? 'completed' : 'pending' },
          });

          try {
            chatSessionRef.current = await apiClient.initializeChatSession(report);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Falha ao preparar o chat.';
            setError(message);
            logger.log('Chat', 'ERROR', message, err);
          }
        },
        onPipelineError: (message: string) => {
          logger.log('Pipeline', 'ERROR', message);
          setPipelineError(message);
          setIsPipelineRunning(false);
          setIsPipelineComplete(false);
          setIsAIEnriching(false);
        },
        onAIEnrichStart: () => {
          setIsAIEnriching(true);
          mergeAgentStates({ intelligence: { name: 'intelligence', status: 'running' } });
        },
        onReconciliationResult: ({ reconciliationResult }: { reconciliationResult: ReconciliationResult }) => {
          setAuditReport(prev => (prev ? { ...prev, reconciliationResult } : prev));
          mergeAgentStates({ reconciliation: { name: 'reconciliation', status: 'completed' } });
        },
      }
    );
  }, [mergeAgentStates, resetState]);

  const handleSendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (!auditReport) {
      setError('Conclua uma análise antes de conversar com a IA.');
      return;
    }

    const chat = await ensureChatSession();
    if (!chat) {
      return;
    }

    const userMessageId = generateMessageId('user');
    const aiMessageId = generateMessageId('ai');

    setMessages(prev => [
      ...prev,
      { id: userMessageId, sender: 'user', text: trimmed },
      { id: aiMessageId, sender: 'ai', text: '' },
    ]);

    const controller = new AbortController();
    streamAbortRef.current = controller;
    setIsStreaming(true);

    let accumulated = '';

    try {
      for await (const chunk of streamChatMessage(chat, trimmed)) {
        if (controller.signal.aborted) {
          break;
        }
        accumulated += chunk;
        const interim = accumulated.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
        setMessages(prev => prev.map(message => (message.id === aiMessageId ? { ...message, text: interim } : message)));
      }

      if (controller.signal.aborted) {
        setMessages(prev => prev.map(message => (message.id === aiMessageId ? { ...message, text: 'Resposta interrompida pelo usuário.' } : message)));
        return;
      }

      const cleaned = accumulated.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
      let finalText = cleaned;
      let chartData: ChatMessage['chartData'];

      try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed.text === 'string') {
          finalText = parsed.text;
        }
        if (parsed.chartData) {
          chartData = parsed.chartData;
        }
      } catch {
        // manter texto bruto
      }

      setMessages(prev => prev.map(message => (
        message.id === aiMessageId ? { ...message, text: finalText, chartData } : message
      )));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar a resposta da IA.';
      setError(message);
      logger.log('Chat', 'ERROR', message, err);
      setMessages(prev => prev.map(msg => (msg.id === aiMessageId ? { ...msg, text: message } : msg)));
    } finally {
      setIsStreaming(false);
      streamAbortRef.current = null;
    }
  }, [auditReport, ensureChatSession]);

  const handleStopStreaming = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
    }
    setIsStreaming(false);
  }, []);

  const handleClassificationChange = useCallback((docName: string, newClassification: ClassificationResult['operationType']) => {
    classificationCorrectionsRef.current[docName] = newClassification;
    setAuditReport(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: prev.documents.map(document => {
          if (document.doc.name !== docName || !document.classification) {
            return document;
          }
          return {
            ...document,
            classification: {
              ...document.classification,
              operationType: newClassification,
              confidence: 1,
            },
          };
        }),
      };
    });
  }, []);

  const handleCostCenterChange = useCallback((docName: string, newCostCenter: string) => {
    costCenterCorrectionsRef.current[docName] = newCostCenter;
    setAuditReport(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        documents: prev.documents.map(document => {
          if (document.doc.name !== docName || !document.classification) {
            return document;
          }
          return {
            ...document,
            classification: {
              ...document.classification,
              costCenter: newCostCenter,
            },
          };
        }),
      };
    });
  }, []);

  const runReconciliationPipeline = useCallback((files: File[]) => {
    if (!auditReport) {
      setError('Conclua a análise principal antes de executar a conciliação.');
      return;
    }

    mergeAgentStates({ reconciliation: { name: 'reconciliation', status: 'running' } });
    apiClient.startReconciliationPipeline(files, auditReport.documents);
  }, [auditReport, mergeAgentStates]);

  const reset = useCallback(() => {
    resetState();
  }, [resetState]);

  return {
    agentStates,
    auditReport,
    messages,
    isStreaming,
    error,
    pipelineError,
    isPipelineRunning,
    isPipelineComplete,
    isAIEnriching,
    isAIMode,
    setIsAIMode,
    runPipeline,
    handleSendMessage,
    handleStopStreaming,
    setError,
    handleClassificationChange,
    handleCostCenterChange,
    runReconciliationPipeline,
    reset,
  };
};

