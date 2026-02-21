import React, { forwardRef } from 'react';
import { GroupedReading, Origin } from '../types';

interface ExportTableProps {
    groupedData: GroupedReading[];
    origin: Origin | null;
    client?: string;
    totalUnique: number;
    totalReadings: number;
    totalVolumes: number;
}

export const ExportTable = forwardRef<HTMLDivElement, ExportTableProps>(
    ({ groupedData, origin, client, totalUnique, totalReadings, totalVolumes }, ref) => {

        // Captura e formata a data/hora no momento da geração do relatório
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
                    position: 'fixed',
                    left: '-9999px',
                    width: '900px',
                    backgroundColor: '#ffffff',
                    padding: '30px',
                    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                    color: '#1f2937'
                }}
            >
                {/* Cabeçalho do Relatório */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start', // Garante que o alinhamento acompanhe o topo
                    marginBottom: '28px',
                    paddingBottom: '20px',
                    borderBottom: '2px solid #e5e7eb'
                }}>

                    {/* Bloco da Esquerda: Título, Origem e Data empilhados */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>

                        <h2 style={{ margin: 0, fontSize: '26px', color: '#111827', fontWeight: '800', whiteSpace: 'nowrap', lineHeight: '1' }}>
                            Relatório de Contagem
                        </h2>

                        {origin && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    backgroundColor: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#475569',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    gap: '6px'
                                }}>
                                    Origem: <span style={{ color: '#0f172a', fontWeight: '900' }}>{origin}</span>
                                </div>

                                {origin === 'DEVOLUÇÃO' && client && (
                                    <div style={{
                                        backgroundColor: '#eef2ff',
                                        border: '1px solid #c7d2fe',
                                        padding: '6px 14px',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        fontWeight: '700',
                                        color: '#4338ca',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        whiteSpace: 'nowrap',
                                        display: 'flex',
                                        gap: '6px'
                                    }}>
                                        Cliente: <span style={{ color: '#312e81', fontWeight: '900' }}>{client}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                            Gerado em: {dataGeracao}
                        </p>
                    </div>

                    {/* Bloco da Direita: Grupo Unificado de Métricas */}
                    <div style={{
                        display: 'flex',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        backgroundColor: '#ffffff',
                        overflow: 'hidden',
                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}>

                        {/* Seção: Itens Únicos */}
                        <div style={{ padding: '12px 24px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.05em' }}>
                                Itens Únicos
                            </div>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: '#334155', marginTop: '4px' }}>
                                {totalUnique}
                            </div>
                        </div>

                        {/* Seção: Volumes */}
                        <div style={{ padding: '12px 24px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.05em' }}>
                                Caixas/Vol.
                            </div>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: '#334155', marginTop: '4px' }}>
                                {totalVolumes}
                            </div>
                        </div>

                        {/* Seção: Total Lido */}
                        <div style={{ padding: '12px 24px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#475569', fontWeight: '800', letterSpacing: '0.05em' }}>
                                Total
                            </div>
                            <div style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', marginTop: '4px' }}>
                                {totalReadings}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Tabela */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Descrição
                            </th>
                            <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px' }}>
                                Qtde
                            </th>
                            <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', width: '140px' }}>
                                Local
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedData.map((item, index) => (
                            <tr
                                key={item.codigo || index}
                                style={{
                                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                                    borderBottom: '1px solid #e2e8f0'
                                }}
                            >
                                <td style={{ padding: '14px 12px', textAlign: 'left', fontSize: '15px', color: '#334155' }}>
                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>{item.descricao}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>{item.codigo}</div>
                                </td>
                                <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                                    {item.quantidade}
                                </td>
                                <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '14px', color: '#475569' }}>
                                    {item.local || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
);
ExportTable.displayName = 'ExportTable';