'use client';

import React from 'react';
import Image from 'next/image';
import {
  CHARACTER_SELECT_2_0_LAYOUT,
  CHARACTER_SELECT_METADATA,
  PlayerSelection,
} from '@/lib/game/characterSelectController';
import { CharacterId } from '@/lib/game/types';

export interface CharacterSelectionCursorProps {
  side: 'p1' | 'p2';
  confirmed: boolean;
  isCPU: boolean;
  sharedCell: boolean;
}

/**
 * CAPA E: Cursor Luminoso de Selección (P1 / P2 / CPU)
 * - PLAYER 1: Intense red, orange, and yellow glowing border + slanted top-left "P1" badge
 * - PLAYER 2 / CPU: Electric blue and cyan glowing border + slanted top-right "P2" / "CPU" badge
 */
export function CharacterSelectionCursor({
  side,
  confirmed,
  isCPU,
  sharedCell,
}: CharacterSelectionCursorProps) {
  const isP1 = side === 'p1';
  const label = isP1 ? 'P1' : isCPU ? 'CPU' : 'P2';

  return (
    <>
      {/* Illuminated Arcade Frame Border */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-20 transition-all duration-150 ${
          isP1
            ? 'border-[3px] md:border-[4px] border-yellow-300 shadow-[0_0_18px_rgba(255,60,0,0.95),inset_0_0_14px_rgba(255,140,0,0.85)]'
            : 'border-[3px] md:border-[4px] border-cyan-300 shadow-[0_0_18px_rgba(56,189,248,0.95),inset_0_0_14px_rgba(14,165,233,0.85)]'
        }`}
        style={
          sharedCell
            ? {
                clipPath: isP1
                  ? 'polygon(0 0, 100% 0, 0 100%)'
                  : 'polygon(100% 0, 100% 100%, 0 100%)',
              }
            : undefined
        }
      />

      {/* Slanted Corner Player Badge (P1 top-left, P2/CPU top-right) */}
      <div
        data-testid={`cursor-badge-${side}`}
        className={`pointer-events-none absolute z-30 flex items-center gap-1 px-[5%] py-[1.2%] -skew-x-12 border-2 font-arcade font-black italic tracking-wider shadow-[0_3px_10px_rgba(0,0,0,0.95)] ${
          isP1
            ? 'top-[2%] left-[2%] bg-gradient-to-b from-red-500 via-red-600 to-red-800 text-yellow-300 border-yellow-300'
            : 'top-[2%] right-[2%] bg-gradient-to-b from-sky-400 via-blue-600 to-blue-900 text-white border-cyan-200'
        } ${confirmed ? 'scale-105' : ''}`}
        style={{
          fontSize: 'clamp(9px, 1.15vw, 18px)',
        }}
      >
        <span className="skew-x-12 drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]">
          {label}
        </span>
        {confirmed && (
          <span
            className="skew-x-12 px-1 bg-yellow-300 text-zinc-950 font-black not-italic"
            style={{ fontSize: 'clamp(7px, 0.72vw, 11px)' }}
          >
            OK
          </span>
        )}
      </div>

      {/* Confirmed "SELECTED" Stamp */}
      {confirmed && (
        <div
          className={`pointer-events-none absolute z-30 ${
            isP1 ? 'bottom-[24%] left-[3%]' : 'bottom-[24%] right-[3%]'
          } px-1.5 py-0.5 -skew-x-12 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-zinc-950 font-arcade font-black tracking-widest border border-white shadow-[0_2px_10px_rgba(0,0,0,0.95)]`}
          style={{ fontSize: 'clamp(7px, 0.75vw, 11px)' }}
        >
          <span className="skew-x-12 block">SELECTED</span>
        </div>
      )}
    </>
  );
}

export interface CharacterPortraitGridProps {
  player1: PlayerSelection;
  player2: PlayerSelection;
  activeSelector: 1 | 2;
  onSelectCharacter: (charId: CharacterId) => void;
  onHoverCharacter?: (charId: CharacterId) => void;
}

/**
 * CAPA B: Cuadrícula 3x2 de Personajes (CharacterPortraitGrid)
 * Positions the 6 interactive portrait cards over the exact 3x2 grid cells of the
 * 1672x941 Character Select 2.0 screen.
 */
export function CharacterPortraitGrid({
  player1,
  player2,
  onSelectCharacter,
  onHoverCharacter,
}: CharacterPortraitGridProps) {
  return (
    <div
      role="group"
      aria-label="Cuadrícula de los seis luchadores"
      className="pointer-events-none absolute inset-0 z-10"
    >
      {CHARACTER_SELECT_2_0_LAYOUT.gridCells.map((cell) => {
        const charId = cell.characterId;
        const meta = CHARACTER_SELECT_METADATA[charId];
        const isP1 = player1.characterId === charId;
        const isP2 = player2.characterId === charId;
        const sharedCell = isP1 && isP2;

        return (
          <button
            key={charId}
            type="button"
            data-fighter-id={charId}
            aria-label={`${meta.displayName} - ${meta.portraitTags}`}
            onMouseEnter={() => {
              if (onHoverCharacter) onHoverCharacter(charId);
            }}
            onClick={() => onSelectCharacter(charId)}
            style={{
              left: `${cell.leftPct}%`,
              top: `${cell.topPct}%`,
              width: `${cell.widthPct}%`,
              height: `${cell.heightPct}%`,
            }}
            className={`pointer-events-auto group absolute block overflow-hidden bg-transparent p-0 border-0 cursor-pointer transition-transform duration-150 focus:outline-none ${
              isP1 || isP2
                ? 'scale-[1.018] z-20'
                : 'hover:scale-[1.01] hover:brightness-110 z-10'
            }`}
          >
            {/* Clean Official Portrait Card Artwork */}
            <div className="relative w-full h-full">
              <Image
                src={meta.portraitAsset}
                alt={`${meta.displayName} (${meta.portraitTags})`}
                fill
                sizes="(max-width: 1024px) 28vw, 270px"
                referrerPolicy="no-referrer"
                className="object-fill select-none pointer-events-none"
                priority
              />
            </div>

            {/*Accessible text for snapshot & screen readers */}
            <span className="sr-only">
              {meta.gridLabel} · {meta.portraitTags}
            </span>

            {/* CAPA E: Dynamic P1 and P2/CPU Cursors */}
            {isP1 && (
              <CharacterSelectionCursor
                side="p1"
                confirmed={player1.confirmed}
                isCPU={false}
                sharedCell={sharedCell}
              />
            )}
            {isP2 && (
              <CharacterSelectionCursor
                side="p2"
                confirmed={player2.confirmed}
                isCPU={player2.isCPU}
                sharedCell={sharedCell}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default CharacterPortraitGrid;
