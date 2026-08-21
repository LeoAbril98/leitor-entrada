import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Share2, Download, FileSpreadsheet, X, CheckCircle2, AlertTriangle, FileText, Loader2, User } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { CargaItem, UnmatchedScan, findStockMatchForItem } from './ConferenceModule';
import { StockItem } from '../types';

interface ConferenceExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    cargaDocName: string;
    cargaItems: CargaItem[];
    stock: StockItem[];
    codeMappings: Record<string, string>;
    unmatchedScans: UnmatchedScan[];
}

export function createConferencePDFDoc(
    cargaDocName: string,
    cargaItems: CargaItem[],
    stock: StockItem[],
    codeMappings: Record<string, string>,
    unmatchedScans: UnmatchedScan[] = [],
    conferenteName: string = ''
): jsPDF {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const totalDoc = cargaItems.reduce((acc, item) => acc + item.qtdEsperada, 0);
    const totalConferidos = cargaItems.reduce((acc, item) => acc + item.qtdConferida, 0);
    const okCount = cargaItems.filter(item => item.qtdConferida === item.qtdEsperada && item.qtdEsperada > 0).length;
    const divergentesCount = cargaItems.filter(item => item.qtdConferida !== item.qtdEsperada).length;

    const isFullyOk = divergentesCount === 0 && totalConferidos >= totalDoc && totalDoc > 0;

    // -------------------------------------------------------------
    // CABEÇALHO DA PÁGINA 1
    // -------------------------------------------------------------
    // Banner Superior Dark Slate (#0f172a)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 32, 'F');

    // Faixa Accent Azul (#3b82f6)
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, 210, 2.5, 'F');

    // Título Principal
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE CONFERÊNCIA DE CARGA CM', 14, 13);

    // Subtítulo e Informações do Documento
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(`MANIFESTO / CARGA: ${cargaDocName.toUpperCase()}`, 14, 20);

    const nowStr = new Date().toLocaleString('pt-BR');
    doc.text(`EMISSÃO: ${nowStr}`, 14, 26);

    // Selo de Status no Canto Superior Direito
    if (isFullyOk) {
        doc.setFillColor(16, 185, 129); // emerald-500
        doc.roundedRect(140, 9, 56, 14, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('CARGA 100% OK', 146, 18);
    } else {
        doc.setFillColor(239, 68, 68); // red-500
        doc.roundedRect(134, 9, 62, 14, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.text('DIVERGÊNCIA DETECTADA', 137, 18);
    }

    // -------------------------------------------------------------
    // CARD RESUMO EXECUTIVO (KPIs)
    // -------------------------------------------------------------
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(14, 36, 182, 22, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, 36, 182, 22, 3, 3, 'D');

    // Divisores verticais entre os KPIs
    doc.setDrawColor(226, 232, 240);
    doc.line(59, 39, 59, 55);
    doc.line(105, 39, 105, 55);
    doc.line(151, 39, 151, 55);

    // KPI 1: Esperado
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL ESPERADO', 18, 43);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(`${totalDoc} rodas`, 18, 52);

    // KPI 2: Bipados
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.text('TOTAL CONFERIDO', 63, 43);
    doc.setTextColor(37, 99, 235); // blue-600
    doc.setFontSize(12);
    doc.text(`${totalConferidos} lidas`, 63, 52);

    // KPI 3: Totalmente OK
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.text('ITENS 100% OK', 109, 43);
    doc.setTextColor(16, 185, 129); // emerald-600
    doc.setFontSize(12);
    doc.text(`${okCount} itens`, 109, 52);

    // KPI 4: Divergentes
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.text('DIVERGÊNCIAS', 155, 43);
    doc.setTextColor(divergentesCount > 0 ? 220 : 100, divergentesCount > 0 ? 38 : 116, divergentesCount > 0 ? 38 : 139);
    doc.setFontSize(12);
    doc.text(`${divergentesCount} itens`, 155, 52);

    // -------------------------------------------------------------
    // TABELA PRINCIPAL DE CARGA
    // -------------------------------------------------------------
    const tableRows = cargaItems.map((item, idx) => {
        let statusStr = 'PENDENTE';
        if (item.qtdConferida === item.qtdEsperada && item.qtdEsperada > 0) {
            statusStr = 'OK';
        } else if (item.qtdConferida > item.qtdEsperada) {
            statusStr = `EXCEDENTE (+${item.qtdConferida - item.qtdEsperada})`;
        } else if (item.qtdConferida < item.qtdEsperada && item.qtdConferida > 0) {
            statusStr = `INCOMPLETO (-${item.qtdEsperada - item.qtdConferida})`;
        } else {
            statusStr = 'NÃO BIPADO';
        }

        return [
            (idx + 1).toString(),
            item.descricao,
            item.cliente || '-',
            item.qtdEsperada.toString(),
            item.qtdConferida.toString(),
            statusStr
        ];
    });

    autoTable(doc, {
        startY: 64,
        head: [['#', 'Item / Roda (Descrição)', 'Cliente / Destino', 'Qtd Doc', 'Conferido', 'Status']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [30, 41, 59]
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 75, fontStyle: 'bold' },
            2: { cellWidth: 47 },
            3: { halign: 'center', cellWidth: 15 },
            4: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
            5: { halign: 'center', cellWidth: 25, fontStyle: 'bold' }
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 5) {
                const val = data.cell.text[0] || '';
                if (val === 'OK') {
                    data.cell.styles.textColor = [16, 185, 129];
                } else if (val.includes('EXCEDENTE')) {
                    data.cell.styles.textColor = [147, 51, 234];
                } else if (val.includes('INCOMPLETO')) {
                    data.cell.styles.textColor = [217, 119, 6];
                } else {
                    data.cell.styles.textColor = [220, 38, 38];
                }
            }
        }
    });

    let currentY = (doc as any).lastAutoTable?.finalY || 70;

    // -------------------------------------------------------------
    // TABELA DE LEITURAS COM ERRO / NÃO PREVISTAS (SE HOUVER)
    // -------------------------------------------------------------
    if (unmatchedScans.length > 0) {
        if (currentY > 220) {
            doc.addPage();
            currentY = 20;
        } else {
            currentY += 8;
        }

        doc.setFillColor(254, 242, 242);
        doc.rect(14, currentY, 182, 8, 'F');
        doc.setDrawColor(252, 165, 165);
        doc.rect(14, currentY, 182, 8, 'D');

        doc.setTextColor(185, 28, 28);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`LEITURAS NÃO PREVISTAS OU COM ERRO (${unmatchedScans.length})`, 18, currentY + 5.5);

        const errorRows = unmatchedScans.map((err, i) => [
            (i + 1).toString(),
            err.code,
            err.reason,
            `${err.count}x`,
            err.timestamp
        ]);

        autoTable(doc, {
            startY: currentY + 10,
            head: [['#', 'Código Bipado', 'Motivo / Detalhe do Erro', 'Qtd Lida', 'Horário']],
            body: errorRows,
            theme: 'grid',
            headStyles: {
                fillColor: [185, 28, 28],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 8,
                textColor: [127, 29, 29]
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 8 },
                1: { cellWidth: 45, fontStyle: 'bold' },
                2: { cellWidth: 85 },
                3: { halign: 'center', cellWidth: 20 },
                4: { halign: 'center', cellWidth: 24 }
            }
        });

        currentY = (doc as any).lastAutoTable?.finalY || currentY + 30;
    }

    // -------------------------------------------------------------
    // SEÇÃO DE IDENTIFICAÇÃO DO CONFERENTE (SEM ASSINATURAS MANUAIS)
    // -------------------------------------------------------------
    if (currentY > 245) {
        doc.addPage();
        currentY = 30;
    } else {
        currentY += 10;
    }

    // Card de Validação / Conferente
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(14, currentY, 182, 18, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, currentY, 182, 18, 3, 3, 'D');

    // Linha Accent Lateral Azul
    doc.setFillColor(59, 130, 246); // blue-500
    doc.roundedRect(14, currentY, 3, 18, 1.5, 1.5, 'F');

    // Texto Conferente
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('CONFERENTE RESPONSÁVEL', 22, currentY + 6);

    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text((conferenteName.trim() || 'NÃO INFORMADO').toUpperCase(), 22, currentY + 12.5);

    // Texto Data e Hora da Conferência
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DATA E HORA DA AUDITORIA', 120, currentY + 6);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(nowStr, 120, currentY + 12.5);

    // -------------------------------------------------------------
    // RODAPÉ E PAGINAÇÃO EM TODAS AS PÁGINAS
    // -------------------------------------------------------------
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 285, 196, 285);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text('MK RODAS & ACESSÓRIOS • Sistema de Leitura e Conferência CM', 14, 290);
        doc.text(`Página ${i} de ${totalPages}`, 196, 290, { align: 'right' });
    }

    return doc;
}

