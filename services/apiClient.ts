// services/apiClient.ts
import type { ApiClientCallbacks, AuditReport, AuditedDocument } from '../types';
import { initializeChat } from './chatService';
import type { Chat } from './geminiService';

/**
 * Creates and manages the Web Worker instance.
 * @returns A new Worker instance.
 */
const createWorker = (): Worker => {
    // Resolves correctly in Vite build output (rewritten to /assets/worker-*.js)
    const workerUrl = new URL('../worker.ts', import.meta.url);
    return new Worker(workerUrl, { type: 'module' });
};

class ApiClient {
    private worker: Worker | null = null;
    private currentCallbacks: ApiClientCallbacks | null = null;

    constructor() {
        this.initializeWorker();
    }

    private initializeWorker() {
        if (this.worker) {
            this.worker.terminate();
        }
        this.worker = createWorker();
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
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

    /**
     * Starts the full analysis pipeline.
     * @param data The files and corrections for the analysis.
     * @param callbacks The callback functions to communicate with the UI.
     */
    public startAnalysisPipeline(
        data: { files: File[], corrections: any },
        callbacks: ApiClientCallbacks
    ) {
        this.currentCallbacks = callbacks;
        this.worker?.postMessage({
            type: 'START_PIPELINE',
            payload: data,
        });
    }

    /**
     * Starts the bank reconciliation pipeline.
     * The main analysis must have been completed before calling this.
     * @param bankFiles The bank statement files.
     * @param documents The audited documents from the main report.
     */
    public startReconciliationPipeline(bankFiles: File[], documents: AuditedDocument[]) {
        if (!this.currentCallbacks) {
            console.error("Cannot start reconciliation without active callbacks.");
            return;
        }
        this.worker?.postMessage({
            type: 'START_RECONCILIATION',
            payload: { bankFiles, documents },
        });
    }

    /**
     * Initializes a new chat session based on the completed audit report.
     * @param report The completed audit report.
     * @returns A Chat instance.
     */
    public async initializeChatSession(report: AuditReport): Promise<Chat> {
        const dataSample = JSON.stringify(report.documents.slice(0, 10).map(d => d.doc.data).flat(), null, 2);
        return initializeChat(dataSample, report.aggregatedMetrics);
    }
}

export const apiClient = new ApiClient();
