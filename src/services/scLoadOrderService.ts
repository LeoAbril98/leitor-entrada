import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { Romaneio } from './romaneioService';

export interface SCOrderItem {
    codigo: string;
    descricao: string;
    quantidade: number;
    quantidadeCarga: number;
}

export interface SCLoadOrder {
    id: string;
    dataCriacao: string;
    cargaId: string;
    cargaNumero: string;
    itens: SCOrderItem[];
    pdfPath: string;
    excelPath: string;
}

export const SC_ORDER_DRAFT_KEY = 'mkr_pedido_rodas_sc_rascunho_v1';
const ROOT = 'pedidos-rodas-sc';

export function getSCLoadItems(carga: Romaneio): SCOrderItem[] {
    const byCode = new Map<string, SCOrderItem>();
    carga.itens.forEach(item => {
        const codigo = item.codigo.trim().toUpperCase();
        if (!codigo || item.quantidade <= 0) return;
        const existing = byCode.get(codigo);
        if (existing) existing.quantidadeCarga += item.quantidade;
        else byCode.set(codigo, {
            codigo, descricao: item.descricao || codigo,
            quantidade: 0, quantidadeCarga: item.quantidade
        });
    });
    return Array.from(byCode.values()).sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR', { numeric: true }));
}

export async function generateSCOrderFiles(order: SCLoadOrder): Promise<{ pdf: Blob; excel: Blob }> {
    const doc = new jsPDF();
    const total = order.itens.reduce((sum, item) => sum + item.quantidade, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('PEDIDO DE RODAS SC', 14, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Carga: ${order.cargaNumero}`, 14, 28);
    doc.text(new Date(order.dataCriacao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), 14, 34);
    doc.text(`${order.itens.length} ${order.itens.length === 1 ? 'modelo' : 'modelos'} | ${total} unidades pedidas`, 14, 40);
    autoTable(doc, {
        startY: 46,
        margin: { left: 14, right: 14, bottom: 17 },
        head: [['CODIGO', 'DESCRICAO', 'QUANTIDADE']],
        body: order.itens.map(item => [item.codigo, item.descricao, '']),
        theme: 'plain',
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 3, minCellHeight: 18, valign: 'middle', lineColor: [225, 230, 235], lineWidth: { bottom: 0.2 }, fillColor: [255, 255, 255], textColor: [51, 65, 85] },
        headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], minCellHeight: 9, fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 104 }, 2: { cellWidth: 44, halign: 'center' } },
        rowPageBreak: 'avoid',
        didDrawCell: data => {
            if (data.section !== 'body') return;
            const item = order.itens[data.row.index];
            if (data.column.index === 2) {
                const x = data.cell.x + data.cell.width / 2, y = data.cell.y + data.cell.height / 2;
                doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20);
                doc.text(String(item.quantidade), x, y, { align: 'center' });
                doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(110);
                doc.text(`Na carga: ${item.quantidadeCarga} un`, x, y + 4, { align: 'center' });
            }
        }
    });
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
        doc.setPage(page); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110);
        doc.text(`Pedido ${order.id}`, 14, 287);
        doc.text(`${page} / ${pages}`, 196, 287, { align: 'right' });
    }
    const sheet = XLSX.utils.json_to_sheet(order.itens.map(item => ({
        'Codigo': item.codigo, 'Descricao': item.descricao, 'Quantidade': item.quantidade
    })));
    sheet['!cols'] = [{ wch: 22 }, { wch: 65 }, { wch: 16 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Pedido SC');
    return {
        pdf: doc.output('blob'),
        excel: new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
    };
}

export async function sendSCLoadOrder(draft: Omit<SCLoadOrder, 'pdfPath' | 'excelPath'>): Promise<SCLoadOrder> {
    if (!draft.itens.length || draft.itens.some(item => !Number.isSafeInteger(item.quantidade) || item.quantidade <= 0)) {
        throw new Error('Informe quantidades inteiras maiores que zero.');
    }
    if (draft.itens.some(item => !Number.isSafeInteger(item.quantidadeCarga) || item.quantidade > item.quantidadeCarga)) {
        throw new Error('A quantidade pedida não pode ser maior que a quantidade no caminhão.');
    }
    const storage = supabase.storage.from('fotos');
    const recordPath = `${ROOT}/registros/${draft.id}.json`;
    const order: SCLoadOrder = {
        ...draft,
        pdfPath: `${ROOT}/arquivos/${draft.id}/pedido-sc.pdf`,
        excelPath: `${ROOT}/arquivos/${draft.id}/pedido-sc.xlsx`
    };
    // A stable draft ID makes retries safe when the previous response was lost.
    const previous = await storage.download(recordPath);
    if (previous.data) {
        const saved = JSON.parse(await previous.data.text()) as SCLoadOrder;
        if (JSON.stringify(saved.itens) !== JSON.stringify(order.itens)) throw new Error('Este pedido ja foi recebido. Inicie um novo pedido.');
        return saved;
    }
    const files = await generateSCOrderFiles(order);
    for (const [path, blob] of [[order.pdfPath, files.pdf], [order.excelPath, files.excel]] as const) {
        const { error } = await storage.upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: '0' });
        if (error) throw new Error(`Nao foi possivel enviar os arquivos: ${error.message}`);
    }
    // Publish only after both files exist, so admin never sees a partial order.
    const { error } = await storage.upload(recordPath, new Blob([JSON.stringify(order)], { type: 'application/json' }), {
        upsert: true, contentType: 'application/json', cacheControl: '0'
    });
    if (error) throw new Error(`Nao foi possivel concluir o envio: ${error.message}`);
    window.dispatchEvent(new Event('mkr_sc_orders_updated'));
    return order;
}

export async function getSCLoadOrders(): Promise<SCLoadOrder[]> {
    const storage = supabase.storage.from('fotos');
    const records: { name: string }[] = [];
    for (let offset = 0; ; offset += 100) {
        const { data, error } = await storage.list(`${ROOT}/registros`, { limit: 100, offset, sortBy: { column: 'name', order: 'desc' } });
        if (error) throw new Error(error.message);
        records.push(...(data || []).filter(file => file.name.endsWith('.json')));
        if (!data || data.length < 100) break;
    }
    const orders: SCLoadOrder[] = [];
    for (let i = 0; i < records.length; i += 6) {
        const batch = await Promise.all(records.slice(i, i + 6).map(async record => {
            const { data, error } = await storage.download(`${ROOT}/registros/${record.name}`);
            if (error || !data) throw new Error('Nao foi possivel carregar os pedidos de SC.');
            return JSON.parse(await data.text()) as SCLoadOrder;
        }));
        orders.push(...batch);
    }
    return orders.sort((a, b) => b.dataCriacao.localeCompare(a.dataCriacao));
}

export async function downloadSCOrderFile(order: SCLoadOrder, type: 'pdf' | 'excel'): Promise<void> {
    const { data, error } = await supabase.storage.from('fotos').download(type === 'pdf' ? order.pdfPath : order.excelPath);
    if (error || !data) throw new Error('Nao foi possivel baixar o arquivo.');
    const carga = order.cargaNumero.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 40);
    const date = new Date(order.dataCriacao).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(/\//g, '-');
    saveAs(data, `pedido-sc-${carga}-${date}-${order.id.slice(0, 8)}.${type === 'pdf' ? 'pdf' : 'xlsx'}`);
}

export async function deleteSCLoadOrder(order: SCLoadOrder): Promise<void> {
    const { error } = await supabase.storage.from('fotos').remove([
        `${ROOT}/registros/${order.id}.json`, order.pdfPath, order.excelPath
    ]);
    if (error) throw new Error('Nao foi possivel apagar o pedido. Tente novamente.');
    window.dispatchEvent(new Event('mkr_sc_orders_updated'));
}
