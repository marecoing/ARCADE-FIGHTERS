'use client';

import React from 'react';
import { CharacterStats as CharacterStatsType } from '@/lib/game/types';

export interface CharacterStatsProps {
  stats: CharacterStatsType;
  side?: 'p1' | 'p2';
  accentHex?: string;
}

const STAT_LABELS: Array<{ key: keyof CharacterStatsType; label: string }> = [
  { key: 'strength', label: 'FUERZA' },
  { key: 'speed', label: 'VELOCIDAD' },
  { key: 'defense', label: 'DEFENSA' },
  { key: 'reach', label: 'ALCANCE' },
  { key: 'technique', label: 'TÉCNICA' },
];

/**
 * CAPA D (Inferior Izquierda): Cuadro Metálico de Estadísticas Dinámicas
 * Renders the 5 attribute rows (FUERZA, VELOCIDAD, DEFENSA, ALCANCE, TÉCNICA)
 * with 10 slanted golden-orange arcade segments and tabular numeric readouts (1..10).
 */
export function CharacterStats({
  stats,
  side = 'p1',
}: CharacterStatsProps) {
  return (
    <div
      className="w-full h-full flex flex-col justify-between px-[2.2%] py-[1.2%] select-none"
      data-testid={`character-stats-${side}`}
    >
      {STAT_LABELS.map(({ key, label }) => {
        const value = Math.max(1, Math.min(10, Math.round(stats[key])));
        return (
          <div
            key={key}
            data-stat-key={key}
            data-stat-value={value}
            className="flex items-center justify-between gap-[2.5%] h-[19%]"
          >
            {/* Left Bold Italic Attribute Label */}
            <span
              className="w-[34%] font-arcade font-black italic text-white tracking-wider uppercase leading-none truncate"
              style={{
                fontSize: 'clamp(9px, 1.05vw, 17px)',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.95)',
              }}
            >
              {label}
            </span>

            {/* Center 10-Segment Slanted Golden-Orange Arcade Meter */}
            <div className="flex-1 h-[68%] grid grid-cols-10 gap-[2px] bg-[#07061b] border border-indigo-400/50 px-[3px] py-[2px] -skew-x-12 shadow-[inset_0_1px_5px_rgba(0,0,0,0.95)]">
              {Array.from({ length: 10 }).map((_, segIdx) => {
                const filled = segIdx < value;
                return (
                  <div
                    key={segIdx}
                    className={`h-full transition-all duration-150 ${
                      filled
                        ? 'bg-gradient-to-b from-yellow-200 via-amber-400 to-orange-600 shadow-[0_0_6px_rgba(250,204,21,0.75)]'
                        : 'bg-[#2a2456]/75'
                    }`}
                  />
                );
              })}
            </div>

            {/* Right Bold Italic Numeric Value (1..10) */}
            <span
              className="w-[9%] text-right font-arcade font-black italic text-white tabular-nums leading-none shrink-0"
              style={{
                fontSize: 'clamp(10px, 1.2vw, 20px)',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.95)',
              }}
            >
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const CharacterStatsPanel = CharacterStats;
export default CharacterStats;
