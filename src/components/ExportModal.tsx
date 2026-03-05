import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, Download, Loader2, X, CheckCircle2, FileSpreadsheet, FileImage } from 'lucide-react';
import { cn } from '../utils';

export type ExportStatus = 'idle' | 'generating' | 'ready' | 'error';

export type ExportFile = { blob: Blob | File; name: string; type: 'excel' | 'image' };

interface ExportModalProps {
    isOpen: boolean;
    status: ExportStatus;
    onClose: () => void;
    onShareImage: () => void;
    onShareExcel: () => void;
    files: ExportFile[];
    hasFiles: boolean;
}
const FileItem: React.FC<{ file: ExportFile; onDownload: () => void }> = ({ file, onDownload }) => {
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (file.type === 'image') {
            const url = URL.createObjectURL(file.blob);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    const getFriendlyName = (name: string, type: string) => {
        if (type === 'excel') return 'Planilha de Contagem';
        if (name.includes('_parte')) {
            const part = name.match(/_parte(\d+)/)?.[1];
            return `Imagem da Contagem (Parte ${part})`;
        }
        return 'Imagem da Contagem';
    };

    return (
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 overflow-hidden">
                {file.type === 'excel' ? (
                    <div className="w-12 h-12 shrink-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center">
                        <FileSpreadsheet className="w-6 h-6" />
                    </div>
                ) : (
                    <div className="w-12 h-12 shrink-0 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center overflow-hidden border border-indigo-100 dark:border-indigo-800/50">
                        {previewUrl ? (
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover opacity-90" />
                        ) : (
                            <FileImage className="w-6 h-6" />
                        )}
                    </div>
                )}
                <div className="flex flex-col truncate">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                        {getFriendlyName(file.name, file.type)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {file.type === 'excel' ? 'Arquivo Excel (.xlsx)' : `Imagem PNG (${(file.blob.size / 1024).toFixed(0)} KB)`}
                    </span>
                </div>
            </div>
            <button
                onClick={onDownload}
                className="p-2 ml-2 bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-600 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 transition-colors shrink-0"
                title="Baixar arquivo"
            >
                <Download className="w-5 h-5" />
            </button>
        </div>
    );
};

export const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    status,
    onClose,
    onShareImage,
    onShareExcel,
    files,
    hasFiles
}) => {
    const [view, setView] = React.useState<'options' | 'downloadList'>('options');
    const [isDownloadingAll, setIsDownloadingAll] = React.useState(false);

    React.useEffect(() => {
        if (!isOpen) {
            setView('options');
            setIsDownloadingAll(false);
        }
    }, [isOpen]);

    const handleDownload = (file: ExportFile) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(file.blob);
        link.download = file.name;
        link.click();
    };

    const handleDownloadAll = async () => {
        if (isDownloadingAll) return;
        setIsDownloadingAll(true);
        for (let i = 0; i < files.length; i++) {
            handleDownload(files[i]);
            await new Promise(resolve => setTimeout(resolve, 600)); // wait 600ms between downloads to avoid browser blocking
        }
        setIsDownloadingAll(false);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={status === 'generating' ? undefined : onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden relative z-10"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                Exportar Fechamento
                            </h3>
                            {status !== 'generating' && (
                                <button
                                    onClick={onClose}
                                    className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-8 flex flex-col items-center justify-center min-h-[220px]">
                            {status === 'generating' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center text-center gap-4"
                                >
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-full border-4 border-indigo-100 dark:border-indigo-900/30"></div>
                                        <Loader2 className="w-16 h-16 text-indigo-600 dark:text-indigo-400 animate-spin absolute top-0 left-0" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-100 text-lg">Gerando Arquivos</p>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Isso pode levar alguns segundos...</p>
                                    </div>
                                </motion.div>
                            )}

                            {status === 'ready' && hasFiles && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center w-full gap-5"
                                >
                                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-2">
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>

                                    <div className="text-center mb-2">
                                        <p className="font-bold text-slate-800 dark:text-slate-100 text-lg">Pronto para Enviar!</p>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Como deseja prosseguir?</p>
                                    </div>

                                    <div className="w-full flex-col flex gap-3">
                                        {view === 'options' ? (
                                            <>
                                                {/* Só mostramos o botão de share se a API estiver disponível, mas no navegador PC às vezes canShare diz true e depois falha. A lógica tratará falhas. */}
                                                <button
                                                    onClick={onShareImage}
                                                    className="w-full h-12 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                                                >
                                                    <Share2 className="w-5 h-5" />
                                                    Compartilhar Imagens
                                                </button>

                                                <button
                                                    onClick={onShareExcel}
                                                    className="w-full h-12 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                                                >
                                                    <Share2 className="w-5 h-5" />
                                                    Compartilhar Excel
                                                </button>

                                                <button
                                                    onClick={() => setView('downloadList')}
                                                    className="w-full h-12 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                                                >
                                                    <Download className="w-5 h-5" />
                                                    Baixar Arquivos
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <button onClick={() => setView('options')} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0">
                                                        <X className="w-5 h-5 text-slate-500" />
                                                    </button>
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">Arquivos gerados</span>
                                                </div>

                                                <div className="max-h-[220px] overflow-y-auto flex flex-col gap-2 p-1">
                                                    {files.map((file, idx) => (
                                                        <FileItem key={idx} file={file} onDownload={() => handleDownload(file)} />
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={handleDownloadAll}
                                                    disabled={isDownloadingAll}
                                                    className="w-full h-12 mt-2 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                                >
                                                    {isDownloadingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                                    {isDownloadingAll ? 'Baixando...' : 'Baixar Todos'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {status === 'error' && (
                                <div className="text-center text-red-500">
                                    <X className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p className="font-bold">Erro ao gerar arquivos</p>
                                    <p className="text-sm mt-1 opacity-80">Por favor, tente novamente.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
