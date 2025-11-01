import React from 'react';
import type { AgentState, AgentName } from '../types';
import { CheckIcon, ErrorIcon, LoadingSpinnerIcon, FileInfoIcon } from './icons';

interface ProgressTrackerProps {
  agentStates: Record<AgentName, AgentState>;
}

const agentDisplayOrder: AgentName[] = [
  'ocr',
  'auditor',
  'classifier',
  'intelligence',
  'accountant',
  'crossValidator',
  'reconciliation',
];

const agentFriendlyNames: Record<AgentName, string> = {
  ocr: '1. Ag. OCR',
  auditor: '2. Ag. Auditor',
  classifier: '3. Ag. Classificador',
  intelligence: '4. Ag. Inteligência',
  accountant: '5. Ag. Contador',
  crossValidator: '6. Validação Cruzada',
  reconciliation: '7. Conciliação Bancária',
};

const statusPill = (status: AgentState['status']) => {
  switch (status) {
    case 'completed':
      return {
        icon: <CheckIcon className="h-5 w-5 text-emerald-300" />,
        ring: 'bg-emerald-500/15 border border-emerald-400/50',
      };
    case 'running':
      return {
        icon: <LoadingSpinnerIcon className="h-5 w-5 text-sky-300 animate-spin" />,
        ring: 'bg-sky-500/15 border border-sky-400/60',
      };
    case 'error':
      return {
        icon: <ErrorIcon className="h-5 w-5 text-rose-300" />,
        ring: 'bg-rose-500/15 border border-rose-400/60',
      };
    default:
      return {
        icon: <FileInfoIcon className="h-5 w-5 text-slate-400" />,
        ring: 'bg-slate-700/20 border border-slate-600/40',
      };
  }
};

const resolveStatusMessage = (agents: Record<AgentName, AgentState>) => {
  if (agents.intelligence.status === 'running') {
    return 'Gerando análise com IA...';
  }
  if (agents.accountant.status === 'running') {
    return 'Consolidando métricas e valores...';
  }
  if (agents.crossValidator.status === 'running') {
    return 'Executando validações cruzadas...';
  }
  const pending = agentDisplayOrder.find((agent) => agents[agent]?.status === 'running');
  if (pending) {
    return 'Processando documentos enviados...';
  }
  return 'Aguardando nova análise.';
};

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ agentStates }) => {
  const visibleAgents = agentDisplayOrder.filter(
    (agent) => agent !== 'reconciliation' || agentStates.reconciliation.status !== 'pending'
  );

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-[#0c1b33]/90 p-8 shadow-[0_35px_60px_-25px_rgba(32,94,202,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-100">Progresso da Análise</h2>
        <span className="text-sm font-medium text-slate-400">{resolveStatusMessage(agentStates)}</span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {visibleAgents.slice(0, 5).map((agentName) => {
          const agent = agentStates[agentName];
          const { icon, ring } = statusPill(agent.status);

          return (
            <div
              key={agentName}
              className="flex h-full flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#0a162b]/80 px-4 py-5 text-center transition hover:border-sky-400/40"
            >
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${ring}`}>
                {icon}
              </div>
              <p className="text-sm font-semibold text-slate-100">{agentFriendlyNames[agentName]}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{agent.status}</p>
              {agent.progress && agent.status === 'running' && (
                <p className="mt-2 text-[11px] text-slate-400">
                  {agent.progress.step} · {agent.progress.current}/{agent.progress.total}
                </p>
              )}
              {agent.error && agent.status === 'error' && (
                <p className="mt-2 text-[11px] text-rose-300">{agent.error}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressTracker;
