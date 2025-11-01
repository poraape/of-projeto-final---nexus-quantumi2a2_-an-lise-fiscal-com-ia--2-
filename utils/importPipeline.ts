// utils/importPipeline.ts
import type { DocumentKind, ImportedDoc } from '../types';
import Papa from 'papaparse';
import { runOCRFromImage } from '../agents/ocrExtractor';
import { extractDataFromText } from '../agents/nlpAgent';

const getFileKind = (file: File): DocumentKind => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mime = file.type;

  if (extension === 'xml' || mime === 'text/xml' || mime === 'application/xml') return 'NFE_XML';
  if (extension === 'csv' || mime === 'text/csv') return 'CSV';
  if (extension === 'xlsx' || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'XLSX';
  if (extension === 'pdf' || mime === 'application/pdf') return 'PDF';
  if (['png', 'jpg', 'jpeg'].includes(extension || '') || mime.startsWith('image/')) return 'IMAGE';
  
  return 'UNSUPPORTED';
};

const parseNfeXml = (xmlString: string): Record<string, any>[] => {
    // This is a simplified, non-validating XML parser focusing on the expected NFe structure.
    // It uses regex for performance and to avoid heavy dependencies in a web worker.
    const getTagValue = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1] || null;
    const nfeId = getTagValue(xmlString, 'Id')?.replace('NFe', '') || `xml-${Date.now()}`;
    const header = {
        nfe_id: nfeId,
        data_emissao: getTagValue(xmlString, 'dhEmi'),
        valor_total_nfe: getTagValue(xmlString, 'vNF'),
        emitente_nome: getTagValue(xmlString, 'xNome'),
        emitente_cnpj: getTagValue(xmlString, 'CNPJ'),
        emitente_uf: getTagValue(xmlString, 'UF'),
        destinatario_nome: getTagValue(xmlString, 'xNome'),
        destinatario_cnpj: getTagValue(xmlString, 'CNPJ'),
        destinatario_uf: getTagValue(xmlString, 'UF'),
    };
    const itemsXml = [...xmlString.matchAll(/<det nItem="\d+">([\s\S]*?)<\/det>/g)];
    if (itemsXml.length === 0) {
        return [{ ...header, produto_nome: 'Nota sem itens detalhados' }];
    }
    return itemsXml.map(itemMatch => ({
        ...header,
        produto_nome: getTagValue(itemMatch[1], 'xProd'),
        produto_ncm: getTagValue(itemMatch[1], 'NCM'),
        produto_cfop: getTagValue(itemMatch[1], 'CFOP'),
        produto_qtd: getTagValue(itemMatch[1], 'qCom'),
        produto_valor_unit: getTagValue(itemMatch[1], 'vUnCom'),
        produto_valor_total: getTagValue(itemMatch[1], 'vProd'),
        produto_base_calculo_icms: getTagValue(itemMatch[1], 'vBC'),
        produto_valor_icms: getTagValue(itemMatch[1], 'vICMS'),
        produto_aliquota_icms: getTagValue(itemMatch[1], 'pICMS'),
        produto_cst_icms: getTagValue(itemMatch[1], 'CST'),
        produto_valor_pis: getTagValue(itemMatch[1], 'vPIS'),
        produto_aliquota_pis: getTagValue(itemMatch[1], 'pPIS'),
        produto_cst_pis: getTagValue(itemMatch[1], 'CST'),
        produto_valor_cofins: getTagValue(itemMatch[1], 'vCOFINS'),
        produto_aliquota_cofins: getTagValue(itemMatch[1], 'pCOFINS'),
        produto_cst_cofins: getTagValue(itemMatch[1], 'CST'),
        produto_valor_iss: getTagValue(itemMatch[1], 'vISSQN')
    }));
};

const parseCsv = (csvString: string): Promise<Record<string, any>[]> => {
    return new Promise((resolve, reject) => {
        Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data as Record<string, any>[]),
            error: (error) => reject(error),
        });
    });
};

export const importPipeline = async (files: File[], onProgress: (progress: number) => void): Promise<ImportedDoc[]> => {
  const results: ImportedDoc[] = [];
  let processedCount = 0;

  for (const file of files) {
    const kind = getFileKind(file);
    const baseDoc: Omit<ImportedDoc, 'status'> = {
        kind,
        name: file.name,
        size: file.size,
        raw: file,
    };

    try {
        if (kind === 'UNSUPPORTED') {
            throw new Error('Formato de arquivo não suportado.');
        }
        if (kind === 'XLSX') {
            // NOTE: Full XLSX parsing requires a library like 'xlsx'.
            // This is a placeholder for demonstration.
            throw new Error('O formato XLSX ainda não é suportado para extração direta. Converta para CSV.');
        }
        if (kind === 'NFE_XML') {
            const text = await file.text();
            const data = parseNfeXml(text);
            results.push({ ...baseDoc, status: 'parsed', data, text });
        } else if (kind === 'CSV') {
            const text = await file.text();
            const data = await parseCsv(text);
            results.push({ ...baseDoc, status: 'parsed', data, text });
        } else if (kind === 'PDF' || kind === 'IMAGE') {
            // For PDF/Image, we run OCR and then NLP extraction.
            const buffer = await file.arrayBuffer();
            const text = await runOCRFromImage(buffer);
            if (!text.trim()) {
                throw new Error('Nenhum texto extraído do documento (OCR).');
            }
            const data = await extractDataFromText(text);
            results.push({ ...baseDoc, status: 'parsed', data, text });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        results.push({ ...baseDoc, status: 'error', error: errorMessage });
    }
    
    processedCount++;
    onProgress((processedCount / files.length) * 100);
  }

  return results;
};
