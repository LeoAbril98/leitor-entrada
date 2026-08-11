import React, { useMemo, useState } from "react";
import { 
  Search, 
  Check, 
  AlertTriangle, 
  AlertCircle, 
  Pencil, 
  Trash2, 
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy
} from "lucide-react";

export interface LinkedItemLink {
  link: string;
  desc: string;
}

export interface LinkedItem {
  code: string;
  links: LinkedItemLink[];
  fixedCode?: string;
}

interface LinkedItemsTableProps {
  data: LinkedItem[];
  onEdit?: (item: LinkedItem) => void;
  onDelete?: (item: LinkedItem) => void;
  onDeleteBatch?: (items: LinkedItem[]) => void;
}

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "same", label: "Cód. Idênticos" },
  { key: "ok", label: "Vinculado" },
  { key: "dup", label: "Duplicado" },
  { key: "miss", label: "Não encontrado" },
] as const;

type FilterKey = typeof FILTERS[number]["key"];

function isSame(item: LinkedItem): boolean {
  const code = item.code.trim().toUpperCase();
  if (item.fixedCode) {
    const targets = item.fixedCode.split(',').map((s) => s.trim().toUpperCase());
    if (targets.includes(code)) return true;
  }
  return item.links.some((l) => l.link.trim().toUpperCase() === code);
}

function statusOf(item: LinkedItem): "ok" | "dup" | "miss" {
  if (item.links.length === 0) return "miss";
  if (item.links.length > 1) return "dup";
  return "ok";
}

function StatusBadge({ status, count }: { status: "ok" | "dup" | "miss"; count: number }) {
  const styles = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    dup: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    miss: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  };
  const icon = {
    ok: <Check size={13} />,
    dup: <AlertCircle size={13} />,
    miss: <AlertTriangle size={13} />,
  };
  const label = {
    ok: "Vinculado",
    dup: `Vinculado a ${count} itens`,
    miss: "Não encontrado",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {icon[status]}
      {label[status]}
    </span>
  );
}

function SameBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
      <Copy size={12} />
      Código Idêntico
    </span>
  );
}

const getPageNumbers = (current: number, total: number) => {
  const pages: (number | string)[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push("...");
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push("...");
    pages.push(total);
  }
  return pages;
};

