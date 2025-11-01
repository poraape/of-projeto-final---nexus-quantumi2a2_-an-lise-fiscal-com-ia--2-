import React, { useState, useCallback, useMemo } from 'react';
// FIX: Corrected module import paths to be relative.
import FileUpload from './components/FileUpload';
import ProgressTracker from './components/ProgressTracker';
import Dashboard from './components/Dashboard';
import ChatPanel from './components/ChatPanel';
import Header from './components/Header';
import Toast from './components/Toast';
import PipelineErrorDisplay from './components/PipelineErrorDisplay';
import { useAgentOrchestrator } from './hooks/useAgentOrchestrator';
import { logger } from './services/logger';
import LogsPanel from './components/LogsPanel';
import DateRangeFilter from './components/DateRangeFilter';
import IncrementalInsights from './components/IncrementalInsights';
import CollapsibleSection from './components/CollapsibleSection';
import BackendJobPanel from './components/backend/BackendJobPanel';
import BackendJobResultCard from './components/backend/BackendJobResultCard';
import { BackendPipelineProvider } from './context/BackendPipelineContext';
import type { AuditReport } from './types';
import dayjs from 'dayjs';

const App: React.FC = () => {
  const [showLogs, setShowLogs] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AuditReport[]>([]);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  const {
    agentStates,
    auditReport,
    messages,
    isStreaming,
    error,
    isPipelineRunning,
    isPipelineComplete,
    isAIEnriching,
    pipelineError,
    runPipeline,
    handleSendMessage,
    handleStopStreaming,
    setError,
    handleClassificationChange,
    handleCostCenterChange,
    runReconciliationPipeline,
    reset: resetOrchestrator,
  } = useAgentOrchestrator();

  const handleStartAnalysis = useCallback(async (files: File[]) => {
    logger.clear();
    logger.log('App', 'INFO', `Iniciando nova análise com ${files.length} arquivo(s).`);
    if (auditReport && isPipelineComplete) {
        setAnalysisHistory(prev => [...prev, auditReport]);
    }
    await runPipeline(files);
  }, [runPipeline, auditReport, isPipelineComplete]);

  const resetApp = useCallback(() => {
    resetOrchestrator();
    setAnalysisHistory([]);
    setDateFilter({ start: '', end: '' });
    logger.log('App', 'INFO', 'Aplicativo resetado para uma nova análise.');
  }, [resetOrchestrator]);

  const onAddFilesForChat = useCallback((files: File[]) => {
      handleStartAnalysis(files);
      setError("Iniciando nova análise com os arquivos adicionados...");
  }, [handleStartAnalysis, setError]);
  
  const filteredReport = useMemo(() => {
    if (!auditReport) return null;
    if (!dateFilter.start && !dateFilter.end) return auditReport;

    const start = dateFilter.start ? dayjs(dateFilter.start) : null;
    const end = dateFilter.end ? dayjs(dateFilter.end).endOf('day') : null;

    const filteredDocs = auditReport.documents.filter(doc => {
        const emissionDateStr = doc.doc.data?.[0]?.data_emissao;
        if (!emissionDateStr) return false;
        
        const emissionDate = dayjs(emissionDateStr);
        if (!emissionDate.isValid()) return false;

        if (start && emissionDate.isBefore(start)) return false;
        if (end && emissionDate.isAfter(end)) return false;

        return true;
    });

    return {
        ...auditReport,
        documents: filteredDocs,
    };
  }, [auditReport, dateFilter]);
  
  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen font-sans">
      <BackendPipelineProvider>
        <Header 
          onShowLogs={() => setShowLogs(true)} 
          onReset={resetApp} 
          isAnalysisComplete={isPipelineComplete && !isPipelineRunning}
        />
      
      <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        <BackendJobPanel />
        <BackendJobResultCard />

        {!isPipelineComplete && !pipelineError && (
          <div className="max-w-4xl mx-auto">
            {isPipelineRunning ? (
              <ProgressTracker agentStates={agentStates} />
            ) : (
              <FileUpload onStartAnalysis={handleStartAnalysis} disabled={isPipelineRunning} />
            )}
          </div>
        )}

        {pipelineError && (
          <PipelineErrorDisplay onReset={resetApp} errorMessage={error} />
        )}

        {isPipelineComplete && auditReport && filteredReport && (
          <div className="space-y-8">
            <DateRangeFilter onFilterChange={(start, end) => setDateFilter({ start, end })} disabled={isPipelineRunning} />
            
            {analysisHistory.length > 0 && (
                <CollapsibleSection title="Análise Comparativa Incremental" defaultOpen={true}>
                    <IncrementalInsights history={[...analysisHistory, auditReport]} />
                </CollapsibleSection>
            )}

            <Dashboard
                report={filteredReport}
                onClassificationChange={handleClassificationChange}
                onCostCenterChange={handleCostCenterChange}
                onStartReconciliation={runReconciliationPipeline}
                isReconciliationRunning={agentStates.reconciliation.status === 'running'}
                isAIEnriching={isAIEnriching}
            />
            <div className="pt-8 border-t border-gray-700/50">
                <h2 className="text-2xl font-bold text-gray-200 mb-4 text-center">Explore os Dados</h2>
                <ChatPanel
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isStreaming={isStreaming}
                    onStopStreaming={handleStopStreaming}
                    report={auditReport}
                    setError={setError}
                    onAddFiles={onAddFilesForChat}
                />
            </div>
          </div>
        )}
      </main>

      {error && <Toast message={error} onClose={() => setError(null)} />}
      {showLogs && <LogsPanel onClose={() => setShowLogs(false)} />}
    </BackendPipelineProvider>
  </div>
);
};

export default App;
