import { vi, describe, it, expect, beforeEach } from 'vitest';
import { runAnalysisPipeline } from './pipelineOrchestrator';
import { importPipeline } from './importPipeline';
import { runAudit } from '../agents/auditorAgent';
import { runClassification } from '../agents/classifierAgent';
import { runDeterministicCrossValidation } from './fiscalCompare';
import { runAccountantAnalysis } from '../agents/accountantAgent';
import { runIntelligenceAnalysis } from '../agents/intelligenceAgent';

// Mock the agents and utilities
vi.mock('./importPipeline');
vi.mock('../agents/auditorAgent');
vi.mock('../agents/classifierAgent');
vi.mock('./fiscalCompare');
vi.mock('../agents/accountantAgent');
vi.mock('../agents/intelligenceAgent');

describe('runAnalysisPipeline', () => {
  let callbacks;

  beforeEach(() => {
    callbacks = {
      onAgentUpdate: vi.fn(),
      onAIEnrichStart: vi.fn(),
      onPipelineResult: vi.fn(),
      onPipelineError: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('should run all agents in sequence and call onPipelineResult on success', async () => {
    const files = [new File(['"test"'], 'test.csv', { type: 'text/csv' })];
    const corrections = { classification: {}, costCenter: {} };

    // Mock implementations
    (importPipeline as vi.Mock).mockResolvedValue([]);
    (runAudit as vi.Mock).mockResolvedValue({ documents: [] });
    (runClassification as vi.Mock).mockResolvedValue({ documents: [] });
    (runDeterministicCrossValidation as vi.Mock).mockResolvedValue([]);
    (runAccountantAnalysis as vi.Mock).mockResolvedValue([]);
    (runIntelligenceAnalysis as vi.Mock).mockResolvedValue({ summary: {}, aiDrivenInsights: [], crossValidationResults: [] });

    await runAnalysisPipeline(files, corrections, callbacks);

    expect(importPipeline).toHaveBeenCalledOnce();
    expect(runAudit).toHaveBeenCalledOnce();
    expect(runClassification).toHaveBeenCalledOnce();
    expect(runDeterministicCrossValidation).toHaveBeenCalledOnce();
    expect(runAccountantAnalysis).toHaveBeenCalledOnce();
    expect(runIntelligenceAnalysis).toHaveBeenCalledOnce();

    expect(callbacks.onPipelineResult).toHaveBeenCalledOnce();
    expect(callbacks.onPipelineError).not.toHaveBeenCalled();
  });

  it('should call onPipelineError if an agent fails', async () => {
    const files = [new File(['"test"'], 'test.csv', { type: 'text/csv' })];
    const corrections = { classification: {}, costCenter: {} };
    const errorMessage = 'Auditor failed';

    // Mock implementations
    (importPipeline as vi.Mock).mockResolvedValue([]);
    (runAudit as vi.Mock).mockRejectedValue(new Error(errorMessage));

    await runAnalysisPipeline(files, corrections, callbacks);

    expect(importPipeline).toHaveBeenCalledOnce();
    expect(runAudit).toHaveBeenCalledOnce();
    expect(runClassification).not.toHaveBeenCalled(); // Should not be called

    expect(callbacks.onPipelineResult).not.toHaveBeenCalled();
    expect(callbacks.onPipelineError).toHaveBeenCalledOnce();
    expect(callbacks.onPipelineError).toHaveBeenCalledWith(expect.objectContaining({ message: `[auditor] ${errorMessage}` }));
  });
});
