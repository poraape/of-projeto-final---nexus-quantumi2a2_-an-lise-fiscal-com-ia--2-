import React from 'react';
import LogoIcon from './LogoIcon';

interface HeaderProps {
    onShowLogs: () => void;
    onReset: () => void;
    isAnalysisComplete: boolean;
}

const Header: React.FC<HeaderProps> = ({ onShowLogs, onReset, isAnalysisComplete }) => (
    <header className="bg-gray-900/50 backdrop-blur-sm p-4 flex justify-between items-center border-b border-gray-700/50 sticky top-0 z-30">
        <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-3 group focus:outline-none"
            title="Voltar ao início"
        >
            <LogoIcon className="w-10 h-10 transition-transform group-hover:scale-105" />
            <div className="text-left">
                <h1 className="text-xl font-bold text-gray-100 group-hover:text-white">Nexus QuantumI2A2</h1>
                <p className="text-xs text-gray-400">Plataforma de Análise Fiscal Inteligente</p>
            </div>
        </button>
        <div className="flex items-center gap-3">
             <button
                onClick={onShowLogs}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-md transition-colors"
             >
                Ver Logs
             </button>
             {isAnalysisComplete && (
                <button
                    onClick={onReset}
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-md transition-colors"
                >
                    Nova Análise
                </button>
             )}
        </div>
    </header>
);

export default Header;
