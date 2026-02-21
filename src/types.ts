
export interface StockItem {
  codigo: string;
  descricao: string;
  local: string;
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
