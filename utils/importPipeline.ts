import type {
  DocumentKind,
  ImportedDoc,
  FileStructuralSummary,
  StructuralIssue,
  ColumnSemanticProfile,
} from '../types';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { runOCRFromImage } from '../agents/ocrExtractor';
import { extractDataFromText } from '../agents/nlpAgent';
import { logger } from '../services/logger';
import { decodeBufferToText, readFileAsArrayBuffer } from './encodingHelpers';

interface FileContext {
  parentArchive?: string;
  internalPath?: string;
}

interface FileQueueItem {
  file: File;
  context: FileContext;
}

interface ProcessResult {
  documents: ImportedDoc[];
  newFiles: FileQueueItem[];
}

const BLOCKED_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.msi',
  '.dll',
  '.vbs',
  '.scr',
]);
const DELIMITER_CANDIDATES = [',', ';', '\t', '|', '^', '~'];
const QUOTE_CANDIDATES = ['"', "'"];
const DATE_FORMATS = [
  'YYYY-MM-DD',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY/MM/DD',
  'YYYY-MM-DDTHH:mm:ssZ',
  'DD-MM-YYYY',
  'DD.MM.YYYY',
];

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  allowBooleanAttributes: true,
  parseAttributeValue: true,
});

const getExtension = (name: string): string =>
  `.${name.split('.').pop()?.toLowerCase() ?? ''}`;

const guessMimeFromExtension = (ext: string): string => {
  switch (ext) {
    case '.csv':
      return 'text/csv';
    case '.xml':
      return 'application/xml';
    case '.json':
      return 'application/json';
    case '.txt':
      return 'text/plain';
    case '.zip':
      return 'application/zip';
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
};

const detectKind = (
  file: File,
  firstBytes?: Uint8Array,
  mimeHint?: string
): DocumentKind => {
  const extension = getExtension(file.name);
  const mime = mimeHint ?? file.type ?? guessMimeFromExtension(extension);
  const signature = firstBytes?.slice(0, 4).join(',');

  if (extension === '.zip' || signature === '80,75,3,4') return 'ZIP';
  if (extension === '.xml' || mime.includes('xml')) return 'NFE_XML';
  if (extension === '.csv' || mime.includes('csv')) return 'CSV';
  if (extension === '.json' || mime.includes('json')) return 'JSON';
  if (extension === '.txt' || mime.startsWith('text/')) return 'TXT';
  if (extension === '.xlsx') return 'XLSX';
  if (extension === '.pdf' || mime.includes('pdf')) return 'PDF';
  if (
    ['.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff'].includes(extension) ||
    mime.startsWith('image/')
  )
    return 'IMAGE';
  return 'UNSUPPORTED';
};

const computeChecksum = async (buffer: ArrayBuffer): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback checksum (non-cryptographic)
  const bytes = new Uint8Array(buffer);
  let hash = 0;
  for (const byte of bytes) {
    hash = (hash + byte) % 0xfffffff;
  }
  return hash.toString(16).padStart(8, '0');
};

const severityWeights: Record<StructuralIssue['severity'], number> = {
  INFO: 1,
  WARN: 5,
  ERROR: 15,
};

const qualityFromIssues = (issues: StructuralIssue[]) => {
  const penalty = issues.reduce(
    (sum, issue) => sum + (severityWeights[issue.severity] ?? 0),
    0
  );
  const score = Math.max(0, 100 - penalty);
  if (score >= 85) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'FAIR';
  return 'POOR';
};

const detectLanguageAndLocale = (samples: (string | number | null)[]) => {
  const sampleText = samples
    .filter((value) => typeof value === 'string')
    .slice(0, 50) as string[];
  const combined = sampleText.join(' ');
  const hasPortugueseAccents = /[ãõâêôáéíóúç]/i.test(combined);
  const hasCommaDecimals = /-?\d{1,3}(\.\d{3})*,\d{2}/.test(combined);
  const hasDotDecimals = /-?\d+\.\d{2}/.test(combined);

  let language = 'en-US';
  let locale = 'en-US';
  if (hasPortugueseAccents || hasCommaDecimals) {
    language = 'pt-BR';
    locale = 'pt-BR';
  } else if (!hasDotDecimals && combined.includes('€')) {
    language = 'pt-PT';
    locale = 'pt-PT';
  }

  return { language, locale };
};

