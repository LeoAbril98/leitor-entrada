export interface WheelSpecOverride {
    id: string; // ex: "R06-15-4X100" ou "K57-4X100"
    model: string; // ex: "R06"
    aro?: string; // ex: "15", "17", "18"
    pcd: string; // ex: "4X100"
    type: 'ANEL' | 'CUBO'; // 'ANEL' (Com Anel Centralizador) ou 'CUBO' (Cubo Específico)
    mm: string; // ex: "57.1"
    ringColor?: string; // ex: "#f97316"
}

/**
 * Mapeamento oficial de cores por especificação de MM (e Tipo):
 * - 57.1 mm -> Laranja (#f97316)
 * - 56.6 mm / 56.5 mm / 56.1 mm -> Azul (#2563eb)
 * - 58.1 mm -> Amarelo (#eab308)
 * - 64.1 mm -> Preto (#0f172a / #475569)
 * - 106.1 mm / 100.1 mm / 93.1 mm -> Cinza (#64748b)
 * - 63.4 mm / 63.5 mm -> Verde (#16a34a)
 * - 65.1 mm -> Branco (#f8fafc)
 * - 54.1 mm -> Vermelho (#ef4444)
 * - 67.1 mm -> Azul (#3b82f6)
 * - 66.6 mm -> Violeta (#8b5cf6)
 */
export function getRingColorBySpecs(mm: string, type?: 'ANEL' | 'CUBO'): string {
    const clean = (mm || '').replace(',', '.').replace(/[^0-9\.]/g, '').trim();
    if (clean === '57.1') return '#f97316'; // Laranja
    if (clean === '56.6' || clean === '56.5' || clean === '56.1') return '#2563eb'; // Azul
    if (clean === '58.1') return '#eab308'; // Amarelo
    if (clean === '64.1') return type === 'CUBO' ? '#475569' : '#0f172a'; // Preto Claro (Cubo) / Preto (Anel)
    if (clean === '106.1' || clean === '100.1' || clean === '93.1') return '#64748b'; // Cinza
    if (clean === '63.4' || clean === '63.5') return '#16a34a'; // Verde
    if (clean === '65.1') return '#f8fafc'; // Branco
    if (clean === '54.1') return '#ef4444'; // Vermelho
    if (clean === '67.1') return '#3b82f6'; // Azul Celeste
    if (clean === '60.1') return '#84cc16'; // Lime
    if (clean === '66.1' || clean === '66.6') return '#8b5cf6'; // Violeta
    if (clean === '72.6') return '#a855f7'; // Roxo
    if (clean === '74.1') return '#2563eb'; // Azul
    if (clean === '80.9') return '#d97706'; // Âmbar
    return type === 'CUBO' ? '#ea580c' : '#f97316';
}

