// types.ts

// --- Agent & Pipeline States ---

export type AgentName = 'ocr' | 'auditor' | 'classifier' | 'crossValidator' | 'intelligence' | 'accountant' | 'reconciliation';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'error';

export interface AgentProgress {
  step: string;
  current: number;
  total: number;
}

export interface AgentState {
  name: AgentName;
  status: AgentStatus;
  progress?: AgentProgress;
  error?: string;
}

export type AgentStates = Record<AgentName, AgentState>;

// --- Document & Data Types ---

export type DocumentKind =
  | 'NFE_XML'
  | 'CSV'
  | 'XLSX'
  | 'PDF'
  | 'IMAGE'
  | 'JSON'
  | 'TXT'
  | 'ZIP'
  | 'UNSUPPORTED';

export interface ImportedDoc {
  kind: DocumentKind;
  name: string;
  size: number;
  status: 'parsed' | 'error' | 'unsupported';
  data?: Record<string, any>[];
  text?: string;
  error?: string;
  raw: File;
  meta?: Record<string, any>;
}

export type StructuralQuality = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface StructuralIssue {
  code: string;
  message: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  hint?: string;
}

export interface EncodingDiagnosis {
  detected: string;
  normalized: string;
  confidence: number;
  bomStripped: boolean;
  attemptedEncodings: string[];
}

export interface FileStructuralSummary {
  format: string;
  mimeType?: string;
  sizeInBytes: number;
  checksum: string;
  internalPath?: string;
  parentArchive?: string;
  encoding: EncodingDiagnosis;
  delimiter?: string;
  quoteChar?: string;
  headersPresent?: boolean;
  columnCount?: number;
  columns?: string[];
  rowCount?: number;
  sampleRows?: Record<string, any>[];
  language?: string;
  locale?: string;
  quality: StructuralQuality;
  issues: StructuralIssue[];
  metrics?: Record<string, number>;
  processingLog: string[];
  discardedFiles?: string[];
  columnProfiles?: ColumnSemanticProfile[];
}

export interface ColumnSemanticProfile {
  name: string;
  semanticType: 'date' | 'datetime' | 'currency' | 'numeric' | 'categorical' | 'text' | 'identifier';
  confidence: number;
  nullPercentage: number;
  uniqueValues: number;
  sampleValues: (string | number | null)[];
  outlierRate?: number;
  duplicatesDetected?: boolean;
  stats?: {
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    stdDev?: number;
  };
  notes?: string[];
}

export interface AuditedDocument {
  doc: ImportedDoc;
  status: AuditStatus;
  score: number;
  inconsistencies: Inconsistency[];
  classification?: ClassificationResult;
  reconciliationStatus?: ReconciliationStatus;
}

export type AuditStatus = 'OK' | 'ALERTA' | 'ERRO';

export interface Inconsistency {
  code: string;
  message: string;
  explanation: string;
  normativeBase?: string;
  severity: 'ERRO' | 'ALERTA' | 'INFO';
}

export interface ClassificationResult {
  operationType: 'Compra' | 'Venda' | 'Devolução' | 'Serviço' | 'Transferência' | 'Outros';
  businessSector: string;
  confidence: number;
  costCenter: string;
}

// --- Report Structure ---

export interface AuditReport {
  summary: ExecutiveSummary;
  aggregatedMetrics: Record<string, string | number>;
  documents: AuditedDocument[];
  aiDrivenInsights: AIDrivenInsight[];
  deterministicCrossValidation: DeterministicCrossValidationResult[];
  crossValidationResults: CrossValidationResult[];
  reconciliationResult?: ReconciliationResult;
}

export interface ExecutiveSummary {
  title: string;
  summary: string;
  keyMetrics: KeyMetric[];
  actionableInsights: string[];
}

export interface KeyMetric {
  metric: string;
  value: string;
  status: 'OK' | 'ALERT' | 'PARTIAL' | 'UNAVAILABLE';
  explanation: string;
  insight?: string;
}

// --- AI & Cross-Validation Insights ---

export type AIFindingSeverity = 'INFO' | 'BAIXA' | 'MÉDIA' | 'ALTA';

export interface AIDrivenInsight {
  category: 'Eficiência Operacional' | 'Risco Fiscal' | 'Oportunidade de Otimização' | 'Anomalia de Dados';
  description: string;
  severity: AIFindingSeverity;
  evidence: string[];
}

export interface DeterministicCrossValidationResult {
  comparisonKey: string;
  attribute: string;
  description: string;
  discrepancies: {
    valueA: string;
    docA: { name: string; internal_path?: string };
    valueB: string;
    docB: { name: string; internal_path?: string };
  }[];
  severity: 'ALERTA' | 'INFO';
}

export interface CrossValidationResult {
  attribute: string;
  observation: string;
  documents: {
    name: string;
    value: string | number;
  }[];
}

export interface SmartSearchResult {
    summary: string;
    data?: string[][];
    references?: string[];
}

// --- Chat & UI Types ---

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  chartData?: ChartData;
}

export interface ChartData {
  type: 'bar' | 'pie' | 'line' | 'scatter';
  title: string;
  data: {
    label: string;
    value: number;
    x?: number;
    color?: string;
  }[];
  options?: any;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export type ExportType = 'pdf' | 'docx' | 'html';

// --- Bank Reconciliation Types ---

export type ReconciliationStatus = 'CONCILIADO' | 'PENDENTE';

export interface BankTransaction {
    id: string;
    date: string; // YYYY-MM-DD
    amount: number; // positive for credit, negative for debit
    description: string;
    type: 'CREDIT' | 'DEBIT';
    sourceFile: string;
}

export interface ReconciliationResult {
    matchedPairs: { doc: AuditedDocument; transaction: BankTransaction }[];
    unmatchedDocuments: AuditedDocument[];
    unmatchedTransactions: BankTransaction[];
}

// --- Worker & API Client Communication ---

export type WorkerMessageType = 'AGENT_UPDATE' | 'PIPELINE_RESULT' | 'PIPELINE_ERROR' | 'AI_ENRICH_START' | 'RECONCILIATION_RESULT';

export interface WorkerMessage {
    type: WorkerMessageType;
    payload?: any;
}

export interface ApiClientCallbacks {
    onAgentUpdate: (states: Partial<AgentStates>) => void;
    onPipelineResult: (report: AuditReport) => void;
    onPipelineError: (error: string) => void;
    onAIEnrichStart: () => void;
    onReconciliationResult: (result: { reconciliationResult: ReconciliationResult }) => void;
}
