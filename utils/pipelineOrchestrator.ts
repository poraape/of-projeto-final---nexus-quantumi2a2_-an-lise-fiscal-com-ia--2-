// utils/pipelineOrchestrator.ts
import { importPipeline } from './importPipeline';
import { runAudit } from '../agents/auditorAgent';
import { runClassification } from '../agents/classifierAgent';
import { runDeterministicCrossValidation } from './fiscalCompare';
import { runAccountantAnalysis } from '../agents/accountantAgent';
import { runIntelligenceAnalysis } from '../agents/intelligenceAgent';
import type { AgentStates, AuditReport } from '../types';
import { logger } from '../services/logger';

export interface PipelineCallbacks {
  onAgentUpdate: (update: Partial<AgentStates>) => void;
  onAIEnrichStart: () => void;
  onPipelineResult: (report: AuditReport) => void;
  onPipelineError: (error: any) => void;
}

import { PipelineError, AppError } from './errors';

// ... (the rest of the original imports)

// ... (the PipelineCallbacks interface)

async function runAgent<T>(
  agentName: string,
  onAgentUpdate: (update: Partial<AgentStates>) => void,
  runner: () => Promise<T>
): Promise<T> {
  onAgentUpdate({ [agentName]: { name: agentName, status: 'running' } });
  try {
    const result = await runner();
    onAgentUpdate({ [agentName]: { name: agentName, status: 'completed' } });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onAgentUpdate({ [agentName]: { name: agentName, status: 'error', error: message } });
    throw new PipelineError(message, agentName, error);
  }
}

export async function runAnalysisPipeline(
  files: File[],
  corrections: { classification: Record<string, string>; costCenter: Record<string, string> },
  callbacks: PipelineCallbacks
) {
  const { onAgentUpdate, onAIEnrichStart, onPipelineResult, onPipelineError } = callbacks;

  try {
    logger.log('Pipeline', 'INFO', `Pipeline iniciado com ${files.length} arquivo(s).`);

    const importedDocs = await runAgent('ocr', onAgentUpdate, () => 
      importPipeline(files, (progress) => {
        onAgentUpdate({
          ocr: {
            name: 'ocr',
            status: 'running',
            progress: {
              step: 'Processando arquivos',
              current: Math.round((progress / 100) * files.length),
              total: files.length,
            },
          },
        });
      })
    );

    let report: Omit<AuditReport, 'summary'> = await runAgent('auditor', onAgentUpdate, () => runAudit(importedDocs));

    report = await runAgent('classifier', onAgentUpdate, () => runClassification(report, corrections.classification, corrections.costCenter));

    const deterministicCrossValidation = await runAgent('crossValidator', onAgentUpdate, () => runDeterministicCrossValidation(report));
    report.deterministicCrossValidation = deterministicCrossValidation;

    const aggregatedMetrics = await runAgent('accountant', onAgentUpdate, () => runAccountantAnalysis(report));
    report.aggregatedMetrics = aggregatedMetrics;

    onAIEnrichStart();

    const aiResults = await runAgent('intelligence', onAgentUpdate, () => runIntelligenceAnalysis(report));
    const finalReport: AuditReport = { ...report, ...aiResults };

    onPipelineResult(finalReport);
    logger.log('Pipeline', 'INFO', 'Pipeline concluído com sucesso.');
  } catch (error) {
    const finalError = error instanceof AppError ? error : new AppError('Erro desconhecido no pipeline.', error);
    logger.log('Pipeline', 'ERROR', 'Erro fatal no pipeline.', finalError);
    onPipelineError(finalError);
  }
}
