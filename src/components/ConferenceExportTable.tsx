import React, { forwardRef } from 'react';
import { getWheelPhotoUrl, hasMapping } from '../utils/photoUtils';

export interface ConferenceExportTableItem {
    id: string;
    codigo: string;
    descricao: string;
    cliente?: string;
    qtdEsperada: number;
    qtdConferida: number;
    stockCode?: string;
}

export interface UnmatchedScanExport {
    code: string;
    count: number;
    reason: string;
    timestamp: string;
}

interface ConferenceExportTableProps {
    cargaDocName: string;
    items: ConferenceExportTableItem[];
    unmatchedScans?: UnmatchedScanExport[];
    totalDoc: number;
    totalConferidos: number;
    okCount: number;
    divergentesCount: number;
    page?: number;
    totalPages?: number;
}

export const ConferenceExportTable = forwardRef<HTMLDivElement, ConferenceExportTableProps>(
    ({ cargaDocName, items, unmatchedScans = [], totalDoc, totalConferidos, okCount, divergentesCount, page, totalPages }, ref) => {

        const dataGeracao = new Date().toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return (
            <div
                ref={ref}
                style={{
                    position: 'absolute',
                    left: '-9999px',
                    top: '0',
                    width: '920px',
                    backgroundColor: '#ffffff',
                    padding: '30px',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                    color: '#1f2937',
                    height: 'auto'
                }}
            >
                {/* Cabeçalho */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '24px',
                    paddingBottom: '18px',
                    borderBottom: '2px solid #e2e8f0'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: '800', lineHeight: '1.2' }}>
                                Conferência de Carga CM
                            </h2>
                            <span style={{
                                backgroundColor: divergentesCount === 0 && totalConferidos >= totalDoc ? '#dcfce7' : '#fef3c7',
                                color: divergentesCount === 0 && totalConferidos >= totalDoc ? '#15803d' : '#b45309',
                                border: `1px solid ${divergentesCount === 0 && totalConferidos >= totalDoc ? '#86efac' : '#fde68a'}`,
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '11px',
                                fontWeight: '800',
                                textTransform: 'uppercase'
                            }}>
                                {divergentesCount === 0 && totalConferidos >= totalDoc ? '100% OK' : 'Com Divergências'}
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{
                                backgroundColor: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: '#1d4ed8'
                            }}>
                                Manifesto: <span style={{ color: '#1e40af', fontWeight: '900' }}>{cargaDocName}</span>
                            </div>
                        </div>

                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            Gerado em: {dataGeracao}
                            {totalPages && totalPages > 1 && (
                                <span style={{ marginLeft: '12px', fontWeight: 'bold' }}>
                                    Página {page} de {totalPages}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Cards de Métricas */}
                    <div style={{
                        display: 'flex',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        backgroundColor: '#ffffff',
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                    }}>
                        <div style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.05em' }}>
                                Esperado
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                                {totalDoc}
                            </div>
                        </div>

                        <div style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.05em' }}>
                                Bipado
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#2563eb', marginTop: '2px' }}>
                                {totalConferidos}
                            </div>
                        </div>

                        <div style={{ padding: '10px 18px', textAlign: 'center', borderRight: '1px solid #e2e8f0', backgroundColor: '#f0fdf4' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#166534', fontWeight: '800', letterSpacing: '0.05em' }}>
                                100% OK
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#15803d', marginTop: '2px' }}>
                                {okCount}
                            </div>
                        </div>

                        <div style={{ padding: '10px 18px', textAlign: 'center', backgroundColor: '#fff1f2' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#9f1239', fontWeight: '800', letterSpacing: '0.05em' }}>
                                Erros / Faltas
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#be123c', marginTop: '2px' }}>
                                {divergentesCount}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabela de Itens da Carga */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                            <th style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', width: '70px' }}>
                                Foto
                            </th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' }}>
                                Item / Roda Carga
                            </th>
                            <th style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', width: '120px' }}>
                                Cód. Estoque
                            </th>
                            <th style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', width: '70px' }}>
                                Doc
                            </th>
                            <th style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', width: '70px' }}>
                                Lido
                            </th>
                            <th style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', width: '110px' }}>
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => {
                            const photoUrl = getWheelPhotoUrl(item.descricao, item.stockCode || item.codigo);

                            let statusText = 'PENDENTE';
                            let statusBg = '#f1f5f9';
                            let statusColor = '#475569';

                            if (item.qtdConferida === item.qtdEsperada && item.qtdEsperada > 0) {
                                statusText = 'OK';
                                statusBg = '#dcfce7';
                                statusColor = '#15803d';
                            } else if (item.qtdConferida > item.qtdEsperada) {
                                statusText = `+${item.qtdConferida - item.qtdEsperada} EXCED.`;
                                statusBg = '#f3e8ff';
                                statusColor = '#7e22ce';
                            } else if (item.qtdConferida < item.qtdEsperada && item.qtdConferida > 0) {
                                statusText = `-${item.qtdEsperada - item.qtdConferida} INCOMP.`;
                                statusBg = '#fef3c7';
                                statusColor = '#b45309';
                            } else {
                                statusText = 'NÃO BIPADO';
                                statusBg = '#fee2e2';
                                statusColor = '#b91c1c';
                            }

                            return (
                                <tr
                                    key={item.id || index}
                                    style={{
                                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                                        borderBottom: '1px solid #e2e8f0'
                                    }}
                                >
                                    <td style={{ padding: '8px', textAlign: 'center' }}>
                                        {hasMapping(item.descricao) ? (
                                            <img
                                                src={photoUrl}
                                                alt="Foto Roda"
                                                crossOrigin="anonymous"
                                                style={{
                                                    width: '52px',
                                                    height: '52px',
                                                    objectFit: 'cover',
                                                    borderRadius: '8px',
                                                    border: '1px solid #cbd5e1'
                                                }}
                                            />
                                        ) : (
                                            <div
                                                style={{
                                                    width: '52px',
                                                    height: '52px',
                                                    backgroundColor: '#f1f5f9',
                                                    borderRadius: '8px',
                                                    border: '1px solid #cbd5e1',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    margin: '0 auto'
                                                }}
                                            >
                                                <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '700' }}>
                                                    S/ FOTO
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '10px 12px', textAlign: 'left' }}>
                                        <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a', marginBottom: '2px' }}>
                                            {item.descricao}
                                        </div>
                                        {item.cliente && (
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                Obs/Cliente: <span style={{ fontWeight: '600' }}>{item.cliente}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#3b82f6', fontFamily: 'monospace' }}>
                                        {item.stockCode || item.codigo || '-'}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: '#334155' }}>
                                        {item.qtdEsperada}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                                        {item.qtdConferida}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        <span style={{
                                            backgroundColor: statusBg,
                                            color: statusColor,
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '10px',
                                            fontWeight: '800',
                                            textTransform: 'uppercase',
                                            display: 'inline-block'
                                        }}>
                                            {statusText}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Tabela de Leituras com Erro (se houver) */}
                {unmatchedScans.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                        <div style={{
                            backgroundColor: '#be123c',
                            color: '#ffffff',
                            padding: '8px 14px',
                            borderRadius: '8px 8px 0 0',
                            fontSize: '12px',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            ⚠️ Leiturados c/ Erro / Não Previstos ({unmatchedScans.length} itens)
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #fda4af' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#fff1f2', color: '#9f1239' }}>
                                    <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Código Bipado</th>
                                    <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Motivo do Erro</th>
                                    <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: '700' }}>Vezes Lidas</th>
                                    <th style={{ padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: '700' }}>Hora</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unmatchedScans.map((err, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #ffe4e6', backgroundColor: '#ffffff' }}>
                                        <td style={{ padding: '8px', fontSize: '12px', fontWeight: '800', color: '#be123c', fontFamily: 'monospace' }}>
                                            {err.code}
                                        </td>
                                        <td style={{ padding: '8px', fontSize: '11px', color: '#881337' }}>
                                            {err.reason}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: '800', color: '#9f1239' }}>
                                            {err.count}x
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: '#9f1239' }}>
                                            {err.timestamp}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }
);

ConferenceExportTable.displayName = 'ConferenceExportTable';
