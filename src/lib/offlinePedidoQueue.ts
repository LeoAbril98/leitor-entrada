type PendingPedido = {
    codigo: string;
    factory: string;
    quantidade: number;
    updated_at: string;
};

const STORAGE_KEY = '@MK_PEDIDOS_FABRICA_PENDING_SYNC';

const getPedidoKey = (codigo: string, factory: string) => `${String(codigo).trim()}__${String(factory).trim()}`;

export function loadPendingPedidos(): PendingPedido[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Erro ao ler fila offline de pedidos:', error);
        return [];
    }
}

function savePendingPedidos(rows: PendingPedido[]) {
    if (rows.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function getPendingPedidoCount() {
    return loadPendingPedidos().length;
}

export function queuePendingPedido(codigo: string, factory: string, quantidade: number) {
    const nextEntry: PendingPedido = {
        codigo: String(codigo).trim(),
        factory: String(factory).trim(),
        quantidade,
        updated_at: new Date().toISOString()
    };

    const nextByKey = new Map(loadPendingPedidos().map((entry) => [getPedidoKey(entry.codigo, entry.factory), entry]));
    nextByKey.set(getPedidoKey(codigo, factory), nextEntry);
    savePendingPedidos(Array.from(nextByKey.values()));
}

export function removePendingPedido(codigo: string, factory: string) {
    const key = getPedidoKey(codigo, factory);
    savePendingPedidos(loadPendingPedidos().filter((entry) => getPedidoKey(entry.codigo, entry.factory) !== key));
}

export function clearPendingPedidos() {
    localStorage.removeItem(STORAGE_KEY);
}

export function mergePendingPedidosIntoState<TFactory extends string>(
    base: Record<string, Record<TFactory, number>>,
    emptyFactories: Record<TFactory, number>
) {
    return loadPendingPedidos().reduce((merged, entry) => {
        const codigo = String(entry.codigo).trim();
        const factory = String(entry.factory).trim() as TFactory;
        return {
            ...merged,
            [codigo]: {
                ...(merged[codigo] || emptyFactories),
                [factory]: Number(entry.quantidade) || 0
            }
        };
    }, base);
}