const determineDelimiter = (text: string) => {
  let bestDelimiter = ',';
  let bestScore = -Infinity;
  let bestFields: string[] | undefined;

  for (const delimiter of DELIMITER_CANDIDATES) {
    const preview = Papa.parse<string[]>(text, {
      delimiter,
      preview: 20,
      skipEmptyLines: true,
    });

    const fields = preview.meta.fields;
    const uniqueFieldCount = fields ? new Set(fields.filter(Boolean)).size : 0;
    const score =
      (fields?.length ?? 0) * 2 -
      (preview.errors.length * 5) -
      (fields && fields.includes('') ? 3 : 0);

    if (score > bestScore && uniqueFieldCount > 0) {
      bestScore = score;
      bestDelimiter = delimiter;
      bestFields = fields;
    }
  }

  const quoteChar =
    QUOTE_CANDIDATES.find((quote) => text.includes(`${quote}${bestDelimiter}`)) ??
    '"';

  return { delimiter: bestDelimiter, quoteChar, fields: bestFields };
};

const parseNumerical = (value: string, locale: string): number | null => {
  if (typeof value !== 'string') return Number.isFinite(value) ? Number(value) : null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  const normalized =
    locale === 'pt-BR'
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateColumnProfiles = (
  data: Record<string, any>[],
  columns: string[],
  locale: string
): ColumnSemanticProfile[] => {
  const profiles: ColumnSemanticProfile[] = [];
  const totalRows = data.length;

  for (const column of columns) {
    const values = data.map((row) => row[column]);
    const nonNullValues = values.filter(
      (value) => value !== null && value !== undefined && value !== ''
    );
    const nullPercentage = totalRows === 0 ? 0 : (values.length - nonNullValues.length) / totalRows;
    const uniqueValues = new Set(nonNullValues.map((value) => String(value))).size;

    const sampleValues = nonNullValues.slice(0, 5).map((value) => value ?? null);
    const issues: string[] = [];

    let semanticType: ColumnSemanticProfile['semanticType'] = 'text';
    let confidence = 0.2;
    let stats: ColumnSemanticProfile['stats'];
    let outlierRate: number | undefined;
    let duplicatesDetected = false;

    const numericCandidates = nonNullValues
      .map((value) => parseNumerical(String(value), locale))
      .filter((value): value is number => value !== null);

    const currencyMatches = nonNullValues.filter((value) =>
      /\p{Sc}/u.test(String(value)) || /R\$|USD|EUR|£/.test(String(value))
    );
    const dateMatches = nonNullValues.filter((value) =>
      DATE_FORMATS.some((format) => dayjs(String(value), format, true).isValid())
    );
    const identifierLike =
      column.toLowerCase().includes('id') ||
      column.toLowerCase().includes('numero') ||
      column.toLowerCase().includes('nf');

    if (currencyMatches.length / (nonNullValues.length || 1) > 0.6) {
      semanticType = 'currency';
      confidence = 0.9;
    } else if (numericCandidates.length / (nonNullValues.length || 1) > 0.7) {
      semanticType = 'numeric';
      confidence = 0.85;
    } else if (dateMatches.length / (nonNullValues.length || 1) > 0.6) {
      const hasTimeComponent = nonNullValues.some((value) =>
        /T\d{2}:\d{2}/.test(String(value))
      );
      semanticType = hasTimeComponent ? 'datetime' : 'date';
      confidence = 0.8;
    } else if (identifierLike && uniqueValues > totalRows * 0.7) {
      semanticType = 'identifier';
      confidence = 0.7;
    } else if (uniqueValues <= totalRows * 0.1) {
      semanticType = 'categorical';
      confidence = 0.6;
    }

    if (semanticType === 'numeric' || semanticType === 'currency') {
      if (numericCandidates.length > 0) {
        const sorted = [...numericCandidates].sort((a, b) => a - b);
        const sum = numericCandidates.reduce((acc, value) => acc + value, 0);
        const mean = sum / numericCandidates.length;
        const median =
          sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];
        const variance =
          numericCandidates.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
          numericCandidates.length;
        const stdDev = Math.sqrt(variance);

        const outliers = numericCandidates.filter((value) =>
          stdDev === 0 ? false : Math.abs((value - mean) / stdDev) > 3
        );
        outlierRate = outliers.length / numericCandidates.length;

        stats = {
          min: sorted[0],
          max: sorted[sorted.length - 1],
          mean,
          median,
          stdDev,
        };

        if (outlierRate > 0.05) {
          issues.push(
            `Coluna "${column}" apresenta ${Math.round(outlierRate * 100)}% de outliers.`
          );
        }
      }
    }

    if (identifierLike && uniqueValues < nonNullValues.length) {
      duplicatesDetected = true;
      issues.push(`Coluna identificadora "${column}" possui valores duplicados.`);
    }

    if (nullPercentage > 0.3) {
      issues.push(`Coluna "${column}" possui ${Math.round(nullPercentage * 100)}% de valores vazios.`);
    }

    profiles.push({
      name: column,
      semanticType,
      confidence,
      nullPercentage,
      uniqueValues,
      sampleValues,
      outlierRate,
      duplicatesDetected,
      stats,
      notes: issues.length > 0 ? issues : undefined,
    });
  }

  return profiles;
};

