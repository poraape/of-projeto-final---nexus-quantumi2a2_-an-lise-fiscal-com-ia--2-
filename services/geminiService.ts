import { logger } from "./logger";
import { Type, SchemaType } from "./geminiSchema";
import { AIError, ApiError } from '../utils/errors';

type ChatHistoryEntry = {
    role: 'user' | 'model';
    parts?: Array<{ text?: string }>;
};

export type Chat = {
    sendMessageStream: (input: { message: string }) => AsyncIterable<{ text: string }>;
};

export type ResponseSchema = {
    type: SchemaType;
    properties?: Record<string, unknown>;
    items?: Record<string, unknown>;
    required?: string[];
    description?: string;
    enum?: string[];
    nullable?: boolean;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const schemaReplacer = (_key: string, value: unknown) => {
    if (typeof value === 'symbol') {
        return value.toString();
    }
    return value;
};

const buildHistoryText = (history: ChatHistoryEntry[]) =>
    history
        .map(entry => {
            const roleLabel = entry.role === 'user' ? 'Usuario' : 'Assistente';
            const textContent = entry.parts?.map(part => part?.text ?? '').join(' ') ?? '';
            return `${roleLabel}: ${textContent}`.trim();
        })
        .filter(Boolean)
        .join('\n');

const detectApiBaseUrl = (): string => {
    const fromEnv = (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.trim();
    if (fromEnv) {
        return fromEnv.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.location) {
        return `${window.location.origin}/api/v1`;
    }
    return 'http://localhost:8080/api/v1';
};

const API_BASE_URL = detectApiBaseUrl();

async function postJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    let response: Response;
    let payloadText: string | null = null;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method: 'POST',
            body: JSON.stringify(body),
            ...init,
            headers,
        });
        payloadText = await response.text();
    } catch (error) {
        throw new AIError('Falha na comunicacao com o servico de IA.', error);
    }

    let parsed: any = null;
    if (payloadText) {
        try {
            parsed = JSON.parse(payloadText);
        } catch {
            parsed = payloadText;
        }
    }

    if (!response.ok) {
        const detail = (() => {
            if (!parsed) return response.statusText || 'Erro desconhecido.';
            if (typeof parsed === 'string') return parsed;
            const candidate = parsed.detail ?? parsed.message ?? parsed.error;
            if (Array.isArray(candidate)) {
                return candidate
                    .map((item) =>
                        typeof item === 'string'
                            ? item
                            : item?.msg ?? item?.message ?? JSON.stringify(item)
                    )
                    .join('; ');
            }
            if (typeof candidate === 'string') return candidate;
            return response.statusText || 'Erro desconhecido.';
        })();

        throw new ApiError(detail || 'Falha ao chamar o backend de IA.', response.status, parsed);
    }

    return parsed as T;
}

export async function generateJSON<T = unknown>(
    model: string,
    prompt: string,
    schema: ResponseSchema,
    maxRetries = 3
): Promise<T> {
    let attempt = 0;
    const schemaDescription = JSON.stringify(schema, schemaReplacer, 2);

    while (attempt <= maxRetries) {
        try {
            const composedPrompt = `${prompt}\n\nResponda apenas com um JSON valido que respeite o schema abaixo:\n${schemaDescription}`;

            const { text } = await postJson<{ text: string }>('/ai/generate', {
                prompt: composedPrompt,
                model,
                temperature: 0.3,
            });

            if (!text || !text.trim()) {
                throw new AIError('Resposta vazia da IA.');
            }

            const cleanedText = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
            return JSON.parse(cleanedText) as T;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.log('geminiService', 'WARN', `Tentativa ${attempt + 1} de gerar JSON falhou.`, { error });

            const isRateLimit = (error instanceof ApiError && error.statusCode === 429) || message.toLowerCase().includes('quota') || message.toLowerCase().includes('exhaust');

            if (isRateLimit && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                logger.log('geminiService', 'INFO', `Limite de taxa atingido. Tentando novamente em ${Math.round(delay / 1000)}s.`);
                await sleep(delay);
                attempt++;
                continue;
            }

            if (error instanceof SyntaxError) {
                throw new AIError(`Resposta nao era JSON valido: ${error.message}`, error);
            }

            throw new AIError('Falha na comunicacao com o servico de IA.', error);
        }
    }

    throw new AIError('Falha ao gerar JSON apos multiplas tentativas.');
}

export function createChatSession(
    model: string,
    systemInstruction: string,
    schema: ResponseSchema,
    history?: any[]
): Chat {
    const chatHistory: ChatHistoryEntry[] = Array.isArray(history) ? [...history] : [];
    const schemaDescription = JSON.stringify(schema, schemaReplacer, 2);

    return {
        async *sendMessageStream({ message }: { message: string }) {
            chatHistory.push({ role: 'user', parts: [{ text: message }] });

            const historyText = buildHistoryText(chatHistory) || 'Sem historico anterior.';
            const promptSections = [
                'Instrucoes do sistema:',
                systemInstruction,
                '',
                'Schema esperado (JSON):',
                schemaDescription,
                '',
                'Historico da conversa:',
                historyText,
                '',
                'Usuario:',
                message,
                '',
                'Retorne apenas um JSON valido que siga o schema.',
            ];

            const { text } = await postJson<{ text: string }>('/ai/generate', {
                prompt: promptSections.join('\n'),
                model,
                temperature: 0.3,
            });

            chatHistory.push({ role: 'model', parts: [{ text }] });

            yield { text };
        },
    };
}

export async function* streamChatMessage(chat: Chat, message: string): AsyncGenerator<string> {
    if (!chat) {
        throw new Error('Chat nao inicializado.');
    }

    const stream = chat.sendMessageStream({ message });

    try {
        for await (const chunk of stream) {
            const chunkText = typeof chunk === 'string' ? chunk : chunk?.text ?? '';
            if (chunkText) {
                yield chunkText;
            }
        }
    } catch (error) {
        logger.log('geminiService', 'ERROR', 'Falha durante o streaming da resposta do chat.', { error });
        throw new Error('Erro ao processar a resposta do chat.');
    }
}

const suggestionSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            description: 'Array de 3-4 perguntas sugeridas.',
            items: { type: Type.STRING },
        },
    },
    required: ['questions'],
};

export async function generateSuggestedQuestions(
    conversationHistory: { sender: string; text: string }[],
    reportSummary: any
): Promise<string[]> {
    const historyText = conversationHistory
        .map(m => `${m.sender === 'user' ? 'Usuario' : 'IA'}: ${m.text}`)
        .join('\n');

    const prompt = `
        Voce e um assistente fiscal proativo.
        Gere 3 ou 4 perguntas de acompanhamento curtas e objetivas com base no resumo do relatorio e nas ultimas mensagens.
        Evite repetir perguntas ja feitas. Retorne apenas JSON valido seguindo o schema.

        Resumo do relatorio:
        - Titulo: ${reportSummary.title}
        - Principais metricas: ${reportSummary.keyMetrics.map((m: any) => `${m.metric}: ${m.value}`).join(', ')}
        - Principais insights: ${reportSummary.actionableInsights.join('; ')}

        Ultimas mensagens:
        ${historyText}
    `;

    try {
        const result = await generateJSON<{ questions: string[] }>(
            'gemini-2.5-flash',
            prompt,
            suggestionSchema
        );
        return result.questions || [];
    } catch (error) {
        logger.log('geminiService', 'WARN', 'Falha ao gerar sugestoes de perguntas.', { error });
        return [];
    }
}
