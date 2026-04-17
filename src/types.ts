
export interface StockItem {
  codigo: string;
  descricao: string;
  local: string;
  quantidade?: number;
  est_mk?: number;
  pend_mk?: number;
  est_moleri?: number;
  pend_moleri?: number;
  est_cm?: number;
  pend_cm?: number;
  est_olimpo?: number;
  pend_olimpo?: number;
  preco?: number;
}

export type Origin = 'DEVOLUÇÃO' | 'SC' | 'RS' | 'CM';

export interface Reading {
  id: string;
  codigo: string;
  timestamp: number;
}

export interface GroupedReading {
  codigo: string;
  descricao: string;
  local: string;
  quantidade: number;
  found: boolean;
}