const buildSummaryBase = async (
  file: File,
  context: FileContext,
  buffer: ArrayBuffer,
  encodingInfo: FileStructuralSummary['encoding']
): Promise<Omit<FileStructuralSummary, 'format' | 'quality' | 'issues'>> => {
  const checksum = await computeChecksum(buffer);
  return {
    mimeType: file.type || guessMimeFromExtension(getExtension(file.name)),
    sizeInBytes: file.size,
    checksum,
    internalPath: context.internalPath,
    parentArchive: context.parentArchive,
    encoding: encodingInfo,
    processingLog: [],
  };
};

const processCsvText = (text: string, summary: FileStructuralSummary) => {
  const { delimiter, quoteChar, fields } = determineDelimiter(text);
  const parseResult = Papa.parse<Record<string, any>>(text, {
    delimiter,
    quoteChar,
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header?.trim(),
    dynamicTyping: false,
  });

  const issues: StructuralIssue[] = [];
  if (parseResult.errors.length > 0) {
    issues.push({
      code: 'CSV_PARSE',
      severity: 'WARN',
      message: `Foram encontradas ${parseResult.errors.length} inconsistências na leitura do CSV.`,
      hint: parseResult.errors[0]?.message,
    });
  }

  const columns = parseResult.meta.fields?.map((field) => field.trim()) ?? fields ?? [];
  if (columns.length === 0) {
    issues.push({
      code: 'CSV_NO_HEADERS',
      severity: 'ERROR',
      message: 'Não foi possível identificar cabeçalhos válidos no arquivo CSV.',
    });
  }

  summary.delimiter = delimiter;
  summary.quoteChar = quoteChar;
  summary.headersPresent = columns.length > 0;
  summary.columns = columns;
  summary.columnCount = columns.length;
  summary.rowCount = parseResult.data.length;
  summary.sampleRows = parseResult.data.slice(0, 5);

  const { language, locale } = detectLanguageAndLocale(
    [
      ...columns,
      ...parseResult.data.slice(0, 50).flatMap((row) => Object.values(row)),
    ] as (string | number | null)[]
  );
  summary.language = language;
  summary.locale = locale;
  summary.columnProfiles = calculateColumnProfiles(parseResult.data, columns, locale);

  for (const profile of summary.columnProfiles ?? []) {
    if (profile.duplicatesDetected) {
      issues.push({
        code: 'CSV_DUPLICATE_KEY',
        severity: 'WARN',
        message: `Coluna potencialmente identificadora "${profile.name}" possui resíduos duplicados.`,
      });
    }
    if ((profile.outlierRate ?? 0) > 0.05) {
      issues.push({
        code: 'CSV_OUTLIERS',
        severity: 'INFO',
        message: `Coluna "${profile.name}" apresentou outliers na pré-análise.`,
      });
    }
    if (profile.nullPercentage > 0.3) {
      issues.push({
        code: 'CSV_MISSING_DATA',
        severity: 'WARN',
        message: `Coluna "${profile.name}" possui alta taxa de campos vazios (${Math.round(
          profile.nullPercentage * 100
        )}%).`,
        hint: 'Considere validar a integridade da origem dos dados.',
      });
    }
  }

  summary.metrics = {
    linhas_validas: parseResult.data.length,
    colunas_detectadas: columns.length,
    erros_parser: parseResult.errors.length,
  };

  return {
    data: parseResult.data,
    issues,
  };
};

