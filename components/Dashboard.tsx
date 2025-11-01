import React, { useState, useMemo } from 'react';
import type {
  AuditReport,
  AuditedDocument,
  AuditStatus,
  ClassificationResult,
  AIDrivenInsight,
  AIFindingSeverity,
  KeyMetric,
  ReconciliationStatus,
  FileStructuralSummary,
  StructuralQuality,
} from '../types';
// FIX: Corrected module import paths to be relative.
import { 
    MetricIcon, 
    InsightIcon, 
    ShieldCheckIcon, 
    ShieldExclamationIcon, 
    ChevronDownIcon,
    FileIcon,
    AiIcon,
    FileInfoIcon,
    UploadIcon,
    LoadingSpinnerIcon
} from './icons';
import ReconciliationView from './ReconciliationView';
import CollapsibleSection from './CollapsibleSection';
import Chart from './Chart';
// FIX: Changed import to a named import to match the updated export in SmartSearch.tsx.
import { SmartSearch } from './SmartSearch';
import AnalysisDisplay from './AnalysisDisplay';
import CrossValidationPanel from './CrossValidationPanel';

// --- STYLES & CONFIGS ---

const statusStyles: { [key in AuditStatus]: { badge: string; icon: React.ReactNode; text: string; } } = {
    OK: { badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30', icon: <ShieldCheckIcon className="w-5 h-5 text-teal-400" />, text: 'OK' },
    ALERTA: { badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icon: <ShieldExclamationIcon className="w-5 h-5 text-yellow-400" />, text: 'Alerta' },
    ERRO: { badge: 'bg-red-500/20 text-red-300 border-red-500/30', icon: <ShieldExclamationIcon className="w-5 h-5 text-red-400" />, text: 'Erro' }
};

const reconciliationStatusStyles: { [key in ReconciliationStatus]: { icon: React.ReactNode; title: string; } } = {
    CONCILIADO: { icon: <ShieldCheckIcon className="w-4 h-4 text-green-400" />, title: 'Conciliado com extrato bancário' },
    PENDENTE: { icon: <FileInfoIcon className="w-4 h-4 text-yellow-400" />, title: 'Pendente de conciliação' }
};

const classificationOptions: ClassificationResult['operationType'][] = ['Compra', 'Venda', 'Devolução', 'Serviço', 'Transferência', 'Outros'];
const classificationStyles: { [key in ClassificationResult['operationType']]: string } = {
    Compra: 'bg-blue-500/30 text-blue-300', Venda: 'bg-green-500/30 text-green-300', Devolução: 'bg-orange-500/30 text-orange-300',
    Serviço: 'bg-purple-500/30 text-purple-300', Transferência: 'bg-indigo-500/30 text-indigo-300', Outros: 'bg-gray-500/30 text-gray-300',
};

const severityStyles: Record<AIFindingSeverity, string> = { INFO: 'border-l-sky-500', BAIXA: 'border-l-yellow-500', MÉDIA: 'border-l-orange-500', ALTA: 'border-l-red-500' };

const statusConfig: Record<KeyMetric['status'], { icon: React.FC<any>; iconClass: string; borderClass: string; valueClass: string; }> = {
    OK: { icon: ShieldCheckIcon, iconClass: 'text-teal-400', borderClass: 'border-l-transparent hover:border-l-teal-500/50', valueClass: 'text-teal-300' },
    ALERT: { icon: ShieldExclamationIcon, iconClass: 'text-red-400', borderClass: 'border-l-red-500', valueClass: 'text-red-300' },
    PARTIAL: { icon: ShieldExclamationIcon, iconClass: 'text-yellow-400', borderClass: 'border-l-yellow-500', valueClass: 'text-yellow-300' },
    UNAVAILABLE: { icon: FileInfoIcon, iconClass: 'text-gray-500', borderClass: 'border-l-gray-600', valueClass: 'text-gray-500' }
};

const structuralQualityStyles: Record<StructuralQuality, string> = {
    EXCELLENT: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    GOOD: 'bg-sky-500/15 text-sky-300 border border-sky-500/40',
    FAIR: 'bg-amber-500/15 text-amber-200 border border-amber-500/40',
    POOR: 'bg-rose-600/20 text-rose-200 border border-rose-500/40',
};

const INITIAL_DOC_COUNT = 50;
const DOC_BATCH_SIZE = 50;

// --- SUB-COMPONENTS ---

const KeyMetricDisplay: React.FC<{ item: KeyMetric }> = ({ item }) => {
    const config = statusConfig[item.status] || statusConfig.UNAVAILABLE;
    return (
        <div className={`bg-gray-700/50 p-4 rounded-md relative border-l-4 transition-colors group ${config.borderClass}`} title={item.explanation}>
            <div className="absolute top-2 right-2 opacity-50 group-hover:opacity-100 transition-opacity"><config.icon className={`w-5 h-5 ${config.iconClass}`} /></div>
            <p className={`font-bold text-lg ${config.valueClass}`}>{item.value}</p>
            <p className="text-sm font-semibold text-gray-300">{item.metric}</p>
            {item.insight && <p className="text-xs text-gray-400 mt-1">{item.insight}</p>}
        </div>
    );
};

const issueStyles: Record<'INFO' | 'WARN' | 'ERROR', string> = {
    INFO: 'bg-slate-700/50 text-slate-200 border border-slate-600/60',
    WARN: 'bg-amber-500/15 text-amber-200 border border-amber-500/40',
    ERROR: 'bg-rose-600/15 text-rose-200 border border-rose-500/40',
};

const StructuralDiagnostics: React.FC<{ report?: FileStructuralSummary }> = ({ report }) => {
    if (!report) return null;

    const topColumns = (report.columnProfiles ?? []).slice(0, 3);

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
                <h6 className="text-xs uppercase tracking-[0.2em] text-slate-400">Resumo Estrutural</h6>
                <dl className="mt-3 space-y-2 text-xs text-slate-200">
                    <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Formato detectado</dt>
                        <dd className="font-semibold text-slate-100">{report.format}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Encoding</dt>
                        <dd>{report.encoding.normalized.toUpperCase()}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Linhas x Colunas</dt>
                        <dd>{(report.rowCount ?? 0).toLocaleString()} × {report.columnCount ?? 0}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Idioma/Locale</dt>
                        <dd>{report.language ?? '—'} {report.locale ? `· ${report.locale}` : ''}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-slate-400">Checksum</dt>
                        <dd className="font-mono text-[10px] text-slate-400 truncate max-w-[12rem]" title={report.checksum}>{report.checksum}</dd>
                    </div>
                    {report.parentArchive && (
                        <div className="flex justify-between gap-3">
                            <dt className="text-slate-400">Origem</dt>
                            <dd className="text-slate-300">{report.parentArchive}{report.internalPath ? ` › ${report.internalPath}` : ''}</dd>
                        </div>
                    )}
                </dl>
                {report.processingLog.length > 0 && (
                    <div className="mt-4">
                        <h6 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.18em]">Pipeline</h6>
                        <ul className="mt-2 space-y-1 text-[11px] text-slate-300">
                            {report.processingLog.slice(0, 4).map((step, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400/80"></span>
                                    <span className="flex-1">{step}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
                    <h6 className="text-xs uppercase tracking-[0.2em] text-slate-400">Alertas Estruturais</h6>
                    {report.issues.length === 0 ? (
                        <p className="mt-3 text-xs text-emerald-200">Nenhum alerta relevante — estrutura validada.</p>
                    ) : (
                        <ul className="mt-3 space-y-2 text-[11px]">
                            {report.issues.slice(0, 4).map((issue, index) => (
                                <li key={index} className={`rounded-lg px-3 py-2 ${issueStyles[issue.severity]}`}>
                                    <p className="font-semibold">{issue.message}</p>
                                    {issue.hint && <p className="mt-1 text-[10px] text-slate-300">{issue.hint}</p>}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {topColumns.length > 0 && (
                    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
                        <h6 className="text-xs uppercase tracking-[0.2em] text-slate-400">Perfis de Colunas</h6>
                        <ul className="mt-3 space-y-2 text-[11px] text-slate-200">
                            {topColumns.map((column) => (
                                <li key={column.name} className="rounded-lg border border-white/5 bg-slate-800/60 px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-slate-100">{column.name}</span>
                                        <span className="text-[10px] uppercase tracking-wide text-sky-300">{column.semanticType}</span>
                                    </div>
                                    <p className="mt-1 text-[10px] text-slate-300">
                                        Nulos: {Math.round(column.nullPercentage * 100)}% · Únicos: {column.uniqueValues}
                                        {column.outlierRate !== undefined ? ` · Outliers: ${Math.round((column.outlierRate || 0) * 100)}%` : ''}
                                    </p>
                                    {column.notes && column.notes.length > 0 && (
                                        <ul className="mt-1 space-y-1 text-[10px] text-amber-200">
                                            {column.notes.slice(0, 2).map((note, idx) => (
                                                <li key={idx}>• {note}</li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

const DocumentItem: React.FC<{ item: AuditedDocument; onClassificationChange: Function; onCostCenterChange: Function; }> = ({ item, onClassificationChange, onCostCenterChange }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { doc, status, inconsistencies, classification, reconciliationStatus } = item;
    const structuralReport = doc.meta?.structuralReport as FileStructuralSummary | undefined;
    const qualityBadgeClass = structuralReport ? structuralQualityStyles[structuralReport.quality] : '';
    const canExpand = Boolean(structuralReport) || inconsistencies.length > 0;

    return (
        <div className="bg-gray-700/50 rounded-lg">
            <div
                className={`flex items-center p-3 flex-wrap sm:flex-nowrap gap-2 ${canExpand ? 'cursor-pointer' : ''}`}
                onClick={() => canExpand && setIsExpanded((prev) => !prev)}
            >
                {statusStyles[status].icon}
                <span className="truncate mx-3 flex-1 text-gray-300 text-sm order-1 sm:order-none w-full sm:w-auto">{doc.name}</span>
                {structuralReport && (
                    <span
                        className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-1 rounded-full ${qualityBadgeClass}`}
                    >
                        {structuralReport.quality} · {structuralReport.format}
                    </span>
                )}
                <div className="flex items-center gap-2 ml-auto order-2 sm:order-none">
                    {reconciliationStatus && (
                        <span title={reconciliationStatusStyles[reconciliationStatus].title}>
                            {reconciliationStatusStyles[reconciliationStatus].icon}
                        </span>
                    )}
                    {classification && (
                        <select
                            value={classification.operationType}
                            onChange={(e) => {
                                e.stopPropagation();
                                onClassificationChange(doc.name, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap border-none appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${classificationStyles[classification.operationType]}`}
                        >
                            {classificationOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    )}
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${statusStyles[status].badge}`}>
                        {statusStyles[status].text}
                    </span>
                    {canExpand && (
                        <ChevronDownIcon
                            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                    )}
                </div>
            </div>
            {isExpanded && canExpand && (
                <div className="border-t border-gray-600/50 p-4 space-y-4 animate-fade-in-down">
                    <StructuralDiagnostics report={structuralReport} />
                    {inconsistencies.length > 0 ? (
                        <div>
                            <h5 className="font-semibold text-sm mb-2 text-gray-300">Inconsistências Encontradas:</h5>
                            <ul className="space-y-3">
                                {inconsistencies.map((inc, index) => (
                                    <li key={index} className="text-xs border-l-2 border-yellow-500/50 pl-3">
                                        <p className="font-semibold text-yellow-300">
                                            {inc.message}{' '}
                                            <span className="text-gray-500 font-mono">({inc.code})</span>
                                        </p>
                                        <p className="text-gray-400 mt-1">
                                            <span className="font-semibold">XAI:</span> {inc.explanation}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        structuralReport && (
                            <p className="text-[11px] text-emerald-200">
                                Nenhuma inconsistência fiscal detectada para este documento.
                            </p>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---

interface DashboardProps {
    report: AuditReport;
    onClassificationChange: (docName: string, newClassification: ClassificationResult['operationType']) => void;
    onCostCenterChange: (docName: string, newCostCenter: string) => void;
    onStartReconciliation: (files: File[]) => void;
    isReconciliationRunning: boolean;
    isAIEnriching: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ report, onClassificationChange, onCostCenterChange, onStartReconciliation, isReconciliationRunning, isAIEnriching }) => {
  const { summary, documents, aiDrivenInsights, deterministicCrossValidation, crossValidationResults, reconciliationResult } = report;
  const [bankFiles, setBankFiles] = useState<File[]>([]);
  const [visibleDocCount, setVisibleDocCount] = useState(INITIAL_DOC_COUNT);
  
  const handleBankFiles = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) setBankFiles(Array.from(e.target.files)); }
  const handleStartReconciliation = () => { if (bankFiles.length > 0) { onStartReconciliation(bankFiles); setBankFiles([]); } }

  const docStats = useMemo(() => documents.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
  }, {} as Record<AuditStatus, number>), [documents]);
  
  const AILoadingIndicator = () => (
      <div className="flex items-center justify-center gap-2 text-sm text-gray-400 p-4">
          <LoadingSpinnerIcon className="w-5 h-5 animate-spin text-blue-400" />
          <span>Analisando com IA para gerar insights...</span>
      </div>
  );

  const handleLoadMoreDocs = () => {
    setVisibleDocCount(prev => Math.min(prev + DOC_BATCH_SIZE, documents.length));
  };
  
  return (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg animate-fade-in space-y-8">
      
      {/* Executive Summary */}
      <div>
        <h2 className="text-2xl font-bold text-gray-200 mb-4">Análise Executiva</h2>
        <div className="text-gray-300 space-y-6">
            {isAIEnriching && !summary ? (
                <AILoadingIndicator />
            ) : summary ? (
                <>
                    <h3 data-export-title className="text-xl font-semibold text-blue-400">{summary.title}</h3>
                    <p className="text-sm leading-relaxed">{summary.summary}</p>
                    <div>
                        <h4 className="flex items-center text-md font-semibold text-gray-300 mb-3"><MetricIcon className="w-5 h-5 mr-2 text-gray-400"/>Métricas Chave</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{summary.keyMetrics.map((item, index) => <KeyMetricDisplay key={index} item={item} />)}</div>
                    </div>
                    <div>
                        <h4 className="flex items-center text-md font-semibold text-gray-300 mb-3"><InsightIcon className="w-5 h-5 mr-2 text-gray-400"/>Insights Acionáveis</h4>
                        <ul className="list-disc list-inside space-y-2 text-sm">{summary.actionableInsights.map((item, index) => <li key={index}>{item}</li>)}</ul>
                    </div>
                </>
            ) : null}
        </div>
      </div>

      <CollapsibleSection title="Visualização de Dados e Simulações">
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-700/30 p-4 rounded-lg">
                <SmartSearch report={report} />
            </div>
            <div className="bg-gray-700/30 p-4 rounded-lg">
                 <Chart type="pie" title="Distribuição por Status" data={Object.entries(docStats).map(([label, value]) => ({ label, value }))} />
            </div>
         </div>
      </CollapsibleSection>

      <CollapsibleSection title="Validação Cruzada e Análise de Risco">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-2">
                 <h3 className="font-semibold text-gray-300">Determinística (Baseada em Regras)</h3>
                 <AnalysisDisplay results={deterministicCrossValidation} />
            </div>
            <div className="space-y-2">
                 <h3 className="font-semibold text-gray-300">Análise por IA</h3>
                 {isAIEnriching ? <AILoadingIndicator/> : <CrossValidationPanel results={crossValidationResults} />}
            </div>
        </div>
      </CollapsibleSection>
       
       <CollapsibleSection title="Insights Estratégicos Gerados por IA">
            {isAIEnriching ? <AILoadingIndicator/> : (
                aiDrivenInsights && aiDrivenInsights.length > 0 ? (
                    <div className="space-y-3">{aiDrivenInsights.map((insight, index) => (
                        <div key={index} className={`bg-gray-700/50 p-4 rounded-lg border-l-4 ${severityStyles[insight.severity]}`}>
                            <div className="flex justify-between items-start">
                                <div><p className="font-semibold text-gray-200">{insight.category}</p><p className="text-sm text-gray-400 mt-1">{insight.description}</p></div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-md`}>{insight.severity}</span>
                            </div>
                            {insight.evidence?.length > 0 && <p className="text-xs text-gray-500 mt-2"><span className="font-semibold">Evidências:</span> {insight.evidence.join(', ')}</p>}
                        </div>
                    ))}</div>
                ) : (
                     <div className="bg-gray-700/30 p-4 rounded-lg text-center"><p className="text-sm text-teal-400">✅ Nenhuma oportunidade ou risco estratégico foi destacado pela IA nesta análise.</p></div>
                )
            )}
        </CollapsibleSection>
      
       <CollapsibleSection title="Conciliação Bancária">
            <div className="bg-gray-700/30 p-4 rounded-lg space-y-4">
                {!isReconciliationRunning && !reconciliationResult && (
                    <><p className="text-xs text-gray-400 text-center">Faça o upload de extratos bancários (.OFX, .CSV) para cruzar com os documentos fiscais.</p><div className="flex items-center justify-center gap-3">
                        <label htmlFor="bank-file-upload" className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"><UploadIcon className="w-5 h-5" /><span>Selecionar Extrato(s)</span></label>
                        <input id="bank-file-upload" type="file" multiple accept=".ofx,.csv" className="hidden" onChange={handleBankFiles}/>
                        {bankFiles.length > 0 && <span className="text-sm text-gray-400">{bankFiles.length} arquivo(s) selecionado(s).</span>}
                    </div>
                    {bankFiles.length > 0 && <button onClick={handleStartReconciliation} disabled={isReconciliationRunning} className="w-full mt-2 bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-600">Iniciar Conciliação</button>}
                    </>
                )}
                {isReconciliationRunning && <div className="flex items-center justify-center gap-3 text-lg text-teal-300 p-8"><LoadingSpinnerIcon className="w-8 h-8 animate-spin" /><span>Realizando conciliação...</span></div>}
                {reconciliationResult && <ReconciliationView result={reconciliationResult} />}
            </div>
        </CollapsibleSection>

      <CollapsibleSection title="Detalhes por Documento">
         <div className="bg-gray-700/30 p-4 rounded-lg mb-4 flex justify-around items-center text-center flex-wrap gap-4">
            <div className="text-gray-300"><span className="text-2xl font-bold">{documents.length}</span><br/><span className="text-xs">Total</span></div>
            <div className="text-teal-300"><span className="text-2xl font-bold">{docStats.OK || 0}</span><br/><span className="text-xs">OK</span></div>
            <div className="text-yellow-300"><span className="text-2xl font-bold">{docStats.ALERTA || 0}</span><br/><span className="text-xs">Alertas</span></div>
            <div className="text-red-300"><span className="text-2xl font-bold">{docStats.ERRO || 0}</span><br/><span className="text-xs">Erros</span></div>
         </div>
         <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {documents.slice(0, visibleDocCount).map((item, index) => <DocumentItem key={`${item.doc.name}-${index}`} item={item} onClassificationChange={onClassificationChange} onCostCenterChange={onCostCenterChange} />)}
         </div>
         {documents.length > visibleDocCount && (
            <div className="mt-4 text-center">
                <p className="text-xs text-gray-500 mb-2">Exibindo {visibleDocCount} de {documents.length} documentos.</p>
                <button
                    onClick={handleLoadMoreDocs}
                    className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-lg transition-colors"
                >
                    Carregar mais {Math.min(DOC_BATCH_SIZE, documents.length - visibleDocCount)}
                </button>
            </div>
         )}
      </CollapsibleSection>
    </div>
  );
};

export default Dashboard;
