// agents/accountantAgent.ts
import type { AuditReport } from '../types';
import { parseSafeFloat } from '../utils/parsingUtils';

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

/**
 * Aggregates financial data from all audited documents to generate key metrics for the executive summary.
 * @param report The audit report after previous stages (audit, classification).
 * @returns A promise that resolves with the aggregated metrics record.
 */
export const runAccountantAnalysis = async (
    report: Omit<AuditReport, 'summary' | 'aggregatedMetrics'>
): Promise<Record<string, string | number>> => {
    
    const validDocs = report.documents.filter(d => d.status !== 'ERRO' && d.doc.data);
    const allItems = validDocs.flatMap(d => d.doc.data!);

    if (allItems.length === 0) {
        return {
            'Número de Documentos Válidos': 0,
            'Valor Total das NFes': formatCurrency(0),
            'Valor Total dos Produtos': formatCurrency(0),
            'Valor Total de ICMS': formatCurrency(0),
            'Valor Total de PIS': formatCurrency(0),
            'Valor Total de COFINS': formatCurrency(0),
        };
    }

    const uniqueNFeIds = new Set<string>(allItems.map(item => item.nfe_id));

    const totalNFeValue = Array.from(uniqueNFeIds).reduce((sum, nfeId) => {
        const item = allItems.find(i => i.nfe_id === nfeId);
        return sum + parseSafeFloat(item?.valor_total_nfe);
    }, 0);

    const totalProductValue = allItems.reduce((sum, item) => sum + parseSafeFloat(item.produto_valor_total), 0);
    const totalIcms = allItems.reduce((sum, item) => sum + parseSafeFloat(item.produto_valor_icms), 0);
    const totalPis = allItems.reduce((sum, item) => sum + parseSafeFloat(item.produto_valor_pis), 0);
    const totalCofins = allItems.reduce((sum, item) => sum + parseSafeFloat(item.produto_valor_cofins), 0);

    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
        'Número de Documentos Válidos': uniqueNFeIds.size,
        'Valor Total das NFes': formatCurrency(totalNFeValue),
        'Valor Total dos Produtos': formatCurrency(totalProductValue),
        'Valor Total de ICMS': formatCurrency(totalIcms),
        'Valor Total de PIS': formatCurrency(totalPis),
        'Valor Total de COFINS': formatCurrency(totalCofins),
        'Itens Processados': allItems.length,
    };
};