const processJsonText = (text: string, summary: FileStructuralSummary) => {
  const issues: StructuralIssue[] = [];
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    issues.push({
      code: 'JSON_PARSE',
      severity: 'ERROR',
      message: 'Falha ao interpretar o arquivo JSON.',
      hint: error instanceof Error ? error.message : String(error),
    });
    return { data: [], issues };
  }

  const dataArray = Array.isArray(parsed) ? parsed : [parsed];
  const columns = Array.from(
    dataArray.reduce<Set<string>>((fields, item) => {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach((key) => fields.add(key));
      }
      return fields;
    }, new Set())
  );

  summary.columns = columns;
  summary.columnCount = columns.length;
  summary.rowCount = dataArray.length;
  summary.sampleRows = dataArray.slice(0, 5);
  summary.headersPresent = columns.length > 0;

  const { language, locale } = detectLanguageAndLocale(
    dataArray.slice(0, 50).flatMap((row) =>
      row && typeof row === 'object' ? Object.values(row) : []
    ) as (string | number | null)[]
  );
  summary.language = language;
  summary.locale = locale;
  summary.columnProfiles = calculateColumnProfiles(dataArray, columns, locale);

  return { data: dataArray, issues };
};

const mapNFeItems = (xml: any) => {
  const det = xml?.NFe?.infNFe?.det;
  const detArray = Array.isArray(det) ? det : det ? [det] : [];
  const header = {
    nfe_id: xml?.NFe?.infNFe?.['Id'] ?? xml?.NFe?.infNFe?.['@_Id'] ?? null,
    data_emissao: xml?.NFe?.infNFe?.ide?.dhEmi ?? null,
    valor_total_nfe: xml?.NFe?.infNFe?.total?.ICMSTot?.vNF ?? null,
    emitente_nome: xml?.NFe?.infNFe?.emit?.xNome ?? null,
    emitente_cnpj: xml?.NFe?.infNFe?.emit?.CNPJ ?? null,
    emitente_uf: xml?.NFe?.infNFe?.emit?.enderEmit?.UF ?? null,
    destinatario_nome: xml?.NFe?.infNFe?.dest?.xNome ?? null,
    destinatario_cnpj: xml?.NFe?.infNFe?.dest?.CNPJ ?? null,
    destinatario_uf: xml?.NFe?.infNFe?.dest?.enderDest?.UF ?? null,
  };

  if (detArray.length === 0) {
    return [{ ...header, produto_nome: 'Itens não detalhados na NFe.' }];
  }

  return detArray.map((item: any) => ({
    ...header,
    produto_nome: item?.prod?.xProd ?? null,
    produto_ncm: item?.prod?.NCM ?? null,
    produto_cfop: item?.prod?.CFOP ?? null,
    produto_qtd: item?.prod?.qCom ?? null,
    produto_valor_unit: item?.prod?.vUnCom ?? null,
    produto_valor_total: item?.prod?.vProd ?? null,
    produto_base_calculo_icms: item?.imposto?.ICMS?.ICMS00?.vBC ?? null,
    produto_valor_icms: item?.imposto?.ICMS?.ICMS00?.vICMS ?? null,
    produto_aliquota_icms: item?.imposto?.ICMS?.ICMS00?.pICMS ?? null,
    produto_valor_pis: item?.imposto?.PIS?.PISAliq?.vPIS ?? null,
    produto_valor_cofins: item?.imposto?.COFINS?.COFINSAliq?.vCOFINS ?? null,
  }));
};

