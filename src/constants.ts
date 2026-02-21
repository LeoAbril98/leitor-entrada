import { StockItem } from './types';

export const MOCK_STOCK: StockItem[] = [
  { codigo: 'K341460D440BD', descricao: 'K34 14X6,0 4X108 ET40 BLACK DIAMOND', local: 'RUA 12D' },
  { codigo: 'K341560B440BD', descricao: 'K34 15X6,0 4X100 ET40 BLACK DIAMOND', local: '28E' },
  { codigo: 'K341560D440BD', descricao: 'K34 15X6,0 4X108 ET40 BLACK DIAMOND', local: '33E' },
  { codigo: 'K541560O436HG', descricao: 'K54 15X6,0 4X100/108 ET36 HYPER GLOSS', local: 'RUA 18E' },
  { codigo: 'K541560W536HG', descricao: 'K54 15X6,0 5X100/112 ET36 HYPER GLOSS', local: '33D' },
  { codigo: 'K541870O540HG', descricao: 'K54 18X7,0 5X100/108 ET40 HYPER GLOSS', local: 'N/A' },
  { codigo: 'K561570O432BG', descricao: 'K56 15X7,0 4X100/108 ET32 BLACK GLOSS', local: 'N/A' },
  { codigo: 'K561570O432HD', descricao: 'K56 15X7,0 4X100/108 ET32 HYPER DIAMOND', local: '25D' },
  { codigo: 'K561770O438HD', descricao: 'K56 17X7,0 4X100/108 ET38 HYPER DIAMOND', local: '48D' },
  { codigo: 'K571575B432B',  descricao: 'K57 15X7,5 4X100 ET32 BLACK', local: '24E' },
  { codigo: 'K571575B432GD', descricao: 'K57 15X7,5 4X100 ET32 GRAPHITE DIAMANTAD', local: '25E' },
  { codigo: 'K571575B432HD', descricao: 'K57 15X7,5 4X100 ET32 HYPER DIAMOND', local: '25E' },
  { codigo: 'K581740F55B',   descricao: 'K58 17X4,0 5X112 ET5 BLACK', local: '43D' },
  { codigo: 'K581740L55B',   descricao: 'K58 17X4,0 5X120 ET5 BLACK', local: '67E' },
  { codigo: 'K601560B436B',  descricao: 'K60 15X6,0 4X100 ET36 BLACK F.L', local: '36E' },
  { codigo: 'K601560B436BD', descricao: 'K60 15X6,0 4X100 ET36 BLACK DIAMOND F.L', local: '28D' },
  { codigo: 'K601560D436BD', descricao: 'K60 15X6,0 4X108 ET36 BLACK DIAM F.L', local: '39E' },
];

export const ORIGINS = ['DEVOLUÇÃO', 'SC', 'RS', 'CM'] as const;