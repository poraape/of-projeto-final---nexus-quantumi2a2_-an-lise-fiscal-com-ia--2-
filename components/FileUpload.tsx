import React, { useState, useCallback } from 'react';
import { UploadIcon, FileIcon } from './icons';
import { logger } from '../services/logger';

interface FileUploadProps {
  onStartAnalysis: (files: File[]) => void;
  disabled: boolean;
}

const FILE_SIZE_LIMIT_MB = 200;
const FILE_SIZE_LIMIT_BYTES = FILE_SIZE_LIMIT_MB * 1024 * 1024;

const DEMO_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35240712345678000195550010001234561000000015" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <natOp>VENDA DE MERCADORIA</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>123456</nNF>
        <dhEmi>2024-07-15T14:30:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>2</idDest>
        <cMunFG>3550308</cMunFG>
      </ide>
      <emit>
        <CNPJ>12345678000195</CNPJ>
        <xNome>Nexus Tech Solutions LTDA</xNome>
        <enderEmit>
          <xLgr>Av. da Inovacao</xLgr>
          <nro>2048</nro>
          <xMun>Sao Paulo</xMun>
          <UF>SP</UF>
        </enderEmit>
      </emit>
      <dest>
        <CNPJ>55443322000111</CNPJ>
        <xNome>Quantum Labs Industria</xNome>
        <enderDest>
          <xLgr>Rua Futuro</xLgr>
          <nro>451</nro>
          <xMun>Campinas</xMun>
          <UF>SP</UF>
        </enderDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>INFRA-001</cProd>
          <xProd>Servidor de Alto Desempenho</xProd>
          <NCM>84715010</NCM>
          <CFOP>6101</CFOP>
          <qCom>3</qCom>
          <vUnCom>48999.90</vUnCom>
          <vProd>146999.70</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>0</modBC>
              <vBC>146999.70</vBC>
              <pICMS>18.00</pICMS>
              <vICMS>26459.95</vICMS>
            </ICMS00>
          </ICMS>
          <PIS>
            <PISAliq>
              <CST>01</CST>
              <vBC>146999.70</vBC>
              <pPIS>1.65</pPIS>
              <vPIS>2425.50</vPIS>
            </PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq>
              <CST>01</CST>
              <vBC>146999.70</vBC>
              <pCOFINS>7.60</pCOFINS>
              <vCOFINS>11171.98</vCOFINS>
            </COFINSAliq>
          </COFINS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>146999.70</vBC>
          <vICMS>26459.95</vICMS>
          <vProd>146999.70</vProd>
          <vNF>173886.63</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

const FileUpload: React.FC<FileUploadProps> = ({ onStartAnalysis, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const handleFilesAdded = (newFiles: FileList) => {
    logger.log('FileUpload', 'INFO', `${newFiles.length} arquivo(s) recebido(s) para processamento.`);
    setError(null);
    const accepted: File[] = [];
    const rejected: { name: string; reason: string }[] = [];

    Array.from(newFiles).forEach((file) => {
      if (file.size > FILE_SIZE_LIMIT_BYTES) {
        rejected.push({ name: file.name, reason: `Tamanho excede ${FILE_SIZE_LIMIT_MB} MB` });
      } else if (files.some((current) => current.name === file.name && current.size === file.size)) {
        rejected.push({ name: file.name, reason: 'Arquivo ja adicionado.' });
      } else {
        accepted.push(file);
      }
    });

    if (rejected.length) {
      const message = `Arquivo(s) rejeitado(s): ${rejected.map((item) => `${item.name} (${item.reason})`).join(', ')}.`;
      setError(message);
      logger.log('FileUpload', 'WARN', message, { rejectedFiles: rejected });
    }

    if (accepted.length) {
      setFiles((prev) => [...prev, ...accepted]);
    }
  };

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      if (!disabled && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        handleFilesAdded(event.dataTransfer.files);
      }
    },
    [disabled, files],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled && event.target.files && event.target.files.length > 0) {
      handleFilesAdded(event.target.files);
      event.target.value = '';
    }
  };

  const handleDemoFile = () => {
    if (disabled) return;
    const demoFile = new File([DEMO_XML], 'NFe_Demonstracao.xml', { type: 'text/xml' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(demoFile);
    handleFilesAdded(dataTransfer.files);
  };

  const handleStart = () => {
    if (files.length > 0 && !disabled) {
      onStartAnalysis(files);
      setFiles([]);
    }
  };

  const fileTypes =
    '.xml,.csv,.xlsx,.pdf,.png,.jpeg,.jpg,.zip,application/zip,application/x-zip-compressed';

  const containerClasses = `
    rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300
    ${
      disabled
        ? 'cursor-not-allowed border-slate-700 bg-[#09152b]/60'
        : isDragging
        ? 'border-sky-400/80 bg-[#103256]/70 shadow-[0_25px_50px_-25px_rgba(56,189,248,0.65)] scale-[1.015]'
        : 'border-slate-600/70 bg-[#09152b]/85 hover:border-sky-400/70 hover:bg-[#0b1f38]'
    }
  `;

  return (
    <section className="rounded-3xl border border-white/5 bg-[#0d1b33]/90 p-8 shadow-[0_35px_60px_-25px_rgba(15,118,209,0.35)]">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold text-slate-100">1. Upload de Arquivos</h2>
        <p className="mt-2 text-sm text-slate-400">
          Arraste e solte ou selecione documentos fiscais para iniciar a análise.
        </p>
      </div>

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={containerClasses}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          multiple
          accept={fileTypes}
          onChange={handleFileChange}
          disabled={disabled}
        />
        <label htmlFor="file-upload" className={disabled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}>
          <div className="flex flex-col items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-sky-400/40 bg-[#0b223f]/70">
              <UploadIcon className={`h-9 w-9 ${disabled ? 'text-slate-600' : 'text-sky-300'}`} />
            </div>
            <p className={`mt-6 text-lg font-semibold ${disabled ? 'text-slate-500' : 'text-sky-300'}`}>
              Clique ou arraste novos arquivos
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Suportados: XML, CSV, XLSX, PDF, Imagens (PNG, JPG) e ZIP — limite de {FILE_SIZE_LIMIT_MB} MB
            </p>
          </div>
        </label>
      </div>

      <div className="mt-5 text-center">
        <button
          onClick={handleDemoFile}
          disabled={disabled}
          className="text-sm font-medium text-sky-300 transition hover:text-sky-200 disabled:cursor-not-allowed disabled:text-slate-500"
        >
          Nao tem um arquivo? Use um exemplo de demonstracao.
        </button>
      </div>

      {error && <p className="mt-3 text-center text-xs text-rose-400">{error}</p>}

      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-300">Fila de processamento</h3>
          <ul className="max-h-36 space-y-2 overflow-y-auto pr-2">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0b1f38]/80 px-3 py-2 text-xs text-slate-200"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800/70">
                    <FileIcon className="h-4 w-4 text-slate-400" />
                  </div>
                  <span className="truncate">{file.name}</span>
                </div>
                <span className="ml-3 shrink-0 text-slate-400">{formatBytes(file.size)}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleStart}
            disabled={disabled || files.length === 0}
            className="mt-5 w-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-300 py-3 text-sm font-semibold text-slate-900 shadow-[0_18px_40px_-28px_rgba(56,189,248,0.85)] transition hover:shadow-[0_25px_45px_-30px_rgba(45,212,191,0.9)] disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-none"
          >
            Analisar {files.length} arquivo(s)
          </button>
        </div>
      )}
    </section>
  );
};

export default FileUpload;