const processXmlText = (text: string, summary: FileStructuralSummary) => {
  const issues: StructuralIssue[] = [];
  let parsed: any;
  try {
    parsed = xmlParser.parse(text);
  } catch (error) {
    issues.push({
      code: 'XML_PARSE',
      severity: 'ERROR',
      message: 'Arquivo XML inválido ou malformado.',
      hint: error instanceof Error ? error.message : String(error),
    });
    return { data: [], issues };
  }

  const isNFe =
    parsed?.nfeProc || parsed?.NFe || parsed?.['nfeProc:proc'] || parsed?.['NFe:proc'];
  const data = isNFe ? mapNFeItems(parsed?.nfeProc ?? parsed) : [parsed];

  const columns = Array.from(
    data.reduce<Set<string>>((fields, item) => {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach((key) => fields.add(key));
      }
      return fields;
    }, new Set())
  );

  summary.columns = columns;
  summary.columnCount = columns.length;
  summary.rowCount = data.length;
  summary.sampleRows = data.slice(0, 5);
  summary.headersPresent = columns.length > 0;

  const { language, locale } = detectLanguageAndLocale(
    data.slice(0, 50).flatMap((row) =>
      row && typeof row === 'object' ? Object.values(row) : []
    ) as (string | number | null)[]
  );
  summary.language = language;
  summary.locale = locale;
  summary.columnProfiles = calculateColumnProfiles(data, columns, locale);

  if (!isNFe) {
    issues.push({
      code: 'XML_GENERIC',
      severity: 'INFO',
      message:
        'XML não identificado como NFe. Foi aplicada uma extração genérica para preservação do conteúdo.',
    });
  }

  return { data, issues };
};

const processTxt = (text: string, summary: FileStructuralSummary) => {
  const lines = text.split(/\r?\n/);
  summary.rowCount = lines.length;
  summary.columns = ['lineNumber', 'content'];
  summary.columnCount = 2;
  summary.sampleRows = lines.slice(0, 5).map((content, index) => ({
    lineNumber: index + 1,
    content,
  }));
  summary.headersPresent = true;

  const { language, locale } = detectLanguageAndLocale(lines.slice(0, 100));
  summary.language = language;
  summary.locale = locale;
  summary.columnProfiles = [
    {
      name: 'lineNumber',
      semanticType: 'numeric',
      confidence: 0.9,
      nullPercentage: 0,
      uniqueValues: lines.length,
      sampleValues: summary.sampleRows.map((row) => row.lineNumber),
      stats: { min: 1, max: lines.length, mean: lines.length / 2, median: Math.ceil(lines.length / 2), stdDev: 0 },
    },
    {
      name: 'content',
      semanticType: 'text',
      confidence: 0.5,
      nullPercentage: lines.filter((line) => line.trim().length === 0).length / lines.length,
      uniqueValues: new Set(lines).size,
      sampleValues: summary.sampleRows.map((row) => row.content),
    },
  ];

  const issues: StructuralIssue[] = [];
  if (summary.columnProfiles[1].nullPercentage > 0.5) {
    issues.push({
      code: 'TXT_EMPTY_LINES',
      severity: 'INFO',
      message: 'Arquivo texto com mais de 50% de linhas vazias.',
    });
  }

  const data = lines.map((content, index) => ({
    lineNumber: index + 1,
    content,
  }));

  return { data, issues };
};

const processOcrDocument = async (
  file: File,
  buffer: ArrayBuffer,
  summary: FileStructuralSummary
) => {
  const issues: StructuralIssue[] = [];

  const text = await runOCRFromImage(buffer);
  if (!text.trim()) {
    issues.push({
      code: 'OCR_EMPTY',
      severity: 'ERROR',
      message: 'Nenhum texto foi extraído do documento via OCR.',
    });
    return { data: [], text, issues };
  }

  const structuredData = await extractDataFromText(text);
  summary.sampleRows = Array.isArray(structuredData)
    ? structuredData.slice(0, 5)
    : undefined;
  summary.rowCount = Array.isArray(structuredData) ? structuredData.length : undefined;
  summary.columns = Array.isArray(structuredData) && structuredData.length
    ? Object.keys(structuredData[0])
    : undefined;
  summary.columnCount = summary.columns?.length;

  if (!summary.columns || summary.columns.length === 0) {
    issues.push({
      code: 'OCR_LOW_STRUCTURE',
      severity: 'WARN',
      message: 'O texto extraído não apresentou colunas estruturadas reconhecíveis.',
    });
  }

  return {
    data: Array.isArray(structuredData) ? structuredData : [],
    text,
    issues,
  };
};