export const ConferenceExportModal: React.FC<ConferenceExportModalProps> = ({
    isOpen,
    onClose,
    cargaDocName,
    cargaItems,
    stock,
    codeMappings,
    unmatchedScans
}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [conferenteName, setConferenteName] = useState(() => {
        return localStorage.getItem('@MK_LAST_CONFERENTE') || '';
    });

    if (!isOpen) return null;

    const totalDoc = cargaItems.reduce((acc, item) => acc + item.qtdEsperada, 0);
    const totalConferidos = cargaItems.reduce((acc, item) => acc + item.qtdConferida, 0);
    const okCount = cargaItems.filter(item => item.qtdConferida === item.qtdEsperada && item.qtdEsperada > 0).length;
    const divergentesCount = cargaItems.filter(item => item.qtdConferida !== item.qtdEsperada).length;
    const isFullyOk = divergentesCount === 0 && totalConferidos >= totalDoc && totalDoc > 0;

    const cleanDocName = cargaDocName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const pdfFileName = `Relatorio_Conferencia_${cleanDocName}.pdf`;
    const excelFileName = `Conferencia_${cleanDocName}.xlsx`;

    const getPdfBlobAndFile = () => {
        const doc = createConferencePDFDoc(cargaDocName, cargaItems, stock, codeMappings, unmatchedScans, conferenteName);
        const blob = doc.output('blob');
        const file = new File([blob], pdfFileName, { type: 'application/pdf' });
        return { doc, blob, file };
    };

    const handleSharePDF = async () => {
        try {
            setIsGenerating(true);
            const { blob, file } = getPdfBlobAndFile();

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: `Conferência CM - ${cargaDocName}`,
                    text: `Relatório de Conferência de Carga: ${cargaDocName} (${totalConferidos}/${totalDoc} rodas conferidas)`,
                    files: [file]
                });
                toast.success('PDF compartilhado com sucesso!');
            } else {
                // Fallback para baixar direto se o navegador desktop não suportar o compartilhamento nativo de arquivos
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = pdfFileName;
                a.click();
                URL.revokeObjectURL(url);
                toast('Compartilhamento direto indisponível neste navegador. O PDF foi baixado automaticamente.', {
                    icon: '📥',
                    duration: 4000
                });
            }
        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                console.error('Erro ao compartilhar PDF:', error);
                toast.error('Não foi possível compartilhar o PDF.');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadPDF = () => {
        try {
            setIsGenerating(true);
            const { doc } = getPdfBlobAndFile();
            doc.save(pdfFileName);
            toast.success('Relatório PDF baixado com sucesso!');
        } catch (error) {
            console.error('Erro ao baixar PDF:', error);
            toast.error('Erro ao gerar arquivo PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadExcel = () => {
        try {
            setIsGenerating(true);
            const worksheetData = cargaItems.map((item, idx) => {
                const stockMatch = findStockMatchForItem(item.descricao, item.codigo, stock, codeMappings);
                let statusStr = 'PENDENTE';
                if (item.qtdConferida === item.qtdEsperada && item.qtdEsperada > 0) statusStr = 'OK';
                else if (item.qtdConferida > item.qtdEsperada) statusStr = `EXCEDENTE (+${item.qtdConferida - item.qtdEsperada})`;
                else if (item.qtdConferida < item.qtdEsperada && item.qtdConferida > 0) statusStr = `INCOMPLETO (-${item.qtdEsperada - item.qtdConferida})`;
                else statusStr = 'NÃO BIPADO';

                return {
                    '#': idx + 1,
                    'Item / Roda (Descrição)': item.descricao,
                    'Cód. Estoque': stockMatch ? stockMatch.codigo : '-',
                    'Cliente / Destino': item.cliente || '-',
                    'Qtd Doc CM': item.qtdEsperada,
                    'Bipado (Conferido)': item.qtdConferida,
                    'Status': statusStr,
                    'Conferente': conferenteName.toUpperCase() || 'NÃO INFORMADO',
                    'Data/Hora Conferência': new Date().toLocaleString('pt-BR')
                };
            });

            const ws = XLSX.utils.json_to_sheet(worksheetData);
            ws['!cols'] = [
                { wch: 5 },
                { wch: 45 },
                { wch: 20 },
                { wch: 30 },
                { wch: 12 },
                { wch: 18 },
                { wch: 15 }
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Conferencia_Carga');
            XLSX.writeFile(wb, excelFileName);

            toast.success('Planilha Excel baixada com sucesso!');
        } catch (error) {
            console.error('Erro ao gerar Excel:', error);
            toast.error('Erro ao exportar Excel');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative z-10"
                >
                    {/* Header */}
                    <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">Exportar Relatório CM</h3>
                                <p className="text-xs text-slate-400 truncate max-w-[220px]">{cargaDocName}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Resumo da Carga & Campo do Conferente */}
                    <div className="p-6 space-y-4">
                        {/* Campo Nome do Conferente */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <User className="w-4 h-4 text-indigo-500" />
                                Quem realizou a conferência?
                            </label>
                            <input
                                type="text"
                                value={conferenteName}
                                onChange={(e) => {
                                    setConferenteName(e.target.value);
                                    localStorage.setItem('@MK_LAST_CONFERENTE', e.target.value);
                                }}
                                placeholder="Digite seu nome (Ex: João Silva)..."
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder-slate-400"
                            />
                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Status da Carga</span>
                                <div className="flex items-center gap-2 mt-1">
                                    {isFullyOk ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs rounded-full">
                                            <CheckCircle2 className="w-4 h-4" /> 100% OK
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-extrabold text-xs rounded-full">
                                            <AlertTriangle className="w-4 h-4" /> Com Divergências
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium block">Total Lido</span>
                                <span className="text-lg font-black text-slate-900 dark:text-white">
                                    {totalConferidos} <span className="text-xs font-normal text-slate-400">/ {totalDoc} rodas</span>
                                </span>
                            </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="space-y-3">
                            {/* Compartilhar PDF */}
                            <button
                                onClick={handleSharePDF}
                                disabled={isGenerating}
                                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                            >
                                {isGenerating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Share2 className="w-5 h-5 text-indigo-200" />
                                        <div className="text-left leading-tight">
                                            <div className="text-sm font-bold">Compartilhar PDF</div>
                                            <div className="text-[11px] text-indigo-200 font-normal">Enviar via WhatsApp / Aplicativos</div>
                                        </div>
                                    </>
                                )}
                            </button>

                            {/* Baixar PDF */}
                            <button
                                onClick={handleDownloadPDF}
                                disabled={isGenerating}
                                className="w-full h-14 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                            >
                                {isGenerating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Download className="w-5 h-5 text-emerald-400" />
                                        <div className="text-left leading-tight">
                                            <div className="text-sm font-bold">Baixar PDF</div>
                                            <div className="text-[11px] text-slate-400 font-normal">Salvar relatório em alta definição</div>
                                        </div>
                                    </>
                                )}
                            </button>

                            {/* Baixar Excel */}
                            <button
                                onClick={handleDownloadExcel}
                                disabled={isGenerating}
                                className="w-full h-12 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-all disabled:opacity-50"
                            >
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-xs font-bold">Baixar Planilha Excel (.xlsx)</span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
