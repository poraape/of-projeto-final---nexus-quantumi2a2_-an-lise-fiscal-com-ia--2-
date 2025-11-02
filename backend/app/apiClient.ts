import axios from 'axios';
import type { AIAnalysisRequest, ExtractionResult } from '../types';

/**
 * Cliente Axios pré-configurado para se comunicar com a API do backend.
 * A baseURL é lida das variáveis de ambiente do Vite.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Futuramente, o token de autenticação será adicionado aqui.
    // 'Authorization': `Bearer ${token}`
  },
});

/**
 * Objeto contendo os métodos para interagir com os endpoints de IA.
 */
export const aiApi = {
  extractText: (data: AIAnalysisRequest) => {
    return apiClient.post<ExtractionResult>('/ai/extract-text', data);
  },
};