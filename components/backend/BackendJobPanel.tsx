import React, { useMemo, useState } from 'react';
import type { BackendAuditJob } from '../../services/backendJobs';
import { useBackendPipeline } from '../../context/BackendPipelineContext';

const statusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  RUNNING: 'Em andamento',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelada',
};

const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR');

const JobRow: React.FC<{ job: BackendAuditJob }> = ({ job }) => {
  return (
    <tr className="border-b border-gray-700/40">
      <td className="px-3 py-2 text-sm">{job.id}</td>
      <td className="px-3 py-2 text-sm">{statusLabels[job.status] ?? job.status}</td>
      <td className="px-3 py-2 text-sm">{job.input_summary ?? '-'}</td>
      <td className="px-3 py-2 text-sm">{formatDate(job.created_at)}</td>
      <td className="px-3 py-2 text-sm">
        {job.result_payload?.message ?? (job.error_payload ? 'Erro registrado' : '-')}
      </td>
    </tr>
  );
};

const BackendJobPanel: React.FC = () => {
  const { jobs, currentJob, uploadState, error, startUpload, clearError } = useBackendPipeline();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const isUploading = uploadState !== 'idle';
  const currentStatus = useMemo(() => {
    if (!currentJob) return null;
    return statusLabels[currentJob.status] ?? currentJob.status;
  }, [currentJob]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    setSelectedFiles(files);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      return;
    }
    await startUpload(selectedFiles);
    setSelectedFiles([]);
  };

  return (
    <section className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">MVP Backend</h2>
        <p className="text-sm text-gray-400 mt-1">
          Esta seção envia arquivos para o backend FastAPI e acompanha o status pelo banco de dados.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-300" htmlFor="backend-upload">
            Arquivos para auditoria (beta)
          </label>
          <input
            id="backend-upload"
            type="file"
            multiple
            onChange={handleFileChange}
            disabled={isUploading}
            className="mt-2 block w-full text-sm text-gray-200 bg-gray-900 border border-gray-700 rounded-md file:bg-indigo-600 file:text-white file:border-0 file:px-3 file:py-1.5 file:mr-3"
          />
        </div>
        <button
          type="submit"
          disabled={isUploading || selectedFiles.length === 0}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 rounded-md text-sm font-medium text-white transition-colors"
        >
          {uploadState === 'uploading' && 'Enviando...'}
          {uploadState === 'polling' && 'Processando...'}
          {uploadState === 'idle' && 'Enviar para backend'}
        </button>
      </form>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-200 px-3 py-2 rounded-md flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-sm underline">
            Fechar
          </button>
        </div>
      )}

      {currentJob && (
        <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-200">Job em foco</h3>
          <dl className="mt-2 text-sm text-gray-300 space-y-1">
            <div className="flex justify-between gap-3">
              <dt className="font-medium">ID</dt>
              <dd className="font-mono text-gray-200">{currentJob.id}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-medium">Status</dt>
              <dd>{currentStatus}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-medium">Resumo</dt>
              <dd>{currentJob.input_summary ?? '-'}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-400">
              <th className="px-3 py-2">Job ID</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Resumo</th>
              <th className="px-3 py-2">Criado em</th>
              <th className="px-3 py-2">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-sm text-gray-500 text-center">
                  Nenhum job encontrado ainda.
                </td>
              </tr>
            ) : (
              jobs.map((job) => <JobRow key={job.id} job={job} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default BackendJobPanel;
