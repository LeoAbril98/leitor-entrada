import React from 'react';

// Tabela de Padrões Code 128 (Valores 0 a 106)
// Cada elemento representa as larguras relativas de 6 barras/espaços (B1, S1, B2, S2, B3, S3)
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 = STOP)
];

const START_B = 104;
const STOP = 106;

/**
 * Codifica uma string ASCII no padrão Code 128 (Subconjunto B)
 */
export function encodeCode128B(text: string): string[] {
  // Limpar caracteres não-ASCII
  const cleanText = text.replace(/[^\x20-\x7E]/g, ' ');
  const codes: number[] = [START_B];
  
  for (let i = 0; i < cleanText.length; i++) {
    const charCode = cleanText.charCodeAt(i);
    // Na tabela Code 128 B, código = charCode - 32
    codes.push(charCode - 32);
  }

  // Calcular dígito verificador (Checksum)
  let sum = codes[0];
  for (let i = 1; i < codes.length; i++) {
    sum += codes[i] * i;
  }
  const checksum = sum % 103;
  codes.push(checksum);
  codes.push(STOP);

  // Mapear cada código para o padrão de larguras
  return codes.map(c => CODE128_PATTERNS[c] || CODE128_PATTERNS[0]);
}

interface BarcodeProps {
  value: string;
  height?: number;
  barWidth?: number;
  showText?: boolean;
  className?: string;
}

export const BarcodeDisplay: React.FC<BarcodeProps> = ({
  value,
  height = 48,
  barWidth = 1.8,
  showText = true,
  className = ""
}) => {
  if (!value) return null;

  const patterns = encodeCode128B(value.trim() || "0000");

  // Converter padrões em barras pretas e brancas
  let totalWidth = 0;
  const elements: { isBar: boolean; width: number; x: number }[] = [];

  // Margem inicial (Quiet Zone)
  totalWidth += barWidth * 10;

  patterns.forEach((pattern) => {
    let isBar = true;
    for (let i = 0; i < pattern.length; i++) {
      const width = parseInt(pattern[i], 10) * barWidth;
      elements.push({ isBar, width, x: totalWidth });
      totalWidth += width;
      isBar = !isBar;
    }
  });

  // Margem final (Quiet Zone)
  totalWidth += barWidth * 10;

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <svg
        width={totalWidth}
        height={height}
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="max-w-full h-auto"
        shapeRendering="crispEdges"
      >
        <rect width={totalWidth} height={height} fill="#ffffff" />
        {elements.map((el, idx) =>
          el.isBar ? (
            <rect
              key={idx}
              x={el.x}
              y={0}
              width={el.width}
              height={height}
              fill="#000000"
            />
          ) : null
        )}
      </svg>
      {showText && (
        <span className="font-mono text-[10.5px] font-bold tracking-wider text-slate-900 mt-0.5 whitespace-nowrap shrink-0 select-none">
          {value}
        </span>
      )}
    </div>
  );
};
