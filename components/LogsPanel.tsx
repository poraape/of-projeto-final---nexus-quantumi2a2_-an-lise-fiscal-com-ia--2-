// components/LogsPanel.tsx
import React, { useState, useEffect } from 'react';
import { logger, type LogEntry } from '../services/logger';

interface LogsPanelProps {
  onClose: () => void;
}

const levelStyles: Record<LogEntry['level'], string> = {
    INFO: 'text-gray-400',
    WARN: 'text-yellow-400',
    ERROR: 'text-red-400',
};

const LogsPanel: React.FC<LogsPanelProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>(logger.getHistory());

  useEffect(() => {
    const unsubscribe = logger.subscribe(setLogs);
    return () => unsubscribe();
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold">Logs do Sistema</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            &times;
          </button>
        </div>
        <div className="flex-grow p-4 overflow-y-auto font-mono text-xs">
          {logs.map((log, index) => (
            <div key={index} className={`flex items-start gap-3 py-1 border-b border-gray-700/50 ${levelStyles[log.level]}`}>
              <span className="flex-shrink-0">{log.timestamp.toLocaleTimeString()}</span>
              <span className="font-bold w-24 flex-shrink-0">[{log.source}]</span>
              <p className="flex-grow whitespace-pre-wrap break-words">
                {log.message}
                {log.details && (
                  <span className="text-gray-500 ml-2">
                    {JSON.stringify(log.details)}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-gray-700 text-right">
             <button
                onClick={() => logger.clear()}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-md transition-colors"
             >
                Limpar Logs
             </button>
        </div>
      </div>
    </div>
  );
};

export default LogsPanel;
