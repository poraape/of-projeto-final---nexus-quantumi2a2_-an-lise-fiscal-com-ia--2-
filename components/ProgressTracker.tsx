import React from 'react';
// FIX: Corrected module import paths to be relative.
import type { AgentState, AgentName } from '../types';
import { LoadingSpinnerIcon, CheckIcon, ErrorIcon, FileInfoIcon } from './icons';

interface ProgressTrackerProps {
  agentStates: Record<AgentName, AgentState>;
}

const agentDisplayOrder: AgentName[] = [
  'ocr',
  'auditor',
  'classifier',
  'crossValidator',
  'accountant',
  'intelligence',
  'reconciliation'
];

const agentFriendlyNames: Record<AgentName, string> = {
  ocr: 'Extração de Dados (OCR/XML)',
  auditor: 'Auditoria Determinística',
  classifier: 'Classificação Fiscal',
  crossValidator: 'Validação Cruzada',
  intelligence: 'Análise de IA e Insights',
  accountant: 'Agregação de Métricas',
  reconciliation: 'Conciliação Bancária'
};

const StatusIcon: React.FC<{ status: AgentState['status'] }> = ({ status }) => {
  switch (status) {
    case 'running':
      return <LoadingSpinnerIcon className="w-5 h-5 text-blue-400 animate-spin" />;
    case 'completed':
      return <CheckIcon className="w-5 h-5 text-teal-400" />;
    case 'error':
      return <ErrorIcon className="w-5 h-5 text-red-400" />;
    case 'pending':
    default:
      return <FileInfoIcon className="w-5 h-5 text-gray-500" />;
  }
};

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ agentStates }) => {
  const visibleAgents = agentDisplayOrder.filter(name => name !== 'reconciliation' || agentStates.reconciliation.status !== 'pending');

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg animate-fade-in">
        <h2 className="text-xl font-bold mb-4 text-gray-200">Progresso da Análise</h2>
        <div className="space-y-4">
            {visibleAgents.map((agentName, index) => {
                const agent = agentStates[agentName];
                const isLast = index === visibleAgents.length - 1;

                return (
                    <div key={agentName} className="flex items-start">
                        <div className="flex flex-col items-center mr-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-700">
                                <StatusIcon status={agent.status} />
                            </div>
                            {!isLast && <div className="w-px h-12 bg-gray-600"></div>}
                        </div>
                        <div className="pt-1">
                            <p className="font-semibold text-gray-300">{agentFriendlyNames[agentName]}</p>
                            <p className="text-sm text-gray-400 capitalize">{agent.status}</p>
                            {agent.progress && agent.status === 'running' && (
                                <p className="text-xs text-gray-500 mt-1">
                                    {agent.progress.step} - {agent.progress.current} / {agent.progress.total}
                                </p>
                            )}
                            {agent.error && agent.status === 'error' && (
                                <p className="text-xs text-red-400 mt-1">{agent.error}</p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default ProgressTracker;
