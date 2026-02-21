import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { Barcode, CheckCircle2, Plus, FileSpreadsheet, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../utils';
import { ORIGINS } from '../constants';
import { Origin, StockItem } from '../types';

interface SetupViewProps {
    origin: Origin | null;
    setOrigin: (origin: Origin) => void;
    client: string;
    setClient: (client: string) => void;
    onStartCounting: () => void;
    customStockCount: number;
    onStockImported: (data: StockItem[]) => void;
}

export function SetupView({
    origin,
    setOrigin,
    client,
    setClient,
    onStartCounting,
    customStockCount,
    onStockImported
}: SetupViewProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const toastId = toast.loading('Lendo arquivo Excel...');

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0]; // Pega a primeira aba do Excel
                const ws = wb.Sheets[wsname];

                // Converte a planilha para JSON usando a primeira linha como chave
                const rawData = XLSX.utils.sheet_to_json<any>(ws);

                // Mapeia as colunas do Excel para o nosso formato StockItem
                const mappedData: StockItem[] = rawData.map((row) => {
                    // Função auxiliar para encontrar colunas ignorando maiúsculas, minúsculas e acentos
                    const findValue = (possibleNames: string[]) => {
                        const key = Object.keys(row).find(k => {
                            const normalizedKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                            return possibleNames.some(pn => normalizedKey.includes(pn));
                        });
                        return key ? String(row[key]).trim() : '';
                    };

                    return {
                        codigo: findValue(['codigo', 'cod', 'sku']),
                        descricao: findValue(['descricao', 'desc', 'produto', 'nome', 'item']) || 'Sem descrição',
                        local: findValue(['local', 'posicao', 'rua', 'endereco', 'prateleira']) || '---'
                    };
                }).filter(item => item.codigo !== ''); // Filtra linhas que não têm código

                if (mappedData.length === 0) {
                    toast.error('Nenhum dado válido encontrado. Certifique-se que as colunas tenham nomes como "Código", "Descrição" e "Local".', { id: toastId });
                    return;
                }

                onStockImported(mappedData);
                toast.success(`${mappedData.length} itens importados com sucesso!`, { id: toastId });
            } catch (error) {
                console.error('Erro ao processar Excel:', error);
                toast.error('Erro ao ler o arquivo Excel', { id: toastId });
            }
        };
        reader.readAsBinaryString(file);

        // Limpa o input para permitir subir o mesmo arquivo novamente
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const clearCustomStock = () => {
        if (window.confirm('Tem certeza que deseja apagar a base de produtos importada? O sistema voltará a usar a base de testes.')) {
            onStockImported([]); // Envia array vazio para limpar
            toast.success('Base de produtos limpa.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <Toaster position="top-center" />
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
                        <Barcode className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Nova Contagem</h1>
                    <p className="text-slate-500 text-sm mt-1">Selecione a origem para iniciar</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    {ORIGINS.map((opt) => (
                        <button
                            key={opt}
                            onClick={() => setOrigin(opt)}
                            className={cn(
                                "h-24 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-2 font-bold text-lg",
                                origin === opt
                                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                                    : "border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50"
                            )}
                        >
                            {opt}
                            {origin === opt && <CheckCircle2 className="w-5 h-5" />}
                        </button>
                    ))}
                </div>

                <div className="space-y-3">
                    {origin === 'DEVOLUÇÃO' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4"
                        >
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome do Cliente</label>
                            <input
                                type="text"
                                placeholder="Digite o nome do cliente..."
                                value={client}
                                onChange={(e) => setClient(e.target.value)}
                                className="w-full h-12 bg-white border-2 border-slate-200 rounded-xl px-4 text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                            />
                        </motion.div>
                    )}

                    <button
                        onClick={onStartCounting}
                        disabled={!origin || (origin === 'DEVOLUÇÃO' && !client.trim())}
                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        Iniciar contagem
                        <Plus className="w-5 h-5" />
                    </button>

                    <div className="relative pt-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImportExcel}
                            accept=".xlsx, .xls, .csv"
                            className="hidden"
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 h-12 bg-white border-2 border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-600 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
                            >
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                {customStockCount > 0 ? 'Atualizar Estoque (Excel)' : 'Importar Estoque (Excel)'}
                            </button>

                            {/* Botão de limpar estoque importado */}
                            {customStockCount > 0 && (
                                <button
                                    onClick={clearCustomStock}
                                    className="h-12 w-12 flex items-center justify-center bg-white border-2 border-red-100 hover:border-red-300 hover:bg-red-50 text-red-500 rounded-2xl transition-all flex-shrink-0"
                                    title="Limpar base importada"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {customStockCount > 0 && (
                            <p className="text-[11px] font-medium text-center text-slate-400 mt-2">
                                <span className="text-emerald-600 font-bold">{customStockCount} itens</span> carregados na base atual
                            </p>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}