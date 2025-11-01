import React from 'react';
import LogoIcon from './LogoIcon';
import { FileInfoIcon } from './icons';

interface HeaderProps {
  onShowLogs: () => void;
  onReset: () => void;
  isAnalysisComplete: boolean;
}

const Header: React.FC<HeaderProps> = ({ onShowLogs, onReset, isAnalysisComplete }) => (
  <header className="sticky top-0 z-30 border-b border-white/5 bg-[#020817]/80 backdrop-blur-md">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
      <button
        type="button"
        onClick={onReset}
        className="group flex items-center gap-4 focus:outline-none"
        title="Voltar ao início"
      >
        <LogoIcon className="h-12 w-12 transition-transform duration-300 group-hover:scale-110" />
        <div className="text-left">
          <span className="block text-lg font-semibold tracking-tight text-slate-200">
            <span className="bg-gradient-to-r from-sky-400 via-teal-300 to-emerald-300 bg-clip-text text-transparent">
              Nexus QuantumI2A2
            </span>
          </span>
          <span className="text-xs font-medium tracking-wide text-slate-400">
            Interactive Insight &amp; Intelligence from Fiscal Analysis
          </span>
        </div>
      </button>

      <div className="flex items-center gap-3">
        <button
          onClick={onShowLogs}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/60 text-slate-300 transition hover:border-sky-400/60 hover:text-sky-300"
          title="Ver logs da análise"
        >
          <FileInfoIcon className="h-5 w-5" />
        </button>
        {isAnalysisComplete && (
          <button
            onClick={onReset}
            className="rounded-full bg-gradient-to-r from-sky-400 to-emerald-300 px-5 py-2 text-sm font-semibold text-slate-900 shadow-[0_10px_25px_-12px_rgba(56,189,248,0.75)] transition hover:shadow-[0_18px_35px_-15px_rgba(45,212,191,0.8)]"
          >
            Nova Análise
          </button>
        )}
      </div>
    </div>
  </header>
);

export default Header;
