'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Swords, Zap } from 'lucide-react';
import { CHARACTERS, getRivalryDialogue } from '@/lib/game/characters';
import { CHARACTER_SELECT_METADATA } from '@/lib/game/characterSelectController';
import { STAGE_REGISTRY } from '@/lib/game/stageData';
import { arcadeAudio } from '@/lib/game/audio';
import { CharacterId, GameMode } from '@/lib/game/types';
import { CharacterPreview } from './CharacterPreview';

export interface VersusTransitionProps {
  gameMode: GameMode;
  p1Char: CharacterId;
  p2Char: CharacterId;
  selectedStage: CharacterId;
  arcadeStageIdx?: number;
  arcadeTotalStages?: number;
  onStartMatch: () => void;
}

export function VersusTransition({
  gameMode,
  p1Char,
  p2Char,
  selectedStage,
  arcadeStageIdx = 0,
  arcadeTotalStages = 5,
  onStartMatch,
}: VersusTransitionProps) {
  const [countdownMs, setCountdownMs] = useState<number>(2800);
  const p1Def = CHARACTERS[p1Char];
  const p2Def = CHARACTERS[p2Char];
  const p1Meta = CHARACTER_SELECT_METADATA[p1Char];
  const p2Meta = CHARACTER_SELECT_METADATA[p2Char];
  const stageDef = STAGE_REGISTRY[selectedStage];
  const isMirrorMatch = p1Char === p2Char;
  const rivalry = getRivalryDialogue(p1Char, p2Char);

  // Announce matchup and auto-advance after 2.8 seconds (or immediately on Enter/Space)
  useEffect(() => {
    arcadeAudio.announce(
      `${p1Meta.displayName} versus ${p2Meta.displayName}`
    );

    const startTime = performance.now();
    const duration = 2800;

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      setCountdownMs(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        onStartMatch();
      }
    }, 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyF') {
        e.preventDefault();
        window.clearInterval(interval);
        onStartMatch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onStartMatch, p1Meta.displayName, p2Meta.displayName]);

  return (
    <div
      data-testid="versus-transition-screen"
      className="relative w-full h-full flex flex-col justify-between p-4 md:p-8 bg-zinc-950 overflow-hidden select-none"
    >
      {/* Stage Artwork Backdrop + High-Energy Diagonal Speed Lines */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <Image
          src={stageDef.backgroundUrl}
          alt={stageDef.name}
          fill
          priority
          sizes="100vw"
          referrerPolicy="no-referrer"
          className="object-cover opacity-35 scale-105"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(250, 204, 21, 0.22) 0%, rgba(15, 23, 42, 0.85) 55%, rgba(9, 9, 11, 0.96) 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-28deg, rgba(56, 189, 248, 0.22) 0px, rgba(56, 189, 248, 0.22) 2px, transparent 2px, transparent 24px)',
          }}
        />
      </div>

      {/* Top Tournament Header Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-400/60 pb-2.5 bg-zinc-950/80 px-4 py-2">
        <div className="flex items-center gap-2 text-xs md:text-sm font-arcade font-bold text-amber-300 tracking-wider">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>
            {gameMode === 'arcade'
              ? `ARCADE TOURNAMENT · STAGE ${arcadeStageIdx + 1} OF ${arcadeTotalStages}`
              : gameMode === 'versus'
                ? 'VERSUS 2P · HEAD TO HEAD'
                : 'CPU EXHIBITION MATCH'}
          </span>
        </div>
        <div className="text-xs font-mono-num text-zinc-200">
          ARENA:{' '}
          <strong className="font-arcade text-amber-400">{stageDef.name}</strong>{' '}
          ({CHARACTERS[selectedStage].stage.location})
        </div>
      </div>

      {/* Explosive 1996 Arcade Split-Screen Confrontation */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-11 gap-4 md:gap-6 items-center my-auto py-2">
        {/* PLAYER 1 PANEL (LEFT) */}
        <div className="md:col-span-5 bg-gradient-to-br from-sky-950/90 via-zinc-900/95 to-zinc-950 border-2 border-sky-400 p-4 md:p-5 shadow-[0_0_30px_rgba(56,189,248,0.35)]">
          <div className="flex items-center justify-between border-b border-sky-400/40 pb-2 mb-2">
            <span className="px-2 py-0.5 bg-sky-400 text-zinc-950 font-arcade font-black text-xs tracking-widest">
              PLAYER 1
            </span>
            <span className="text-xs font-mono-num text-sky-300">
              {p1Meta.originLabel}
            </span>
          </div>

          <CharacterPreview
            characterId={p1Char}
            side="p1"
            confirmed={true}
            isAltPalette={false}
          />

          <div className="mt-2 text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-arcade font-black text-white tracking-wider drop-shadow-[0_2px_8px_rgba(56,189,248,0.65)]">
              {p1Meta.displayName}
            </h2>
            <div className="text-xs font-arcade font-bold text-amber-300 tracking-widest">
              {p1Meta.subtitle}
            </div>
          </div>

          <blockquote className="mt-3 p-2.5 bg-zinc-950/90 border-l-4 border-sky-400 text-xs text-sky-200 italic">
            &ldquo;{rivalry.p1Line}&rdquo;
          </blockquote>
        </div>

        {/* CENTER EXPLOSIVE CHROME 'VS' EMBLEM */}
        <div className="md:col-span-1 flex flex-col items-center justify-center py-2">
          <div className="relative flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-b from-amber-300 via-orange-500 to-rose-600 border-4 border-white shadow-[0_0_40px_rgba(250,204,21,0.9)]">
            <span className="font-arcade font-black text-3xl md:text-4xl text-zinc-950 tracking-tighter drop-shadow-[0_2px_0_rgba(255,255,255,0.85)]">
              VS
            </span>
          </div>
          <span className="mt-2 text-[10px] font-mono-num text-amber-300 uppercase tracking-widest">
            {(countdownMs / 1000).toFixed(1)}s
          </span>
        </div>

        {/* PLAYER 2 / CPU PANEL (RIGHT) */}
        <div className="md:col-span-5 bg-gradient-to-bl from-rose-950/90 via-zinc-900/95 to-zinc-950 border-2 border-rose-500 p-4 md:p-5 shadow-[0_0_30px_rgba(244,63,94,0.35)]">
          <div className="flex items-center justify-between border-b border-rose-500/40 pb-2 mb-2">
            <span className="text-xs font-mono-num text-rose-300">
              {p2Meta.originLabel}
            </span>
            <span className="px-2 py-0.5 bg-rose-500 text-white font-arcade font-black text-xs tracking-widest">
              {gameMode === 'versus' ? 'PLAYER 2' : 'CPU CHALLENGER'}
              {isMirrorMatch ? ' · 2P' : ''}
            </span>
          </div>

          <CharacterPreview
            characterId={p2Char}
            side="p2"
            confirmed={true}
            isAltPalette={isMirrorMatch}
          />

          <div className="mt-2 text-center md:text-right">
            <h2 className="text-2xl md:text-3xl font-arcade font-black text-white tracking-wider drop-shadow-[0_2px_8px_rgba(244,63,94,0.65)]">
              {p2Meta.displayName}
            </h2>
            <div className="text-xs font-arcade font-bold text-amber-300 tracking-widest">
              {p2Meta.subtitle}
            </div>
          </div>

          <blockquote className="mt-3 p-2.5 bg-zinc-950/90 border-r-4 border-rose-500 text-xs text-rose-200 italic text-right">
            &ldquo;{rivalry.p2Line}&rdquo;
          </blockquote>
        </div>
      </div>

      {/* Bottom Bar with Stage Music & Instant Start Button */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 bg-zinc-950/85 border-t border-zinc-800 px-4 py-2.5">
        <span className="text-xs text-zinc-300 font-mono-num">
          ♪ BANDA SONORA 8-BIT METAL:{' '}
          <strong className="text-amber-300">{p2Def.stage.musicStyle}</strong> (
          {p1Def.shortName} vs {p2Def.shortName})
        </span>

        <button
          type="button"
          data-start="true"
          onClick={onStartMatch}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 hover:from-amber-300 hover:to-yellow-200 text-zinc-950 font-arcade font-black text-sm md:text-base border-2 border-white shadow-[0_0_20px_rgba(250,204,21,0.5)] cursor-pointer whitespace-nowrap"
        >
          <Swords className="w-4 h-4" />
          COMENZAR ROUND (ENTER) →
        </button>
      </div>
    </div>
  );
}

export default VersusTransition;
