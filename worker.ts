// worker.ts
import { importPipeline } from './utils/importPipeline';
import { runAudit } from './agents/auditorAgent';
import { runClassification } from './agents/classifierAgent';
import { runDeterministicCrossValidation } from './utils/fiscalCompare';
import { runAccountantAnalysis } from './agents/accountantAgent';
import { runIntelligenceAnalysis } from './agents/intelligenceAgent';
import { runReconciliation } from './agents/reconciliationAgent';
import type { AgentStates, AuditReport, AuditedDocument, BankTransaction, ReconciliationResult } from './types';
import { logger } from './services/logger';
import Papa from 'papaparse';


const postAgentUpdate = (states: Partial<AgentStates>) => {
    self.postMessage({ type: 'AGENT_UPDATE', payload: states });
};

self.onmessage = async (event: MessageEvent) => {
    const { type, payload } = event.data;

    if (type === 'START_PIPELINE') {
        try {
            const { files, corrections } = payload;
            logger.log('Worker', 'INFO', `Pipeline iniciado com ${files.length} arquivo(s).`);

            // 1. OCR / Data Extraction
            postAgentUpdate({ ocr: { name: 'ocr', status: 'running' } });
            const importedDocs = await importPipeline(files, (progress) => {
                postAgentUpdate({ ocr: { name: 'ocr', status: 'running', progress: { step: 'Processando arquivos', current: Math.round(progress/100 * files.length), total: files.length } } });
            });
            postAgentUpdate({ ocr: { name: 'ocr', status: 'completed' } });
            
            // 2. Auditor Agent
            postAgentUpdate({ auditor: { name: 'auditor', status: 'running' } });
            let report: Omit<AuditReport, 'summary'> = await runAudit(importedDocs);
            postAgentUpdate({ auditor: { name: 'auditor', status: 'completed' } });

            // 3. Classifier Agent
            postAgentUpdate({ classifier: { name: 'classifier', status: 'running' } });
            report = await runClassification(report, corrections.classification, corrections.costCenter);
            postAgentUpdate({ classifier: { name: 'classifier', status: 'completed' } });

            // 4. Cross-Validator Agent
            postAgentUpdate({ crossValidator: { name: 'crossValidator', status: 'running' } });
            const deterministicCrossValidation = await runDeterministicCrossValidation(report);
            report.deterministicCrossValidation = deterministicCrossValidation;
            postAgentUpdate({ crossValidator: { name: 'crossValidator', status: 'completed' } });

            // 5. Accountant Agent
            postAgentUpdate({ accountant: { name: 'accountant', status: 'running' } });
            const aggregatedMetrics = await runAccountantAnalysis(report);
            report.aggregatedMetrics = aggregatedMetrics;
            postAgentUpdate({ accountant: { name: 'accountant', status: 'completed' } });
            
            // Announce that AI enrichment is starting
            self.postMessage({ type: 'AI_ENRICH_START' });

            // 6. Intelligence Agent (AI)
            postAgentUpdate({ intelligence: { name: 'intelligence', status: 'running' } });
            const aiResults = await runIntelligenceAnalysis(report);
            const finalReport: AuditReport = { ...report, ...aiResults };
            postAgentUpdate({ intelligence: { name: 'intelligence', status: 'completed' } });

            self.postMessage({ type: 'PIPELINE_RESULT', payload: finalReport });
            logger.log('Worker', 'INFO', 'Pipeline concluído com sucesso.');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido no worker.';
            logger.log('Worker', 'ERROR', 'Erro fatal no pipeline.', { error });
            self.postMessage({ type: 'PIPELINE_ERROR', payload: { error: errorMessage } });
        }
    } else if (type === 'START_RECONCILIATION') {
        try {
            const { bankFiles, documents } = payload;
            postAgentUpdate({ reconciliation: { name: 'reconciliation', status: 'running' } });

            // This is a simplified bank statement parser for demo purposes.
            const transactions: BankTransaction[] = [];
            for (const file of bankFiles) {
                const text = await file.text();
                // Simple CSV parsing, assuming columns: Date,Description,Amount
                const parsed = Papa.parse<any>(text, { header: true, skipEmptyLines: true });
                parsed.data.forEach((row: any, i: number) => {
                    const amount = parseFloat(row.Amount || row.amount || row.Valor);
                    if(!isNaN(amount)) {
                         transactions.push({
                            id: `${file.name}-${i}`,
                            date: new Date(row.Date || row.date || row.Data).toISOString(),
                            amount: amount,
                            description: row.Description || row.description || row.Descrição,
                            type: amount >= 0 ? 'CREDIT' : 'DEBIT',
                            sourceFile: file.name,
                        });
                    }
                });
            }
            
            const result: ReconciliationResult = await runReconciliation(documents, transactions);
            
            postAgentUpdate({ reconciliation: { name: 'reconciliation', status: 'completed' } });
            self.postMessage({ type: 'RECONCILIATION_RESULT', payload: { reconciliationResult: result } });
        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido na conciliação.';
             postAgentUpdate({ reconciliation: { name: 'reconciliation', status: 'error', error: errorMessage } });
        }
    }
};
