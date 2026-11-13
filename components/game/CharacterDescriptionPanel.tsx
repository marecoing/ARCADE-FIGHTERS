'use client';

import React from 'react';
import { CHARACTER_SELECT_METADATA } from '@/lib/game/characterSelectController';
import { CharacterId } from '@/lib/game/types';

export interface CharacterDescriptionPanelProps {
  characterId: CharacterId;
}

/**
 * CAPA D (Derecha): Panel Metálico "CARACTERÍSTICAS"
 * Dynamically displays the currently selected fighter's slanted crimson/gold header
 * and their 3 official tactical characteristics from Section 10.
 */
export function CharacterDescriptionPanel({
  characterId,
}: CharacterDescriptionPanelProps) {
  const meta = CHARACTER_SELECT_METADATA[characterId];

  return (
    <div
      data-testid="character-description-panel"
      data-character-id={characterId}
      className="w-full h-full flex flex-col justify-start px-[4.5%] pt-[3.5%] pb-[2%] select-none"
    >
      {/* Slanted Crimson & Gold Brushstroke Fighter Header Banner */}
      <div
        className="relative w-full py-[2.8%] px-[4%] mb-[6.5%] -skew-x-12 border-y-2 border-rose-500/90 shadow-[0_4px_14px_rgba(0,0,0,0.85)] flex items-center justify-center overflow-hidden"
        style={{
          background:
            'linear-gradient(90deg, rgba(136,19,55,0.95) 0%, rgba(190,18,60,0.98) 50%, rgba(136,19,55,0.95) 100%)',
        }}
      >
        <h3
          data-testid="characteristics-fighter-name"
          className="skew-x-12 font-arcade font-black italic uppercase tracking-wider text-center leading-none whitespace-nowrap"
          style={{
            fontSize:
              meta.displayName.length > 14
                ? 'clamp(11px, 1.35vw, 22px)'
                : 'clamp(14px, 1.85vw, 31px)',
            background:
              'linear-gradient(180deg, #fef08a 0%, #facc15 55%, #ea580c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.95))',
          }}
        >
          {meta.displayName}
        </h3>
      </div>

      {/* 3 Bulleted Fighter Characteristics (Section 10) */}
      <ul className="flex flex-col gap-[6.5%] text-white">
        {meta.characteristics.map((trait) => (
          <li
            key={trait.title}
            className="flex items-start gap-[3.5%] leading-snug"
          >
            {/* Glowing Yellow Square Bullet */}
            <span
              aria-hidden="true"
              className="mt-[0.35em] w-[0.58em] h-[0.58em] bg-gradient-to-b from-yellow-300 to-amber-500 border border-amber-950 shrink-0 -skew-x-6 shadow-[0_0_6px_rgba(250,204,21,0.8)]"
              style={{
                fontSize: 'clamp(10px, 1.18vw, 19px)',
              }}
            />
            <p
              className="font-sans italic font-semibold text-zinc-100"
              style={{
                fontSize: 'clamp(9.5px, 1.12vw, 18.5px)',
                lineHeight: 1.24,
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.95)',
              }}
            >
              <strong className="font-arcade font-black italic text-yellow-300 tracking-wide">
                {trait.title}:
              </strong>{' '}
              <span>{trait.description}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CharacterDescriptionPanel;
