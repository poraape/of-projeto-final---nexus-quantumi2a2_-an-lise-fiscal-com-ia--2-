// nlpAgent.ts
import { logger } from "../services/logger";
import { aiApi } from "../services/apiClient";

/**
 * Tenta extrair dados fiscais estruturados de um bloco de texto usando a IA do Gemini.
 * Esta função agora delega a chamada para o backend seguro.
 * @param text O texto bruto extraído de um PDF ou imagem.
 * @returns Uma promessa que resolve para um array de objetos de dados extraídos. Retorna array vazio se nada for encontrado.
 */
export const extractDataFromText = async (text: string): Promise<Record<string, any>[]> => {
  if (!text || text.trim().length < 20) {
    logger.log('nlpAgent', 'WARN', 'Texto muito curto para extração, pulando chamada à API.');
    return [];
  }

  logger.log('nlpAgent', 'INFO', 'Enviando texto para o serviço de IA no backend...');

  try {
    const response = await aiApi.extractText({ text });
    const extracted = response.data;

    if (!extracted.items || extracted.items.length === 0) {
      logger.log('nlpAgent', 'WARN', 'Serviço de IA não extraiu itens do texto.');
      return [];
    }

    // Achata a estrutura para corresponder ao formato esperado pelo resto do pipeline.
    const { items, ...headerData } = extracted;
    const result = items.map(item => ({ ...headerData, ...item }));

    logger.log('nlpAgent', 'INFO', `Serviço de IA extraiu ${result.length} item(ns) do texto.`);
    return result;
  } catch (error) {
    logger.log('nlpAgent', 'ERROR', 'Falha na chamada ao serviço de IA do backend.', { error });
    return []; // Retorna vazio em caso de falha para não quebrar o pipeline.
  }
};
