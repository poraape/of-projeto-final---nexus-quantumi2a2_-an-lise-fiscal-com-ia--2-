import { useCallback, useRef } from 'react';
import { useStore, initialAgentStates } from '../context/store';
import type { AuditReport, ClassificationResult, ReconciliationResult } from '../types';
import { logger } from '../services/logger';
import { apiClient } from '../services/apiClient';
import { streamChatMessage } from '../services/geminiService';
import type { Chat } from '../services/geminiService';

const generateMessageId = (prefix: 'user' | 'ai') =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const useAgentOrchestrator = () => {
  const store = useStore();
  const chatSessionRef = useRef<Chat | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const classificationCorrectionsRef = useRef<Record<string, ClassificationResult['operationType']>>({});
  const costCenterCorrectionsRef = useRef<Record<string, string>>({});

  const resetState = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    chatSessionRef.current = null;
    classificationCorrectionsRef.current = {};
    costCenterCorrectionsRef.current = {};
    store.reset();
  }, [store]);

  const ensureChatSession = useCallback(async () => {
    if (chatSessionRef.current || !store.auditReport) {
      return chatSessionRef.current;
    }

    try {
      chatSessionRef.current = await apiClient.initializeChatSession(store.auditReport);
      return chatSessionRef.current;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao inicializar o chat.';
      // This error state is local to the component that uses the hook
      // and is not part of the global store.
      logger.log('Chat', 'ERROR', message, err);
      return null;
    }
  }, [store.auditReport]);

  const runPipeline = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) {
      store.setPipelineError('Selecione ao menos um arquivo para iniciar a análise.');
      return;
    }

    logger.clear();
    logger.log('Pipeline', 'INFO', `Iniciando análise com ${files.length} arquivo(s).`);

    resetState();
    store.setIsPipelineRunning(true);

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
        onAgentUpdate: store.mergeAgentStates,
        onPipelineResult: async (report: AuditReport) => {
          logger.log('Pipeline', 'INFO', 'Pipeline concluído com sucesso.');
          store.setAuditReport(report);
          store.setIsPipelineRunning(false);
          store.setIsPipelineComplete(true);
          store.setIsAIEnriching(false);
          store.mergeAgentStates({
            intelligence: { name: 'intelligence', status: 'completed' },
            reconciliation: { name: 'reconciliation', status: report.reconciliationResult ? 'completed' : 'pending' },
          });

          try {
            chatSessionRef.current = await apiClient.initializeChatSession(report);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Falha ao preparar o chat.';
            // This error is not critical to the pipeline, so we log it but don't set a pipeline error state.
            logger.log('Chat', 'ERROR', message, err);
          }
        },
        onPipelineError: (error: any) => {
          const message = error instanceof Error ? error.message : String(error);
          logger.log('Pipeline', 'ERROR', message, { error });
          store.setPipelineError(message);
          store.setIsPipelineRunning(false);
          store.setIsPipelineComplete(false);
          store.setIsAIEnriching(false);
        },
        onAIEnrichStart: () => {
          store.setIsAIEnriching(true);
          store.mergeAgentStates({ intelligence: { name: 'intelligence', status: 'running' } });
        },
        onReconciliationResult: ({ reconciliationResult }: { reconciliationResult: ReconciliationResult }) => {
          store.setReconciliationResult(reconciliationResult);
          store.mergeAgentStates({ reconciliation: { name: 'reconciliation', status: 'completed' } });
        },
      }
    );
  }, [store, resetState]);

  const handleSendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (!store.auditReport) {
      // This should be handled by the UI, but as a safeguard:
      console.error('Conclua uma análise antes de conversar com a IA.');
      return;
    }

    const chat = await ensureChatSession();
    if (!chat) {
      return;
    }

    const userMessageId = generateMessageId('user');
    const aiMessageId = generateMessageId('ai');

    store.addMessage({ id: userMessageId, sender: 'user', text: trimmed });
    store.addMessage({ id: aiMessageId, sender: 'ai', text: '' });

    const controller = new AbortController();
    streamAbortRef.current = controller;
    store.setIsStreaming(true);

    let accumulated = '';

    try {
      for await (const chunk of streamChatMessage(chat, trimmed)) {
        if (controller.signal.aborted) {
          break;
        }
        accumulated += chunk;
        const interim = accumulated.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
        store.updateLastMessage(interim);
      }

      if (controller.signal.aborted) {
        store.updateLastMessage('Resposta interrompida pelo usuário.');
        return;
      }

      const cleaned = accumulated.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
      let finalText = cleaned;
      let chartData: any;

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

      store.updateLastMessage(finalText, chartData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar a resposta da IA.';
      logger.log('Chat', 'ERROR', message, err);
      store.updateLastMessage(message);
    } finally {
      store.setIsStreaming(false);
      streamAbortRef.current = null;
    }
  }, [store, ensureChatSession]);

  const handleStopStreaming = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
    }
    store.setIsStreaming(false);
  }, [store]);

  const handleClassificationChange = useCallback((docName: string, newClassification: ClassificationResult['operationType']) => {
    classificationCorrectionsRef.current[docName] = newClassification;
    // The local update is now handled by the store
  }, []);

  const handleCostCenterChange = useCallback((docName: string, newCostCenter: string) => {
    costCenterCorrectionsRef.current[docName] = newCostCenter;
    // The local update is now handled by the store
  }, []);

  const runReconciliationPipeline = useCallback((files: File[]) => {
    if (!store.auditReport) {
      console.error('Conclua a análise principal antes de executar a conciliação.');
      return;
    }

    store.mergeAgentStates({ reconciliation: { name: 'reconciliation', status: 'running' } });
    apiClient.startReconciliationPipeline(files, store.auditReport.documents);
  }, [store]);

  return {
    ...store,
    runPipeline,
    handleSendMessage,
    handleStopStreaming,
    handleClassificationChange,
    handleCostCenterChange,
    runReconciliationPipeline,
    reset: resetState,
  };
};