const processXlsxBuffer = (buffer: ArrayBuffer, summary: FileStructuralSummary) => {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const issues: StructuralIssue[] = [];
  const allRows: Record<string, any>[] = [];
  const processingLog: string[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      defval: null,
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });
    processingLog.push(`Planilha "${sheetName}" com ${rows.length} linha(s).`);
    rows.forEach((row) => allRows.push({ sheet: sheetName, ...row }));
  });

  if (allRows.length === 0) {
    issues.push({
      code: 'XLSX_EMPTY',
      severity: 'ERROR',
      message: 'Nenhum dado foi identificado nas planilhas do arquivo XLSX.',
    });
  }

  summary.columns = allRows.length > 0 ? Object.keys(allRows[0]) : [];
  summary.columnCount = summary.columns.length;
  summary.rowCount = allRows.length;
  summary.sampleRows = allRows.slice(0, 5);
  summary.processingLog.push(...processingLog);

  const { language, locale } = detectLanguageAndLocale(
    allRows.slice(0, 50).flatMap((row) => Object.values(row)) as (string | number | null)[]
  );
  summary.language = language;
  summary.locale = locale;
  summary.columnProfiles = calculateColumnProfiles(allRows, summary.columns, locale);

  return { data: allRows, issues };
};

const buildErrorDoc = (
  file: File,
  context: FileContext,
  kind: DocumentKind,
  error: unknown
): ImportedDoc => ({
  kind,
  name: context.internalPath ?? file.name,
  size: file.size,
  status: 'error',
  raw: file,
  error: error instanceof Error ? error.message : String(error),
  meta: {
    parentArchive: context.parentArchive,
    internalPath: context.internalPath,
  },
});

const processFile = async (item: FileQueueItem): Promise<ProcessResult> => {
  const { file, context } = item;
  const buffer = await readFileAsArrayBuffer(file);
  const firstBytes = new Uint8Array(buffer.slice(0, 8));
  const kind = detectKind(file, firstBytes);

  if (kind === 'ZIP') {
    return await processArchive(file, buffer, context);
  }

  if (kind === 'UNSUPPORTED') {
    throw new Error('Formato de arquivo não suportado.');
  }

  const { text, encoding } = kind === 'PDF' || kind === 'IMAGE'
    ? { text: '', encoding: { detected: 'binary', normalized: 'binary', confidence: 0, bomStripped: false, attemptedEncodings: [] } }
    : await decodeBufferToText(buffer, file.name, file.type);

  const summaryBase = await buildSummaryBase(file, context, buffer, encoding);
  const summary: FileStructuralSummary = {
    format: kind,
    quality: 'GOOD',
    issues: [],
    metrics: {},
    processingLog: summaryBase.processingLog,
    ...summaryBase,
  };

  let data: Record<string, any>[] = [];
  let textContent: string | undefined;
  let issues: StructuralIssue[] = [];

  summary.processingLog.push(`Detecção automática: ${kind}`);

  switch (kind) {
    case 'CSV': {
      const result = processCsvText(text, summary);
      data = result.data;
      issues = result.issues;
      textContent = text;
      break;
    }
    case 'JSON': {
      const result = processJsonText(text, summary);
      data = result.data;
      issues = result.issues;
      textContent = text;
      break;
    }
    case 'NFE_XML': {
      const result = processXmlText(text, summary);
      data = result.data;
      issues = result.issues;
      textContent = text;
      break;
    }
    case 'TXT': {
      const result = processTxt(text, summary);
      data = result.data;
      issues = result.issues;
      textContent = text;
      break;
    }
    case 'PDF':
    case 'IMAGE': {
      const result = await processOcrDocument(file, buffer, summary);
      data = result.data;
      issues = result.issues;
      textContent = result.text;
      break;
    }
    case 'XLSX': {
      const result = processXlsxBuffer(buffer, summary);
      data = result.data;
      issues = result.issues;
      break;
    }
    default:
      issues.push({
        code: 'FORMAT_UNKNOWN',
        severity: 'WARN',
        message: 'Formato diagnosticado, mas não há rotina específica implementada. Conteúdo preservado como texto bruto.',
      });
      data = [];
      textContent = text;
  }

  summary.issues = issues;
  summary.quality = qualityFromIssues(issues);

  if (issues.some((issue) => issue.severity === 'ERROR')) {
    summary.processingLog.push('Arquivo contém erros estruturais críticos.');
  } else if (issues.length === 0) {
    summary.processingLog.push('Nenhum problema estrutural identificado.');
  }

  logger.log('Import', issues.length > 0 ? 'WARN' : 'INFO', `Diagnóstico estruturado de "${file.name}" concluído.`, {
    formato: kind,
    qualidade: summary.quality,
    linha: summary.rowCount,
    colunas: summary.columnCount,
    origem: context.parentArchive ? `${context.parentArchive}:${context.internalPath ?? file.name}` : file.name,
  });

  const document: ImportedDoc = {
    kind,
    name: context.internalPath ?? file.name,
    size: file.size,
    status: issues.some((issue) => issue.severity === 'ERROR') ? 'error' : 'parsed',
    data,
    text: textContent,
    raw: file,
    error: issues.find((issue) => issue.severity === 'ERROR')?.message,
    meta: {
      structuralReport: summary,
      parentArchive: context.parentArchive,
      internalPath: context.internalPath,
      diagnostics: issues,
    },
  };

  return { documents: [document], newFiles: [] };
};

