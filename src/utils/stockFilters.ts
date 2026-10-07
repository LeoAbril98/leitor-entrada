export type StockFilter = 'all' | 'sc' | 'pr' | 'none';

export function matchesStockFilter(filter: StockFilter, pr: number, sc: number | null) {
    if (filter === 'pr') return pr > 0;
    if (filter === 'sc') return sc !== null && sc > 0;
    if (filter === 'none') return pr <= 0 && sc !== null && sc <= 0;
    return true;
}
