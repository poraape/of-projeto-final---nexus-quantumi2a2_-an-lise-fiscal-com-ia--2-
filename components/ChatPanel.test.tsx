// components/ChatPanel.test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import ChatPanel from './ChatPanel';
import type { ChatMessage, AuditReport } from '../types';

// Mock dependencies
// FIX: Replaced jest with vi to match the vitest testing environment and fix namespace errors.
vi.mock('../utils/exportConversationUtils', () => ({
  exportConversationToDocx: vi.fn(),
  exportConversationToHtml: vi.fn(),
  exportConversationToPdf: vi.fn(),
}));

vi.mock('../services/geminiService', () => ({
  generateSuggestedQuestions: vi.fn().mockResolvedValue(['Nova sugestão 1?', 'Nova sugestão 2?']),
}));

vi.mock('./ChatMessageContent', () => {
    return vi.fn(({ message }) => (
        <div data-testid={`message-${message.id}`}>
            <span>{message.sender}:</span>
            <span>{message.text}</span>
        </div>
    ));
});

vi.mock('./icons', () => ({
    SendIcon: () => <div data-testid="send-icon" />,
    LoadingSpinnerIcon: () => <div data-testid="loading-icon" />,
    StopIcon: () => <div data-testid="stop-icon" />,
    DownloadIcon: () => <div data-testid="download-icon" />,
    DocumentTextIcon: () => <div data-testid="doc-icon" />,
    PaperClipIcon: () => <div data-testid="paperclip-icon" />,
}));


const mockReport: AuditReport = {
  summary: {
    title: 'Relatório de Teste',
    summary: 'Resumo do teste.',
    keyMetrics: [],
    actionableInsights: [],
  },
  documents: [],
  // FIX: Added missing properties to satisfy the AuditReport type.
  aggregatedMetrics: {},
  aiDrivenInsights: [],
  deterministicCrossValidation: [],
  crossValidationResults: [],
};

const mockMessages: ChatMessage[] = [
  { id: '1', sender: 'ai', text: 'Bem-vindo!' },
  { id: '2', sender: 'user', text: 'Olá, mundo.' },
  { id: '3', sender: 'ai', text: 'Olá! Como posso ajudar?' },
];

const baseProps = {
  messages: mockMessages,
  // FIX: Replaced jest with vi to match the vitest testing environment.
  onSendMessage: vi.fn(),
  isStreaming: false,
  onStopStreaming: vi.fn(),
  report: mockReport,
  setError: vi.fn(),
  onAddFiles: vi.fn(),
};

describe('ChatPanel Component', () => {
    
    beforeEach(() => {
        // Clear mocks before each test
        // FIX: Replaced jest with vi to match the vitest testing environment.
        vi.clearAllMocks();
        // Mocking window.scrollTo which is called in the component
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    it('renders correctly with initial state', () => {
        render(<ChatPanel {...baseProps} messages={[{ id: '1', sender: 'ai', text: 'Bem-vindo!' }]} />);

        expect(screen.getByText('Chat Interativo')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Faça uma pergunta ou adicione arquivos...')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /exportar conversa/i })).toBeInTheDocument();
        expect(screen.getByTestId('send-icon')).toBeInTheDocument();
    });
    
    it('displays user and AI messages', () => {
        render(<ChatPanel {...baseProps} />);
        
        expect(screen.getByTestId('message-1')).toHaveTextContent('ai:Bem-vindo!');
        expect(screen.getByTestId('message-2')).toHaveTextContent('user:Olá, mundo.');
        expect(screen.getByTestId('message-3')).toHaveTextContent('ai:Olá! Como posso ajudar?');
    });

    it('allows user to type and send a message', async () => {
        const user = userEvent.setup();
        render(<ChatPanel {...baseProps} />);
        
        const input = screen.getByPlaceholderText('Faça uma pergunta ou adicione arquivos...');
        const sendButton = screen.getByRole('button', { name: /enviar mensagem/i });

        // Initially disabled
        expect(sendButton).toBeDisabled();

        await user.type(input, 'Esta é uma nova mensagem');
        expect(input).toHaveValue('Esta é uma nova mensagem');
        
        // Should be enabled now
        expect(sendButton).toBeEnabled();

        await user.click(sendButton);
        
        expect(baseProps.onSendMessage).toHaveBeenCalledWith('Esta é uma nova mensagem');
        expect(input).toHaveValue('');
    });

    it('disables input and shows spinner when streaming', () => {
        render(<ChatPanel {...baseProps} isStreaming={true} />);

        expect(screen.getByPlaceholderText('Aguardando resposta do backend...')).toBeDisabled();
        expect(screen.getByRole('button', { name: /enviar mensagem/i })).toBeDisabled();
        expect(screen.getByTestId('loading-icon')).toBeInTheDocument();
        expect(screen.queryByTestId('send-icon')).not.toBeInTheDocument();
        expect(screen.getByTitle('Adicionar mais arquivos à análise')).toBeDisabled();
    });

    it('handles conversation export', async () => {
        const user = userEvent.setup();
        const { exportConversationToDocx } = require('../utils/exportConversationUtils');
        render(<ChatPanel {...baseProps} />);
        
        const exportButton = screen.getByRole('button', { name: /exportar conversa/i });
        await user.click(exportButton);

        // Menu should be visible
        const docxButton = screen.getByRole('button', { name: /docx/i });
        expect(docxButton).toBeVisible();

        await user.click(docxButton);
        
        expect(exportConversationToDocx).toHaveBeenCalledWith(mockMessages, expect.any(String), expect.any(String));
        
        // Menu should close after clicking
        await waitFor(() => {
            expect(screen.queryByRole('button', { name: /docx/i })).not.toBeInTheDocument();
        });
    });

    it('displays and handles suggested questions', async () => {
        const user = userEvent.setup();
        const { generateSuggestedQuestions } = require('../services/geminiService');

        render(<ChatPanel {...baseProps} />);
        
        // Wait for suggestions to be generated and rendered
        await waitFor(() => {
             expect(generateSuggestedQuestions).toHaveBeenCalled();
        });

        const suggestionButton = await screen.findByRole('button', { name: /nova sugestão 1\?/i });
        expect(suggestionButton).toBeInTheDocument();

        await user.click(suggestionButton);

        const input = screen.getByPlaceholderText('Faça uma pergunta ou adicione arquivos...');
        expect(input).toHaveValue('Nova sugestão 1?');
    });

    it('handles adding new files via file input change', () => {
        render(<ChatPanel {...baseProps} />);

        const file = new File(['hello'], 'hello.xml', { type: 'text/xml' });
        const fileInput = screen.getByTestId('chat-panel-file-input');

        fireEvent.change(fileInput, {
            target: { files: [file] },
        });

        expect(baseProps.onAddFiles).toHaveBeenCalledWith([file]);
    });
});