const processArchive = async (
  file: File,
  buffer: ArrayBuffer,
  context: FileContext
): Promise<ProcessResult> => {
  const summaryBase = await buildSummaryBase(file, context, buffer, {
    detected: 'binary',
    normalized: 'binary',
    confidence: 1,
    bomStripped: false,
    attemptedEncodings: [],
  });

  const summary: FileStructuralSummary = {
    ...summaryBase,
    format: 'ZIP',
    quality: 'GOOD',
    issues: [],
    metrics: {},
    processingLog: [`Iniciando extração segura do arquivo "${file.name}".`],
  };

  const zip = await JSZip.loadAsync(buffer);
  const newFiles: FileQueueItem[] = [];
  const discarded: string[] = [];

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  summary.metrics = { arquivos_embutidos: entries.length };

  for (const entry of entries) {
    const ext = getExtension(entry.name);
    if (BLOCKED_EXTENSIONS.has(ext)) {
      discarded.push(entry.name);
      summary.processingLog.push(`Bloqueio preventivo: ${entry.name}`);
      continue;
    }

    const blob = await entry.async('blob');
    const childFile = new File([blob], entry.name.split('/').pop() ?? entry.name, {
      type: guessMimeFromExtension(ext),
      lastModified: file.lastModified,
    });

    newFiles.push({
      file: childFile,
      context: {
        parentArchive: context.parentArchive ?? file.name,
        internalPath: entry.name,
      },
    });
  }

  if (discarded.length > 0) {
    summary.issues.push({
      code: 'ZIP_SANITIZED',
      severity: 'INFO',
      message: `${discarded.length} arquivo(s) foram bloqueados por política de segurança.`,
      hint: discarded.slice(0, 5).join(', '),
    });
    summary.discardedFiles = discarded;
  }

  summary.processingLog.push(
    `Extração concluída com ${newFiles.length} arquivo(s) liberados para análise.`
  );
  summary.quality = qualityFromIssues(summary.issues);

  logger.log(
    'Import',
    discarded.length > 0 ? 'WARN' : 'INFO',
    `Arquivo ZIP "${file.name}" expandido. ${newFiles.length} itens prontos para diagnóstico.`,
    {
      descartados: discarded.length,
      origem: context.parentArchive,
    }
  );

  return {
    documents: [],
    newFiles,
  };
};

export const importPipeline = async (
  files: File[],
  onProgress: (progress: number) => void
): Promise<ImportedDoc[]> => {
  const results: ImportedDoc[] = [];
  const queue: FileQueueItem[] = files.map((file) => ({ file, context: {} }));
  let processed = 0;
  let total = queue.length;

  onProgress(0);

  while (queue.length > 0) {
    const item = queue.shift()!;
    let documents: ImportedDoc[] = [];
    let newFiles: FileQueueItem[] = [];

    try {
      const result = await processFile(item);
      documents = result.documents;
      newFiles = result.newFiles;
    } catch (error) {
      const buffer = await readFileAsArrayBuffer(item.file);
      const firstBytes = new Uint8Array(buffer.slice(0, 8));
      const kind = detectKind(item.file, firstBytes);
      const errorDoc = buildErrorDoc(item.file, item.context, kind, error);
      results.push(errorDoc);
      logger.log(
        'Import',
        'ERROR',
        `Falha ao processar "${item.context.internalPath ?? item.file.name}".`,
        error instanceof Error ? error.message : String(error)
      );
    }

    if (documents.length > 0) {
      results.push(...documents);
    }

    if (newFiles.length > 0) {
      queue.push(...newFiles);
      total += newFiles.length;
    }

    processed += 1;
    onProgress(Math.min(99, (processed / Math.max(total, 1)) * 100));
  }

  onProgress(100);
  return results;
};