export const DEFAULT_WHEEL_SPEC_OVERRIDES: WheelSpecOverride[] = [
    // ==========================================
    // LINHA R
    // ==========================================
    // R06 / RR06: Anel 57.1 MM (Aro 15) / Cubo Específico 57.1 MM (Aro 17)
    { id: 'R06-15-4X100', model: 'R06', aro: '15', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'R06-17-4X100', model: 'R06', aro: '17', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'RR06-15-4X100', model: 'RR06', aro: '15', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'RR06-17-4X100', model: 'RR06', aro: '17', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },

    { id: 'R7-4X100', model: 'R7', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'R10-4X100', model: 'R10', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R14-4X98', model: 'R14', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'R15-4X100', model: 'R15', pcd: '4X100', type: 'CUBO', mm: '56.6', ringColor: '#2563eb' },
    { id: 'R16-4X100', model: 'R16', pcd: '4X100', type: 'CUBO', mm: '56.6', ringColor: '#2563eb' },
    { id: 'R17-4X98', model: 'R17', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'R18-4X98', model: 'R18', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'R20-4X98', model: 'R20', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'R23-4X98', model: 'R23', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'R26-4X100', model: 'R26', pcd: '4X100', type: 'CUBO', mm: '56.6', ringColor: '#2563eb' },
    { id: 'R29-4X100', model: 'R29', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'R29-5X114', model: 'R29', pcd: '5X114', type: 'ANEL', mm: '64.1', ringColor: '#0f172a' },
    { id: 'R32-6X139', model: 'R32', pcd: '6X139', type: 'CUBO', mm: '106.1', ringColor: '#64748b' },
    { id: 'R37-6X139', model: 'R37', pcd: '6X139', type: 'CUBO', mm: '106.1', ringColor: '#64748b' },
    { id: 'R39-4X98', model: 'R39', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'R39-4X100', model: 'R39', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'R39-4X108', model: 'R39', pcd: '4X108', type: 'ANEL', mm: '63.4', ringColor: '#16a34a' },
    { id: 'R41-4X108', model: 'R41', pcd: '4X108', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'R42-4X100', model: 'R42', pcd: '4X100', type: 'CUBO', mm: '56.6', ringColor: '#2563eb' },
    { id: 'R43-4X100', model: 'R43', pcd: '4X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },
    { id: 'R45-4X100', model: 'R45', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'R45-5X100', model: 'R45', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'R46-5X100', model: 'R46', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'R46-5X112', model: 'R46', pcd: '5X112', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'R50-4X100', model: 'R50', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R51-4X100', model: 'R51', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R53-6X139', model: 'R53', pcd: '6X139', type: 'CUBO', mm: '106.1', ringColor: '#64748b' },
    { id: 'R54-4X100', model: 'R54', pcd: '4X100', type: 'ANEL', mm: '56.6', ringColor: '#2563eb' },
    { id: 'R54-5X100', model: 'R54', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'R54-5X105', model: 'R54', pcd: '5X105', type: 'ANEL', mm: '56.6', ringColor: '#2563eb' },
    { id: 'R54-5X114', model: 'R54', pcd: '5X114', type: 'ANEL', mm: '64.1', ringColor: '#0f172a' },
    { id: 'R54-5X120', model: 'R54', pcd: '5X120', type: 'CUBO', mm: '72.6', ringColor: '#a855f7' },
    { id: 'R56-5X120', model: 'R56', pcd: '5X120', type: 'CUBO', mm: '72.6', ringColor: '#a855f7' },
    { id: 'R60-4X98', model: 'R60', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'R62-4X108', model: 'R62', pcd: '4X108', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'R63-4X100', model: 'R63', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R64-5X100', model: 'R64', pcd: '5X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },
    { id: 'R65-4X100', model: 'R65', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R65-5X100', model: 'R65', pcd: '5X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R66-4X108', model: 'R66', pcd: '4X108', type: 'CUBO', mm: '63.4', ringColor: '#16a34a' },
    { id: 'R72-6X139', model: 'R72', pcd: '6X139', type: 'CUBO', mm: '106.1', ringColor: '#64748b' },
    { id: 'R73-4X98', model: 'R73', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'R73-5X110', model: 'R73', pcd: '5X110', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'R74-4X100', model: 'R74', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R75-4X100', model: 'R75', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R76-5X110', model: 'R76', pcd: '5X110', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'R78-4X100', model: 'R78', pcd: '4X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },
    { id: 'R79-6X139', model: 'R79', pcd: '6X139', type: 'CUBO', mm: '100.1', ringColor: '#64748b' },
    { id: 'R80-4X100', model: 'R80', pcd: '4X100', type: 'CUBO', mm: '56.6', ringColor: '#2563eb' },
    { id: 'R81-4X100', model: 'R81', pcd: '4X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },
    { id: 'R82-4X100', model: 'R82', pcd: '4X100', type: 'CUBO', mm: '56.6', ringColor: '#2563eb' },
    { id: 'R83-4X100', model: 'R83', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R84-4X130', model: 'R84', pcd: '4X130', type: 'CUBO', mm: '80.9', ringColor: '#d97706' },
    { id: 'R84-5X112', model: 'R84', pcd: '5X112', type: 'CUBO', mm: '66.1', ringColor: '#8b5cf6' },
    { id: 'R87-5X120', model: 'R87', pcd: '5X120', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'R88-4X98', model: 'R88', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'R91-4X98', model: 'R91', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'R92-4X98', model: 'R92', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'R89-5X100', model: 'R89', pcd: '5X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },
    { id: 'R93-4X100', model: 'R93', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R93-5X100', model: 'R93', pcd: '5X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R93-5X112', model: 'R93', pcd: '5X112', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R94-4X100', model: 'R94', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R94-5X100', model: 'R94', pcd: '5X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R94-5X112', model: 'R94', pcd: '5X112', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'R96-4X100', model: 'R96', pcd: '4X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },
    { id: 'R97-4X100', model: 'R97', pcd: '4X100', type: 'ANEL', mm: '60.1', ringColor: '#84cc16' },
    { id: 'R99-4X100', model: 'R99', pcd: '4X100', type: 'CUBO', mm: '56.1', ringColor: '#2563eb' },

    // ==========================================
    // LINHA K
    // ==========================================
    { id: 'K27-4X98', model: 'K27', pcd: '4X98', type: 'ANEL', mm: '58.1', ringColor: '#eab308' },
    { id: 'K27-4X100', model: 'K27', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K27-4X108', model: 'K27', pcd: '4X108', type: 'ANEL', mm: '63.4', ringColor: '#16a34a' },

    { id: 'K34-4X100', model: 'K34', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K34-4X108', model: 'K34', pcd: '4X108', type: 'ANEL', mm: '63.4', ringColor: '#16a34a' },

    { id: 'K54-4X100', model: 'K54', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K54-4X108', model: 'K54', pcd: '4X108', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K54-5X100', model: 'K54', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K54-5X112', model: 'K54', pcd: '5X112', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },

    { id: 'K56-4X100', model: 'K56', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K56-4X108', model: 'K56', pcd: '4X108', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },

    { id: 'K57-4X100', model: 'K57', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K57-4X108', model: 'K57', pcd: '4X108', type: 'ANEL', mm: '63.4', ringColor: '#16a34a' },

    { id: 'K58-5X112', model: 'K58', pcd: '5X112', type: 'CUBO', mm: '66.6', ringColor: '#8b5cf6' },
    { id: 'K58-5X120', model: 'K58', pcd: '5X120', type: 'CUBO', mm: '72.6', ringColor: '#a855f7' },

    { id: 'K60-4X100', model: 'K60', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K60-4X108', model: 'K60', pcd: '4X108', type: 'ANEL', mm: '63.4', ringColor: '#16a34a' },

    { id: 'K63-4X100', model: 'K63', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K63-4X108', model: 'K63', pcd: '4X108', type: 'ANEL', mm: '63.5', ringColor: '#16a34a' },
    { id: 'K63-5X100', model: 'K63', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K63-5X108', model: 'K63', pcd: '5X108', type: 'ANEL', mm: '63.5', ringColor: '#16a34a' },
    { id: 'K63-5X112', model: 'K63', pcd: '5X112', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K63-5X114', model: 'K63', pcd: '5X114', type: 'ANEL', mm: '64.1', ringColor: '#0f172a' },

    { id: 'K64-4X100', model: 'K64', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K64-4X108', model: 'K64', pcd: '4X108', type: 'ANEL', mm: '63.5', ringColor: '#16a34a' },

    { id: 'K67-4X100', model: 'K67', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K67-4X108', model: 'K67', pcd: '4X108', type: 'ANEL', mm: '63.5', ringColor: '#16a34a' },
    { id: 'K67-5X100', model: 'K67', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K67-5X105', model: 'K67', pcd: '5X105', type: 'ANEL', mm: '56.5', ringColor: '#2563eb' },
    { id: 'K67-5X114', model: 'K67', pcd: '5X114', type: 'ANEL', mm: '64.1', ringColor: '#0f172a' },
    { id: 'K67-5X120', model: 'K67', pcd: '5X120', type: 'CUBO', mm: '72.6', ringColor: '#a855f7' },

    { id: 'K71-4X98', model: 'K71', pcd: '4X98', type: 'ANEL', mm: '58.1', ringColor: '#eab308' },
    { id: 'K71-4X100', model: 'K71', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K71-4X108', model: 'K71', pcd: '4X108', type: 'ANEL', mm: '63.5', ringColor: '#16a34a' },
    { id: 'K71-5X100', model: 'K71', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K71-5X105', model: 'K71', pcd: '5X105', type: 'ANEL', mm: '56.5', ringColor: '#2563eb' },
    { id: 'K71-5X112', model: 'K71', pcd: '5X112', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },

    { id: 'K72-4X100', model: 'K72', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K72-5X100', model: 'K72', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K72-5X112', model: 'K72', pcd: '5X112', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },

    { id: 'K73-4X100', model: 'K73', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K73-4X108', model: 'K73', pcd: '4X108', type: 'ANEL', mm: '63.5', ringColor: '#16a34a' },
    { id: 'K73-5X100', model: 'K73', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K73-5X105', model: 'K73', pcd: '5X105', type: 'ANEL', mm: '56.5', ringColor: '#2563eb' },
    { id: 'K73-5X108', model: 'K73', pcd: '5X108', type: 'ANEL', mm: '63.5', ringColor: '#16a34a' },
    { id: 'K73-5X110', model: 'K73', pcd: '5X110', type: 'ANEL', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'K73-5X112', model: 'K73', pcd: '5X112', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K73-5X114', model: 'K73', pcd: '5X114', type: 'ANEL', mm: '64.1', ringColor: '#0f172a' },

    { id: 'K74-5X100', model: 'K74', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K74-5X112', model: 'K74', pcd: '5X112', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },

    { id: 'K75-5X105', model: 'K75', pcd: '5X105', type: 'ANEL', mm: '56.5', ringColor: '#2563eb' },
    { id: 'K75-5X108', model: 'K75', pcd: '5X108', type: 'ANEL', mm: '63.5', ringColor: '#16a34a' },
    { id: 'K75-5X110', model: 'K75', pcd: '5X110', type: 'ANEL', mm: '65.1', ringColor: '#f8fafc' },

    { id: 'K76-4X98', model: 'K76', pcd: '4X98', type: 'ANEL', mm: '58.1', ringColor: '#eab308' },
    { id: 'K76-4X100', model: 'K76', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'K76-4X108', model: 'K76', pcd: '4X108', type: 'ANEL', mm: '63.4', ringColor: '#16a34a' },

    // ==========================================
    // LINHA S
    // ==========================================
    { id: 'S02-5X110', model: 'S02', pcd: '5X110', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'S03-4X98', model: 'S03', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'S04-4X100', model: 'S04', pcd: '4X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },
    { id: 'S05-4X108', model: 'S05', pcd: '4X108', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'S07-5X120', model: 'S07', pcd: '5X120', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'S08-5X114', model: 'S08', pcd: '5X114', type: 'CUBO', mm: '67.1', ringColor: '#3b82f6' },
    { id: 'S10-4X108', model: 'S10', pcd: '4X108', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'S11-6X139', model: 'S11', pcd: '6X139', type: 'CUBO', mm: '106.1', ringColor: '#64748b' },
    { id: 'S12-5X114', model: 'S12', pcd: '5X114', type: 'CUBO', mm: '66.1', ringColor: '#8b5cf6' },
    { id: 'S13-4X100', model: 'S13', pcd: '4X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },
    { id: 'S14-4X108', model: 'S14', pcd: '4X108', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'S15-4X98', model: 'S15', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'S16-5X114', model: 'S16', pcd: '5X114', type: 'CUBO', mm: '67.1', ringColor: '#3b82f6' },
    { id: 'S18-4X100', model: 'S18', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'S18-5X100', model: 'S18', pcd: '5X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'S18-5X112', model: 'S18', pcd: '5X112', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'S20-4X100', model: 'S20', pcd: '4X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },
    { id: 'S21-4X100', model: 'S21', pcd: '4X100', type: 'ANEL', mm: '56.5', ringColor: '#2563eb' },
    { id: 'S22-5X100', model: 'S22', pcd: '5X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },

    { id: 'S23-4X100', model: 'S23', pcd: '4X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },
    { id: 'S23-4X108', model: 'S23', pcd: '4X108', type: 'ANEL', mm: '63.4', ringColor: '#16a34a' },
    { id: 'S23-5X100', model: 'S23', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'S23-5X105', model: 'S23', pcd: '5X105', type: 'ANEL', mm: '56.6', ringColor: '#2563eb' },
    { id: 'S23-5X114', model: 'S23', pcd: '5X114', type: 'ANEL', mm: '64.1', ringColor: '#0f172a' },

    { id: 'S24-4X100', model: 'S24', pcd: '4X100', type: 'ANEL', mm: '56.5', ringColor: '#2563eb' },
    { id: 'S24-5X105', model: 'S24', pcd: '5X105', type: 'CUBO', mm: '56.5', ringColor: '#2563eb' },
    { id: 'S24-5X110', model: 'S24', pcd: '5X110', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },

    { id: 'S25-5X100', model: 'S25', pcd: '5X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'S27-4X98', model: 'S27', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'S29-4X98', model: 'S29', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'S30-6X139', model: 'S30', pcd: '6X139', type: 'CUBO', mm: '100.1', ringColor: '#64748b' },
    { id: 'S31-6X139', model: 'S31', pcd: '6X139', type: 'CUBO', mm: '106.1', ringColor: '#64748b' },
    { id: 'S32-6X139', model: 'S32', pcd: '6X139', type: 'CUBO', mm: '106.1', ringColor: '#64748b' },
    { id: 'S33-4X100', model: 'S33', pcd: '4X100', type: 'ANEL', mm: '60.1', ringColor: '#84cc16' },
    { id: 'S34-5X110', model: 'S34', pcd: '5X110', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'S35-4X100', model: 'S35', pcd: '4X100', type: 'ANEL', mm: '56.5', ringColor: '#2563eb' },
    { id: 'S36-6X139', model: 'S36', pcd: '6X139', type: 'CUBO', mm: '67.1', ringColor: '#3b82f6' },
    { id: 'S37-5X114', model: 'S37', pcd: '5X114', type: 'CUBO', mm: '67.1', ringColor: '#3b82f6' },
    { id: 'S38-4X108', model: 'S38', pcd: '4X108', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'S39-6X139', model: 'S39', pcd: '6X139', type: 'CUBO', mm: '106.1', ringColor: '#64748b' },
    { id: 'S40-4X100', model: 'S40', pcd: '4X100', type: 'ANEL', mm: '56.5', ringColor: '#2563eb' },
    { id: 'S41-4X98', model: 'S41', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'S41-4X100', model: 'S41', pcd: '4X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },
    { id: 'S42-4X98', model: 'S42', pcd: '4X98', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
    { id: 'S42-4X100', model: 'S42', pcd: '4X100', type: 'CUBO', mm: '54.1', ringColor: '#ef4444' },
    { id: 'S43-4X108', model: 'S43', pcd: '4X108', type: 'CUBO', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'S44-4X100', model: 'S44', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'S44-5X100', model: 'S44', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },

    { id: 'S45-4X98', model: 'S45', pcd: '4X98', type: 'ANEL', mm: '58.1', ringColor: '#eab308' },
    { id: 'S45-5X98', model: 'S45', pcd: '5X98', type: 'ANEL', mm: '58.1', ringColor: '#eab308' },
    { id: 'S45-5X105', model: 'S45', pcd: '5X105', type: 'ANEL', mm: '56.5', ringColor: '#2563eb' },
    { id: 'S45-5X114', model: 'S45', pcd: '5X114', type: 'ANEL', mm: '64.1', ringColor: '#0f172a' },

    { id: 'S46-4X100', model: 'S46', pcd: '4X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'S46-5X100', model: 'S46', pcd: '5X100', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },
    { id: 'S46-5X112', model: 'S46', pcd: '5X112', type: 'CUBO', mm: '57.1', ringColor: '#f97316' },

    { id: 'S47-4X100', model: 'S47', pcd: '4X100', type: 'ANEL', mm: '56.5', ringColor: '#2563eb' },
    { id: 'S47-5X105', model: 'S47', pcd: '5X105', type: 'CUBO', mm: '56.5', ringColor: '#2563eb' },
    { id: 'S47-5X114', model: 'S47', pcd: '5X114', type: 'CUBO', mm: '64.1', ringColor: '#475569' },

    { id: 'S48-4X100', model: 'S48', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'S48-5X100', model: 'S48', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'S48-5X105', model: 'S48', pcd: '5X105', type: 'ANEL', mm: '56.5', ringColor: '#2563eb' },
    { id: 'S48-5X108', model: 'S48', pcd: '5X108', type: 'ANEL', mm: '63.4', ringColor: '#16a34a' },
    { id: 'S48-5X110', model: 'S48', pcd: '5X110', type: 'ANEL', mm: '65.1', ringColor: '#f8fafc' },
    { id: 'S48-5X114', model: 'S48', pcd: '5X114', type: 'ANEL', mm: '64.1', ringColor: '#0f172a' },

    { id: 'S49-4X100', model: 'S49', pcd: '4X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'S49-5X100', model: 'S49', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'S49-5X112', model: 'S49', pcd: '5X112', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'S49-5X114', model: 'S49', pcd: '5X114', type: 'ANEL', mm: '64.1', ringColor: '#0f172a' },

    { id: 'S50-5X100', model: 'S50', pcd: '5X100', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'S50-5X105', model: 'S50', pcd: '5X105', type: 'ANEL', mm: '56.5', ringColor: '#2563eb' },
    { id: 'S50-5X112', model: 'S50', pcd: '5X112', type: 'ANEL', mm: '57.1', ringColor: '#f97316' },
    { id: 'S50-5X114', model: 'S50', pcd: '5X114', type: 'ANEL', mm: '64.1', ringColor: '#0f172a' },
    { id: 'S50-6X139', model: 'S50', pcd: '6X139', type: 'CUBO', mm: '93.1', ringColor: '#64748b' },

    { id: 'S51-6X114', model: 'S51', pcd: '6X114', type: 'CUBO', mm: '58.1', ringColor: '#eab308' },
];

const STORAGE_KEY = 'leitor_wheel_specs_mappings_v5';

export function getWheelSpecOverrides(): WheelSpecOverride[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (err) {
        console.error('Erro ao ler mapeamentos de cubos e anéis:', err);
    }
    return DEFAULT_WHEEL_SPEC_OVERRIDES;
}

export function saveWheelSpecOverride(override: Omit<WheelSpecOverride, 'id'> & { id?: string }): WheelSpecOverride[] {
    const current = getWheelSpecOverrides();
    const modelClean = override.model.trim().toUpperCase();
    const pcdClean = override.pcd.trim().toUpperCase();
    const aroClean = override.aro ? override.aro.trim().toUpperCase() : '';
    const id = override.id || `${modelClean}${aroClean ? `-${aroClean}` : ''}-${pcdClean}`;

    const newOverride: WheelSpecOverride = {
        id,
        model: modelClean,
        aro: aroClean || undefined,
        pcd: pcdClean,
        type: override.type,
        mm: override.mm.trim(),
        ringColor: override.ringColor || getRingColorBySpecs(override.mm, override.type)
    };

    const existingIndex = current.findIndex(item => item.id === id);
    if (existingIndex >= 0) {
        current[existingIndex] = newOverride;
    } else {
        current.unshift(newOverride);
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (err) {
        console.error('Erro ao salvar mapeamento de cubo/anel:', err);
    }

    return current;
}

export function deleteWheelSpecOverride(id: string): WheelSpecOverride[] {
    const current = getWheelSpecOverrides().filter(item => item.id !== id);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (err) {
        console.error('Erro ao deletar mapeamento de cubo/anel:', err);
    }
    return current;
}

export function resetWheelSpecOverrides(): WheelSpecOverride[] {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WHEEL_SPEC_OVERRIDES));
    } catch (err) {
        console.error('Erro ao restaurar padrões de cubos e anéis:', err);
    }
    return DEFAULT_WHEEL_SPEC_OVERRIDES;
}

export function findWheelSpecOverride(modelCode: string, pcd: string, aro?: string): WheelSpecOverride | undefined {
    const list = getWheelSpecOverrides();
    const modelUpper = (modelCode || '').toUpperCase().trim();
    const pcdUpper = (pcd || '').toUpperCase().trim();
    const aroUpper = (aro || '').toUpperCase().trim();

    if (!modelUpper && !pcdUpper) return undefined;

    // 1. Tentar encontrar combinação exata Modelo + Aro + PCD
    if (aroUpper && pcdUpper) {
        let match = list.find(item => item.model === modelUpper && item.aro === aroUpper && item.pcd === pcdUpper);
        if (match) return match;

        match = list.find(item => modelUpper.startsWith(item.model) && item.aro === aroUpper && item.pcd === pcdUpper);
        if (match) return match;
    }

    // 2. Tentar encontrar combinação exata Modelo + PCD
    let match = list.find(item => item.model === modelUpper && item.pcd === pcdUpper);
    if (match) return match;

    // 3. Tentar por prefixo do modelo + PCD exato
    if (pcdUpper) {
        match = list.find(item => modelUpper.startsWith(item.model) && item.pcd === pcdUpper);
        if (match) return match;
    }

    // 4. Tentar encontrar por modelo (qualquer PCD)
    match = list.find(item => item.model === modelUpper);
    if (match) return match;

    return undefined;
}
