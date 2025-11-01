import React from 'react';
import { useBackendPipeline } from '../../context/BackendPipelineContext';

const BackendJobResultCard: React.FC = () => {
  const { currentJob } = useBackendPipeline();

  if (!currentJob || !currentJob.result_payload) {
    return null;
  }

  const files = Array.isArray(currentJob.result_payload.files)
    ? currentJob.result_payload.files
    : currentJob.input_payload ?? [];

  return (
    <div className="bg-gray-900/80 border border-indigo-700/50 rounded-xl p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-indigo-200">Resultado do Backend</h3>
        <p className="text-sm text-gray-400 mt-1">
          Dados enviados e processados pelo backend (placeholder). Em breve, esta área exibirá insights fiscais completos.
        </p>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-200">
        <div>
          <dt className="font-medium text-gray-400">Job ID</dt>
          <dd className="font-mono text-gray-100 mt-1 break-all">{currentJob.id}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-400">Status</dt>
          <dd className="mt-1">{currentJob.status}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-400">Resumo</dt>
          <dd className="mt-1">{currentJob.input_summary ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-400">Mensagem</dt>
          <dd className="mt-1">{currentJob.result_payload?.message ?? '—'}</dd>
        </div>
      </dl>

      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Arquivos armazenados</h4>
        <div className="bg-gray-900 border border-gray-800 rounded-lg divide-y divide-gray-800">
          {files.length === 0 ? (
            <p className="text-sm text-gray-500 px-3 py-2">Nenhum arquivo encontrado.</p>
          ) : (
            files.map((file: any) => (
              <div
                key={`${file.stored_path ?? file.original_name}`}
                className="px-3 py-2 text-sm text-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <span>
                  {file.original_name}
                  <span className="text-gray-500"> ({file.content_type ?? 'tipo desconhecido'})</span>
                </span>
                <span className="text-xs text-gray-500 font-mono">{file.sha256}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BackendJobResultCard;
