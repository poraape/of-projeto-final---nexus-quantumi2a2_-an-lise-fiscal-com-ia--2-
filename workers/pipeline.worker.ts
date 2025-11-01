import { runAnalysisPipeline } from '../utils/pipelineOrchestrator';
import { runReconciliation } from '../agents/reconciliationAgent';
import type { AuditedDocument, BankTransaction, ReconciliationResult } from '../types';
import Papa from 'papaparse';

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'START_PIPELINE') {
    const { files, corrections } = payload;
    
    const callbacks = {
      onAgentUpdate: (update: any) => self.postMessage({ type: 'AGENT_UPDATE', payload: update }),
      onAIEnrichStart: () => self.postMessage({ type: 'AI_ENRICH_START' }),
      onPipelineResult: (report: any) => self.postMessage({ type: 'PIPELINE_RESULT', payload: report }),
      onPipelineError: (error: any) => self.postMessage({ type: 'PIPELINE_ERROR', payload: { error } }),
    };

    await runAnalysisPipeline(files, corrections, callbacks);

  } else if (type === 'START_RECONCILIATION') {
    try {
      const { bankFiles, documents } = payload as { bankFiles: File[]; documents: AuditedDocument[] };
      self.postMessage({ type: 'AGENT_UPDATE', payload: { reconciliation: { name: 'reconciliation', status: 'running' } } });

      const transactions: BankTransaction[] = [];
      for (const file of bankFiles) {
        const text = await file.text();
        const parsed = Papa.parse<any>(text, { header: true, skipEmptyLines: true });
        parsed.data.forEach((row: any, i: number) => {
          const amount = parseFloat(row.Amount || row.amount || row.Valor);
          if (!Number.isNaN(amount)) {
            transactions.push({
              id: `${file.name}-${i}`,
              date: new Date(row.Date || row.date || row.Data).toISOString(),
              amount,
              description: row.Description || row.description || row['Descrição'],
              type: amount >= 0 ? 'CREDIT' : 'DEBIT',
              sourceFile: file.name,
            });
          }
        });
      }

      const result: ReconciliationResult = await runReconciliation(documents, transactions);

      self.postMessage({ type: 'AGENT_UPDATE', payload: { reconciliation: { name: 'reconciliation', status: 'completed' } } });
      self.postMessage({ type: 'RECONCILIATION_RESULT', payload: { reconciliationResult: result } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido na conciliação.';
      self.postMessage({ type: 'AGENT_UPDATE', payload: { reconciliation: { name: 'reconciliation', status: 'error', error: errorMessage } } });
    }
  }
};

