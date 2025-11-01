// agents/intelligenceAgent.ts
import { Type } from '../services/geminiSchema';
import { generateJSON } from '../services/geminiService';
import type { AuditReport, ExecutiveSummary, AIDrivenInsight, CrossValidationResult } from '../types';
import { logger } from '../services/logger';
import Papa from "papaparse";

const summarySchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "Um título conciso e informativo para o relatório, resumindo o lote de dados. Ex: 'Análise de Compras de TI - Julho 2024'." },
        summary: { type: Type.STRING, description: "Um resumo executivo de 2 a 4 frases, destacando as descobertas mais críticas. Mencione o número total de documentos, o valor total e o achado mais importante (seja positivo ou negativo)." },
        keyMetrics: {
            type: Type.ARRAY,
            description: "Uma lista de 3 a 5 métricas chave com status e explicações. Selecione as mais relevantes do input 'Métricas Agregadas'.",
            items: {
                type: Type.OBJECT,
                properties: {
                    metric: { type: Type.STRING },
                    value: { type: Type.STRING },
                    status: { type: Type.STRING, enum: ['OK', 'ALERT', 'PARTIAL', 'UNAVAILABLE'] },
                    explanation: { type: Type.STRING, description: "Breve explicação do que a métrica representa e por que seu status é o que é." },
                    insight: { type: Type.STRING, nullable: true, description: "Um insight opcional ou observação sobre a métrica." }
                },
                required: ['metric', 'value', 'status', 'explanation']
            }
        },
        actionableInsights: {
            type: Type.ARRAY,
            description: "Uma lista de 2 a 3 insights acionáveis e diretos, baseados nas inconsistências e oportunidades de otimização.",
            items: { type: Type.STRING }
        }
    },
    required: ['title', 'summary', 'keyMetrics', 'actionableInsights']
};


const aiInsightsSchema = {
    type: Type.OBJECT,
    properties: {
        insights: {
            type: Type.ARRAY,
            description: "Lista de insights estratégicos gerados pela IA.",
            items: {
                type: Type.OBJECT,
                properties: {
                    category: { type: Type.STRING, enum: ['Eficiência Operacional', 'Risco Fiscal', 'Oportunidade de Otimização', 'Anomalia de Dados'] },
                    description: { type: Type.STRING, description: "Descrição detalhada do insight." },
                    severity: { type: Type.STRING, enum: ['INFO', 'BAIXA', 'MÉDIA', 'ALTA'] },
                    evidence: { type: Type.ARRAY, description: "Lista de nomes de documentos ou dados que evidenciam o insight.", items: { type: Type.STRING } }
                },
                required: ['category', 'description', 'severity', 'evidence']
            }
        }
    },
    required: ['insights']
};

const crossValidationSchema = {
    type: Type.OBJECT,
    properties: {
        results: {
            type: Type.ARRAY,
            description: "Lista de validações cruzadas ou anomalias encontradas pela IA.",
            items: {
                type: Type.OBJECT,
                properties: {
                    attribute: { type: Type.STRING, description: "O atributo que está sendo comparado (ex: 'Preço Unitário', 'CFOP')." },
                    observation: { type: Type.STRING, description: "Observação da IA sobre a discrepância encontrada." },
                    documents: {
                        type: Type.ARRAY,
                        description: "Dois ou mais documentos que mostram a discrepância.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING, description: "Nome do documento." },
                                value: { type: Type.STRING, description: "Valor do atributo no documento." },
                            },
                            required: ['name', 'value']
                        }
                    }
                },
                required: ['attribute', 'observation', 'documents']
            }
        }
    },
    required: ['results']
};


export const runIntelligenceAnalysis = async (
    report: Omit<AuditReport, 'summary' | 'aiDrivenInsights' | 'crossValidationResults'>
): Promise<{ summary: ExecutiveSummary, aiDrivenInsights: AIDrivenInsight[], crossValidationResults: CrossValidationResult[] }> => {
    logger.log('IntelligenceAgent', 'INFO', 'Iniciando análise com IA...');
    
    // Prepare a concise data sample for the AI
    const dataForAI = {
        aggregatedMetrics: report.aggregatedMetrics,
        inconsistenciesSummary: report.documents
            .filter(d => d.inconsistencies.length > 0)
            .map(d => ({
                doc: d.doc.name,
                errors: d.inconsistencies.filter(i => i.severity === 'ERRO').map(i => i.message),
                alerts: d.inconsistencies.filter(i => i.severity === 'ALERTA').map(i => i.message)
            }))
            .slice(0, 20), // Limit to 20 docs with inconsistencies to save tokens
        documentsSample: Papa.unparse(
            report.documents.slice(0, 50).map(d => d.doc.data?.[0]).filter(Boolean)
        )
    };
    
    const basePrompt = `
        Você é um auditor fiscal sênior e um analista de dados especialista. Sua tarefa é analisar os dados fiscais fornecidos e gerar um relatório conciso, inteligente e acionável.
        Os dados incluem métricas agregadas, um resumo de inconsistências encontradas por regras determinísticas e uma amostra de dados brutos.
        
        Dados de Entrada:
        ${JSON.stringify(dataForAI, null, 2)}
    `;

    try {
        // Run generation tasks in parallel
        const [summary, aiInsights, crossValidation] = await Promise.all([
            generateJSON<ExecutiveSummary>(
                'gemini-2.5-flash',
                `${basePrompt}\n\nTarefa: Com base nos dados, gere o 'Resumo Executivo'. Seja conciso e foque nos pontos mais importantes.`,
                summarySchema
            ),
            generateJSON<{ insights: AIDrivenInsight[] }>(
                'gemini-2.5-flash',
                `${basePrompt}\n\nTarefa: Analise os dados em busca de padrões, anomalias e oportunidades que as regras determinísticas podem não ter pego. Gere os 'Insights Estratégicos'. Foque em riscos fiscais, oportunidades de economia e ineficiências operacionais.`,
                aiInsightsSchema
            ).then(r => r.insights || []),
            generateJSON<{ results: CrossValidationResult[] }>(
                'gemini-2.5-flash',
                `${basePrompt}\n\nTarefa: Realize uma validação cruzada nos dados. Compare itens similares entre diferentes notas (ex: mesmo produto com NCMs ou preços muito diferentes). Gere os resultados da 'Validação Cruzada por IA'.`,
                crossValidationSchema
            ).then(r => r.results || [])
        ]);
        
        logger.log('IntelligenceAgent', 'INFO', 'Análise com IA concluída com sucesso.');

        return { summary, aiDrivenInsights: aiInsights, crossValidationResults: crossValidation };

    } catch (error) {
        logger.log('IntelligenceAgent', 'ERROR', 'Falha na análise com IA.', { error });
        // Return a fallback object to avoid breaking the pipeline
        return {
            summary: {
                title: 'Falha na Análise por IA',
                summary: 'Ocorreu um erro ao tentar gerar o resumo e os insights com a inteligência artificial. A análise determinística abaixo ainda é válida.',
                keyMetrics: [],
                actionableInsights: ['Verifique os logs para mais detalhes sobre o erro da IA.']
            },
            aiDrivenInsights: [],
            crossValidationResults: [],
        };
    }
};