export default function LinkedItemsTable({
  data = [],
  onEdit = () => {},
  onDelete = () => {},
  onDeleteBatch,
}: LinkedItemsTableProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c = { all: data.length, same: 0, ok: 0, dup: 0, miss: 0 };
    data.forEach((item) => {
      c[statusOf(item)] += 1;
      if (isSame(item)) {
        c.same += 1;
      }
    });
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((item) => {
      const status = statusOf(item);
      const same = isSame(item);
      const matchesFilter =
        filter === "all" ||
        (filter === "same" ? same : filter === status);
      const matchesQuery =
        !q ||
        item.code.toLowerCase().includes(q) ||
        (item.fixedCode && item.fixedCode.toLowerCase().includes(q)) ||
        item.links.some((l) => l.link.toLowerCase().includes(q) || l.desc.toLowerCase().includes(q));
      return matchesFilter && matchesQuery;
    });
  }, [data, query, filter]);

  // Reset page when filter, query or pageSize changes
  React.useEffect(() => {
    setPage(1);
  }, [query, filter, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selectedCodes.has(item.code));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const next = new Set(selectedCodes);
      filtered.forEach((item) => next.delete(item.code));
      setSelectedCodes(next);
    } else {
      const next = new Set(selectedCodes);
      filtered.forEach((item) => next.add(item.code));
      setSelectedCodes(next);
    }
  };

  const toggleSelectRow = (code: string) => {
    const next = new Set(selectedCodes);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setSelectedCodes(next);
  };

  const handleDeleteSelected = () => {
    const selectedItems = data.filter((item) => selectedCodes.has(item.code));
    if (selectedItems.length === 0) return;

    if (window.confirm(`Excluir os ${selectedItems.length} vínculo(s) selecionados?`)) {
      if (onDeleteBatch) {
        onDeleteBatch(selectedItems);
      } else {
        selectedItems.forEach((item) => onDelete(item));
      }
      setSelectedCodes(new Set());
    }
  };

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col justify-between gap-4">
      {/* Search & Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código ou descrição..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "border-slate-400 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive
                      ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                  }`}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filter === "same" && (
        <div className="p-3 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/30 text-xs text-sky-800 dark:text-sky-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Copy size={15} className="text-sky-600 dark:text-sky-400 shrink-0" />
            <span>
              Exibindo <strong>{counts.same}</strong> vínculo(s) onde o código da planilha é <strong>exatamente igual</strong> ao código vinculado na base.
            </span>
          </div>
        </div>
      )}

      {selectedCodes.size > 0 && (
        <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/90 dark:bg-indigo-950/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-indigo-950 dark:text-indigo-100">
            <span>
              {selectedCodes.size} vínculo(s) selecionado(s)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedCodes(new Set())}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Limpar Seleção
            </button>
            <button
              onClick={handleDeleteSelected}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Trash2 size={14} />
              Excluir Selecionados ({selectedCodes.size})
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Scrollable Table Container */}
      <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative custom-scrollbar">
        <table className="w-full border-collapse text-sm text-left">
          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 shadow-xs">
            <tr>
              <th className="w-10 px-3 py-3 text-center bg-slate-50 dark:bg-slate-950">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                  title="Selecionar todos os visíveis"
                />
              </th>
              <th className="px-4 py-3 bg-slate-50 dark:bg-slate-950">Código da planilha</th>
              <th className="px-4 py-3 bg-slate-50 dark:bg-slate-950">Vinculado a</th>
              <th className="px-4 py-3 bg-slate-50 dark:bg-slate-950">Status</th>
              <th className="px-4 py-3 text-right bg-slate-50 dark:bg-slate-950">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedData.map((item) => {
              const status = statusOf(item);
              const same = isSame(item);
              const isSelected = selectedCodes.has(item.code);
              return (
                <tr
                  key={item.code}
                  className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                    isSelected
                      ? "bg-indigo-50/50 dark:bg-indigo-950/30"
                      : same
                      ? "bg-sky-50/30 dark:bg-sky-950/20"
                      : status === "dup"
                      ? "bg-amber-50/40 dark:bg-amber-950/20"
                      : ""
                  }`}
                >
                  <td className="w-10 px-3 py-3 align-top text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectRow(item.code)}
                      className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                    />
                  </td>
                  <td className="px-4 py-3 align-top font-mono font-bold text-slate-800 dark:text-slate-200">
                    <span className="inline-block bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                      {item.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {item.links.length === 0 ? (
                      <div className="space-y-1">
                        {item.fixedCode && (
                          <div className="flex items-center gap-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.fixedCode}</span>
                          </div>
                        )}
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60">
                          <AlertTriangle size={13} />
                          Item não encontrado na base
                        </span>
                      </div>
                    ) : (
                      item.links.map((l, idx) => (
                        <div
                          key={l.link + idx}
                          className={
                            idx > 0
                              ? "mt-2 border-t border-slate-100 dark:border-slate-800 pt-2"
                              : undefined
                          }
                        >
                          <div className="flex items-center gap-1.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                            <ArrowRight className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-500" />
                            <span className="bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/50">
                              {l.link}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[300px]" title={l.desc}>
                            {l.desc}
                          </div>
                        </div>
                      ))
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-1.5 items-start">
                      <StatusBadge status={status} count={item.links.length} />
                      {same && <SameBadge />}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        aria-label="Editar"
                        title="Editar Vínculo"
                        onClick={() => onEdit(item)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        aria-label="Excluir"
                        title="Excluir Vínculo"
                        onClick={() => onDelete(item)}
                        className="p-1.5 text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm font-medium">
            Nenhum item encontrado para essa busca.
          </p>
        )}
      </div>

      {/* Pagination & Count footer */}
      {filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 text-xs text-slate-500 dark:text-slate-400 font-medium">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Exibindo {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} a{" "}
              {Math.min(page * pageSize, filtered.length)} de {filtered.length} vínculos
            </span>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-500 text-[11px]">Por página:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                title="Primeira Página"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                title="Página Anterior"
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-0.5"
              >
                <ChevronLeft size={14} />
                <span className="hidden sm:inline">Anterior</span>
              </button>

              <div className="flex items-center gap-1 px-1">
                {getPageNumbers(page, totalPages).map((p, idx) =>
                  typeof p === "number" ? (
                    <button
                      key={idx}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                        page === p
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {p}
                    </button>
                  ) : (
                    <span key={idx} className="px-1 text-slate-400">
                      ...
                    </span>
                  )
                )}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                title="Próxima Página"
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-0.5"
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                title="Última Página"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
