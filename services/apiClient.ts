// services/apiClient.ts
import type { ApiClientCallbacks, AuditReport, AuditedDocument } from '../types';
import { initializeChat } from './chatService';
import type { Chat } from './geminiService';
import { runAnalysisPipeline } from '../utils/pipelineOrchestrator';
import { logger } from './logger';
import PipelineWorker from '../workers/pipeline.worker.ts?worker';
import { OpenAPI, HealthService, AiService, AuditsService } from './generatedApi';

// Configure the generated API client
OpenAPI.BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080';

const createWorker = (): Worker => {
  return new PipelineWorker();
};

class ApiClient {
  private worker: Worker | null = null;
  private currentCallbacks: ApiClientCallbacks | null = null;

  public readonly health = HealthService;
  public readonly ai = AiService;
  public readonly audits = AuditsService;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    if (this.worker) {
      this.worker.terminate();
    }

    try {
      this.worker = createWorker();
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = (event) => {
        console.error('[Worker error]', 'message' in event ? event.message : event);
        this.markWorkerUnavailable();
        // The fallback to inline is now handled in startAnalysisPipeline
      };
      this.worker.onmessageerror = (event) => {
        console.error('[Worker message error]', event);
        this.markWorkerUnavailable();
      };
    } catch (error) {
      console.error('[Worker init failed]', error);
      this.worker = null;
    }
  }

  private markWorkerUnavailable() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch (_) {
        // ignore termination errors
      }
      this.worker = null;
    }
  }

  private handleWorkerMessage(event: MessageEvent) {
    if (!this.currentCallbacks) return;

    const { type, payload } = event.data;
    switch (type) {
      case 'AGENT_UPDATE':
        this.currentCallbacks.onAgentUpdate(payload);
        break;
      case 'PIPELINE_RESULT':
        this.currentCallbacks.onPipelineResult(payload);
        break;
      case 'PIPELINE_ERROR':
        this.currentCallbacks.onPipelineError(payload.error);
        break;
      case 'AI_ENRICH_START':
        this.currentCallbacks.onAIEnrichStart();
        break;
      case 'RECONCILIATION_RESULT':
        this.currentCallbacks.onReconciliationResult(payload);
        break;
    }
  }

  public startAnalysisPipeline(
    data: { files: File[]; corrections: any },
    callbacks: ApiClientCallbacks
  ) {
    this.currentCallbacks = callbacks;

    if (this.worker) {
      try {
        this.worker.postMessage({ type: 'START_PIPELINE', payload: data });
        return;
      } catch (error) {
        console.error('[Worker postMessage failed]', error);
        this.markWorkerUnavailable();
      }
    }

    // Fallback to inline execution if worker fails
    logger.log('Pipeline', 'WARN', 'Worker not available, falling back to inline execution.');
    runAnalysisPipeline(data.files, data.corrections, callbacks);
  }

  public startReconciliationPipeline(bankFiles: File[], documents: AuditedDocument[]) {
    if (!this.currentCallbacks) {
      console.error('Cannot start reconciliation without active callbacks.');
      return;
    }

    if (this.worker) {
      try {
        this.worker.postMessage({
          type: 'START_RECONCILIATION',
          payload: { bankFiles, documents },
        });
        return;
      } catch (error) {
        console.error('[Worker postMessage failed]', error);
        this.markWorkerUnavailable();
      }
    }
    
    // Note: Inline reconciliation is not implemented in this refactoring
    // to keep the focus on the main pipeline.
    const errorMsg = 'Worker not available for reconciliation.';
    logger.log('Reconciliation', 'ERROR', errorMsg);
    this.currentCallbacks.onAgentUpdate({ reconciliation: { name: 'reconciliation', status: 'error', error: errorMsg } });
  }

  public async initializeChatSession(report: AuditReport): Promise<Chat> {
    const dataSample = JSON.stringify(report.documents.slice(0, 10).map((d) => d.doc.data).flat(), null, 2);
    return initializeChat(dataSample, report.aggregatedMetrics);
  }
}

export const apiClient = new ApiClient();