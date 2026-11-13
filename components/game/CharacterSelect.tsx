'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Eye, Shuffle, Swords, RotateCcw } from 'lucide-react';
import { CHARACTERS, CHARACTER_ORDER } from '@/lib/game/characters';
import {
  cancelPlayerSlot,
  CHARACTER_SELECT_2_0_ASSETS,
  CHARACTER_SELECT_2_0_LAYOUT,
  CHARACTER_SELECT_METADATA,
  CharacterSelectState,
  confirmPlayerSlot,
  isCharacterSelectReady,
  movePlayerCursor,
  selectCharacterForSlot,
} from '@/lib/game/characterSelectController';
import { arcadeAudio } from '@/lib/game/audio';
import { CharacterId, GameMode } from '@/lib/game/types';
import { CharacterPreview } from './CharacterPreview';
import { CharacterStats } from './CharacterStats';
import { CharacterPortraitGrid } from './CharacterPortraitGrid';
import { CharacterDescriptionPanel } from './CharacterDescriptionPanel';

export interface CharacterSelectProps {
  gameMode: GameMode;
  p1Char: CharacterId;
  p2Char: CharacterId;
  selectedStage: CharacterId;
  selectingSlot: 1 | 2;
  onSelectP1: (charId: CharacterId) => void;
  onSelectP2: (charId: CharacterId) => void;
  onSelectStage: (stageId: CharacterId) => void;
  onChangeSlot: (slot: 1 | 2) => void;
  onBackToMenu: () => void;
  onConfirmMatch: () => void;
  onOpenStagePreviewer?: () => void;
}

export function CharacterSelect({
  gameMode,
  p1Char,
  p2Char,
  selectedStage,
  selectingSlot,
  onSelectP1,
  onSelectP2,
  onSelectStage,
  onChangeSlot,
  onBackToMenu,
  onConfirmMatch,
  onOpenStagePreviewer,
}: CharacterSelectProps) {
  const [p1Confirmed, setP1Confirmed] = useState<boolean>(false);
  const [p2Confirmed, setP2Confirmed] = useState<boolean>(false);
  const [showcaseSlot, setShowcaseSlot] = useState<1 | 2>(1);
  const autoLaunchTimerRef = useRef<number | null>(null);

  const selectState = useMemo<CharacterSelectState>(
    () => ({
      mode: gameMode,
      activeSelector: selectingSlot,
      player1: {
        characterId: p1Char,
        cursorIndex: Math.max(0, CHARACTER_ORDER.indexOf(p1Char)),
        confirmed: p1Confirmed,
        isCPU: false,
      },
      player2: {
        characterId: p2Char,
        cursorIndex: Math.max(0, CHARACTER_ORDER.indexOf(p2Char)),
        confirmed: p2Confirmed,
        isCPU: gameMode !== 'versus',
      },
    }),
    [gameMode, p1Char, p1Confirmed, p2Char, p2Confirmed, selectingSlot]
  );

  useEffect(() => {
    return () => {
      if (autoLaunchTimerRef.current !== null) {
        window.clearTimeout(autoLaunchTimerRef.current);
      }
    };
  }, []);

  // Determine which fighter is currently showcased in Capa C (left animated fighter + nameplate)
  // and Capa D (bottom-left stats + right CARACTERÍSTICAS panel)
  const showcasedCharId: CharacterId =
    showcaseSlot === 2 && selectingSlot === 2 ? p2Char : p1Char;
  const showcasedConfirmed =
    showcaseSlot === 2 && selectingSlot === 2 ? p2Confirmed : p1Confirmed;
  const showcasedSide: 'p1' | 'p2' =
    showcaseSlot === 2 && selectingSlot === 2 ? 'p2' : 'p1';
  const showcasedMeta = CHARACTER_SELECT_METADATA[showcasedCharId];
  const isMirrorMatch = p1Char === p2Char;

  const applyControllerState = (
    next: CharacterSelectState,
    autoStartOnReady: boolean = false,
    preferredShowcaseSlot?: 1 | 2
  ) => {
    setP1Confirmed(next.player1.confirmed);
    setP2Confirmed(next.player2.confirmed);
    if (preferredShowcaseSlot) {
      setShowcaseSlot(preferredShowcaseSlot);
    }
    if (next.player1.characterId !== p1Char) {
      onSelectP1(next.player1.characterId);
    }
    if (next.player2.characterId !== p2Char) {
      onSelectP2(next.player2.characterId);
      onSelectStage(next.player2.characterId);
    }
    if (next.activeSelector !== selectingSlot) {
      onChangeSlot(next.activeSelector);
    }

    if (autoStartOnReady && isCharacterSelectReady(next)) {
      if (autoLaunchTimerRef.current !== null) {
        window.clearTimeout(autoLaunchTimerRef.current);
      }
      autoLaunchTimerRef.current = window.setTimeout(() => {
        onConfirmMatch();
      }, 420);
    }
  };

  const handleConfirmSlot = (
    slot: 1 | 2,
    autoStartOnReady: boolean = false
  ) => {
    const charId = slot === 1 ? p1Char : p2Char;
    arcadeAudio.playMenuConfirm();
    arcadeAudio.announce(CHARACTER_SELECT_METADATA[charId].displayName);
    const next = confirmPlayerSlot(selectState, slot);
    applyControllerState(
      next,
      autoStartOnReady,
      next.activeSelector === 2 && gameMode !== 'arcade' ? 2 : 1
    );
  };

  const handleCancelSlot = (slot: 1 | 2) => {
    arcadeAudio.playMenuBack();
    const next = cancelPlayerSlot(selectState, slot);
    applyControllerState(next, false, slot);
  };

  // Classic 1996 Arcade Keyboard Navigation & Independent P1/P2 Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      if (code === 'Escape') {
        e.preventDefault();
        if (selectState.player2.confirmed && gameMode !== 'arcade') {
          handleCancelSlot(2);
          return;
        }
        if (selectState.player1.confirmed) {
          handleCancelSlot(1);
          return;
        }
        arcadeAudio.playMenuBack();
        onBackToMenu();
        return;
      }

      if (code === 'Enter') {
        e.preventDefault();
        if (gameMode === 'arcade') {
          handleConfirmSlot(1, false);
          onConfirmMatch();
          return;
        }
        if (!selectState.player1.confirmed) {
          handleConfirmSlot(1, false);
          return;
        }
        if (!selectState.player2.confirmed) {
          handleConfirmSlot(2, false);
          onConfirmMatch();
          return;
        }
        onConfirmMatch();
        return;
      }

      // P1 Navigation: WASD (or Arrows when selectingSlot === 1 in 1P modes)
      const isP1ArrowAllowed =
        gameMode !== 'versus' && selectState.activeSelector === 1;
      if (code === 'KeyA' || (isP1ArrowAllowed && code === 'ArrowLeft')) {
        e.preventDefault();
        if (!selectState.player1.confirmed) {
          arcadeAudio.playMenuMove();
          const next = movePlayerCursor(selectState, 1, -1, 0);
          applyControllerState(next, false, 1);
        }
        return;
      }
      if (code === 'KeyD' || (isP1ArrowAllowed && code === 'ArrowRight')) {
        e.preventDefault();
        if (!selectState.player1.confirmed) {
          arcadeAudio.playMenuMove();
          const next = movePlayerCursor(selectState, 1, 1, 0);
          applyControllerState(next, false, 1);
        }
        return;
      }
      if (code === 'KeyW' || (isP1ArrowAllowed && code === 'ArrowUp')) {
        e.preventDefault();
        if (!selectState.player1.confirmed) {
          arcadeAudio.playMenuMove();
          const next = movePlayerCursor(selectState, 1, 0, -1);
          applyControllerState(next, false, 1);
        }
        return;
      }
      if (code === 'KeyS' || (isP1ArrowAllowed && code === 'ArrowDown')) {
        e.preventDefault();
        if (!selectState.player1.confirmed) {
          arcadeAudio.playMenuMove();
          const next = movePlayerCursor(selectState, 1, 0, 1);
          applyControllerState(next, false, 1);
        }
        return;
      }

      // P1 Confirm (F / Space) and Cancel (G)
      if (code === 'KeyF' || code === 'Space') {
        e.preventDefault();
        if (
          gameMode !== 'versus' &&
          selectState.player1.confirmed &&
          !selectState.player2.confirmed
        ) {
          handleConfirmSlot(2, true);
        } else {
          handleConfirmSlot(1, gameMode === 'arcade');
        }
        return;
      }
      if (code === 'KeyG') {
        e.preventDefault();
        if (selectState.player2.confirmed && gameMode !== 'arcade') {
          handleCancelSlot(2);
        } else if (selectState.player1.confirmed) {
          handleCancelSlot(1);
        }
        return;
      }

      // P2 Navigation: Arrow Keys (always active for P2 in Versus, or when activeSelector === 2)
      const isP2ArrowActive =
        gameMode === 'versus' || selectState.activeSelector === 2;
      if (isP2ArrowActive) {
        if (code === 'ArrowLeft') {
          e.preventDefault();
          if (!selectState.player2.confirmed) {
            arcadeAudio.playMenuMove();
            const next = movePlayerCursor(selectState, 2, -1, 0);
            applyControllerState(next, false, 2);
          }
          return;
        }
        if (code === 'ArrowRight') {
          e.preventDefault();
          if (!selectState.player2.confirmed) {
            arcadeAudio.playMenuMove();
            const next = movePlayerCursor(selectState, 2, 1, 0);
            applyControllerState(next, false, 2);
          }
          return;
        }
        if (code === 'ArrowUp') {
          e.preventDefault();
          if (!selectState.player2.confirmed) {
            arcadeAudio.playMenuMove();
            const next = movePlayerCursor(selectState, 2, 0, -1);
            applyControllerState(next, false, 2);
          }
          return;
        }
        if (code === 'ArrowDown') {
          e.preventDefault();
          if (!selectState.player2.confirmed) {
            arcadeAudio.playMenuMove();
            const next = movePlayerCursor(selectState, 2, 0, 1);
            applyControllerState(next, false, 2);
          }
          return;
        }
      }

      // P2 Confirm (J) and Cancel (K)
      if (code === 'KeyJ') {
        e.preventDefault();
        handleConfirmSlot(2, selectState.player1.confirmed);
        return;
      }
      if (code === 'KeyK') {
        e.preventDefault();
        if (selectState.player2.confirmed) {
          handleCancelSlot(2);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleRandomPick = () => {
    const randomChar =
      CHARACTER_ORDER[Math.floor(Math.random() * CHARACTER_ORDER.length)];
    arcadeAudio.playMenuConfirm();
    arcadeAudio.announce(CHARACTER_SELECT_METADATA[randomChar].displayName);
    if (selectingSlot === 1) {
      const moved = selectCharacterForSlot(selectState, 1, randomChar);
      const locked = confirmPlayerSlot(moved, 1);
      applyControllerState(locked, false, 1);
    } else {
      const moved = selectCharacterForSlot(selectState, 2, randomChar);
      const locked = confirmPlayerSlot(moved, 2);
      applyControllerState(locked, false, 2);
    }
  };

  const handleGridHoverCharacter = (charId: CharacterId) => {
    if (selectingSlot === 1 && !selectState.player1.confirmed) {
      if (charId !== p1Char) {
        arcadeAudio.playMenuMove();
        const moved = selectCharacterForSlot(selectState, 1, charId);
        applyControllerState(moved, false, 1);
      }
    } else if (selectingSlot === 2 && !selectState.player2.confirmed) {
      if (charId !== p2Char) {
        arcadeAudio.playMenuMove();
        const moved = selectCharacterForSlot(selectState, 2, charId);
        applyControllerState(moved, false, 2);
      }
    }
  };

  const handleGridSelectCharacter = (charId: CharacterId) => {
    arcadeAudio.playMenuConfirm();
    arcadeAudio.announce(CHARACTER_SELECT_METADATA[charId].displayName);
    if (selectingSlot === 1) {
      const moved = selectCharacterForSlot(selectState, 1, charId);
      const locked = confirmPlayerSlot(moved, 1);
      applyControllerState(locked, false, 1);
    } else {
      const moved = selectCharacterForSlot(selectState, 2, charId);
      const locked = confirmPlayerSlot(moved, 2);
      applyControllerState(locked, false, 2);
    }
  };

  const layout = CHARACTER_SELECT_2_0_LAYOUT;

  return (
    <div
      data-testid="character-select-screen"
      className="relative w-full h-full flex items-center justify-center bg-[#050321] overflow-hidden select-none"
    >
      {/* Ambient radial glow behind the 16:9 arcade frame */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(29, 78, 216, 0.32) 0%, rgba(5, 3, 33, 0.96) 80%)',
        }}
      />

      {/* =====================================================================
          16:9 PANORAMIC ARCADE SELECT FRAME (1672 x 941 Native Coordinate Space)
         ===================================================================== */}
      <div
        className="relative z-10 w-full max-w-[1672px] max-h-full aspect-[1672/941] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.95)]"
        data-active-fighter={showcasedCharId}
      >
        {/* -----------------------------------------------------------------
            CAPA A: Clean Official Arcade Background Plate (1672 x 941)
           ----------------------------------------------------------------- */}
        <Image
          src={CHARACTER_SELECT_2_0_ASSETS.cleanBackground}
          alt="Arcade Fighters '96 - Selección de Personajes"
          fill
          priority
          sizes="100vw"
          referrerPolicy="no-referrer"
          className="object-fill pointer-events-none select-none z-0"
        />

        {/* Accessible Screen Header for Assistive Tree & Automated Checks */}
        <h1 className="sr-only">
          SELECCIÓN DE PERSONAJES - ARCADE FIGHTERS &apos;96
        </h1>

        {/* -----------------------------------------------------------------
            CAPA C (Parte 1): Personaje Ampliado Animado a la Izquierda
           ----------------------------------------------------------------- */}
        <div
          style={{
            left: `${layout.previewShowcase.leftPct}%`,
            top: `${layout.previewShowcase.topPct}%`,
            width: `${layout.previewShowcase.widthPct}%`,
            height: `${layout.previewShowcase.heightPct}%`,
          }}
          className="absolute z-10 pointer-events-none"
        >
          <CharacterPreview
            characterId={showcasedCharId}
            side={showcasedSide}
            confirmed={showcasedConfirmed}
            isAltPalette={showcasedSide === 'p2' && isMirrorMatch}
            isCPU={showcasedSide === 'p2' && gameMode !== 'versus'}
            showNameplate={false}
          />
        </div>

        {/* -----------------------------------------------------------------
            CAPA C (Parte 2): Placa Dinámica de Nombre y Subtítulo del Luchador
           ----------------------------------------------------------------- */}
        <div
          data-testid="left-fighter-nameplate"
          style={{
            left: `${layout.previewNameplate.leftPct}%`,
            top: `${layout.previewNameplate.topPct}%`,
            width: `${layout.previewNameplate.widthPct}%`,
            height: `${layout.previewNameplate.heightPct}%`,
          }}
          className="absolute z-20 flex flex-col items-center justify-center px-[2%] pointer-events-none"
        >
          {/* Crimson Brushstroke Backing behind Fighter Name */}
          <div
            className="relative w-[96%] py-[2%] px-[3%] -skew-x-12 flex flex-col items-center justify-center"
            style={{
              background:
                'linear-gradient(90deg, rgba(159,18,57,0) 0%, rgba(225,29,72,0.92) 15%, rgba(190,18,60,0.96) 85%, rgba(159,18,57,0) 100%)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.8)',
            }}
          >
            <h2
              data-testid="showcase-fighter-name"
              className="skew-x-12 font-arcade font-black italic uppercase tracking-wider text-center leading-none whitespace-nowrap"
              style={{
                fontSize:
                  showcasedMeta.displayName.length > 14
                    ? 'clamp(13px, 1.9vw, 32px)'
                    : 'clamp(18px, 2.75vw, 46px)',
                background:
                  'linear-gradient(180deg, #fef08a 0%, #facc15 52%, #ea580c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.98))',
              }}
            >
              {showcasedMeta.displayName}
            </h2>
            <p
              data-testid="showcase-fighter-subtitle"
              className="skew-x-12 mt-[1%] font-arcade font-black italic uppercase tracking-widest text-white text-center leading-none whitespace-nowrap"
              style={{
                fontSize: 'clamp(8px, 1.02vw, 17px)',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.98)',
              }}
            >
              {showcasedMeta.subtitle}
            </p>
          </div>
        </div>

        {/* -----------------------------------------------------------------
            CAPA D (Izquierda Inferior): Cuadro Metálico de Estadísticas (FUERZA..TÉCNICA)
           ----------------------------------------------------------------- */}
        <div
          style={{
            left: `${layout.statsPanelInner.leftPct}%`,
            top: `${layout.statsPanelInner.topPct}%`,
            width: `${layout.statsPanelInner.widthPct}%`,
            height: `${layout.statsPanelInner.heightPct}%`,
          }}
          className="absolute z-20"
        >
          <CharacterStats
            stats={showcasedMeta.stats}
            side={showcasedSide}
            accentHex={showcasedMeta.accentHex}
          />
        </div>

        {/* -----------------------------------------------------------------
            CAPA B & CAPA E: Cuadrícula 3x2 de Personajes + Cursores P1 / P2
           ----------------------------------------------------------------- */}
        <CharacterPortraitGrid
          player1={selectState.player1}
          player2={selectState.player2}
          activeSelector={selectingSlot}
          onSelectCharacter={handleGridSelectCharacter}
          onHoverCharacter={handleGridHoverCharacter}
        />

        {/* -----------------------------------------------------------------
            CAPA D (Derecha): Panel Metálico "CARACTERÍSTICAS"
           ----------------------------------------------------------------- */}
        <div
          style={{
            left: `${layout.characteristicsPanelInner.leftPct}%`,
            top: `${layout.characteristicsPanelInner.topPct}%`,
            width: `${layout.characteristicsPanelInner.widthPct}%`,
            height: `${layout.characteristicsPanelInner.heightPct}%`,
          }}
          className="absolute z-20"
        >
          <CharacterDescriptionPanel characterId={showcasedCharId} />
        </div>

        {/* -----------------------------------------------------------------
            PANEL DERECHO INFERIOR: Estado P1 vs P2/CPU, Escenario y Acciones Rápidas
           ----------------------------------------------------------------- */}
        <div
          style={{
            left: `${layout.characteristicsFooterArea.leftPct}%`,
            top: `${layout.characteristicsFooterArea.topPct}%`,
            width: `${layout.characteristicsFooterArea.widthPct}%`,
            height: `${layout.characteristicsFooterArea.heightPct}%`,
          }}
          className="absolute z-20 flex flex-col justify-between p-[3%]"
        >
          {/* Active Slot / Matchup Status Strip */}
          <div className="bg-[#090829]/90 border border-indigo-400/60 px-[3%] py-[2%] shadow-[0_4px_12px_rgba(0,0,0,0.85)]">
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                data-testid="p1-confirm-pose"
                onClick={() => {
                  onChangeSlot(1);
                  setShowcaseSlot(1);
                  if (!selectState.player1.confirmed) {
                    handleConfirmSlot(1, false);
                  }
                }}
                className={`flex-1 py-1 px-1.5 font-arcade font-black text-left truncate border cursor-pointer transition-colors ${
                  selectingSlot === 1
                    ? 'bg-red-600/90 text-yellow-200 border-yellow-300'
                    : 'bg-zinc-900/90 text-zinc-300 border-zinc-700 hover:border-yellow-400'
                }`}
                style={{ fontSize: 'clamp(7.5px, 0.78vw, 12px)' }}
              >
                P1: {CHARACTER_SELECT_METADATA[p1Char].gridLabel}{' '}
                {selectState.player1.confirmed ? '✓' : ''}
              </button>

              {selectState.player1.confirmed && (
                <button
                  type="button"
                  aria-label="Cancelar selección P1"
                  onClick={() => handleCancelSlot(1)}
                  className="p-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-600 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}

              <button
                type="button"
                data-testid="p2-confirm-pose"
                onClick={() => {
                  onChangeSlot(2);
                  setShowcaseSlot(2);
                  if (!selectState.player2.confirmed) {
                    handleConfirmSlot(2, false);
                  }
                }}
                className={`flex-1 py-1 px-1.5 font-arcade font-black text-right truncate border cursor-pointer transition-colors ${
                  selectingSlot === 2
                    ? 'bg-sky-600/90 text-white border-cyan-200'
                    : 'bg-zinc-900/90 text-zinc-300 border-zinc-700 hover:border-cyan-300'
                }`}
                style={{ fontSize: 'clamp(7.5px, 0.78vw, 12px)' }}
              >
                {gameMode === 'versus' ? 'P2' : 'CPU'}:{' '}
                {CHARACTER_SELECT_METADATA[p2Char].gridLabel}{' '}
                {selectState.player2.confirmed ? '✓' : ''}
              </button>
            </div>

            {/* Stage Selector Compact Strip */}
            <div className="mt-1.5 flex items-center justify-between gap-1 border-t border-indigo-500/30 pt-1">
              <span
                className="font-arcade font-bold text-amber-300 truncate"
                style={{ fontSize: 'clamp(7px, 0.72vw, 11px)' }}
              >
                STAGE: {CHARACTERS[selectedStage].stage.name}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {CHARACTER_ORDER.map((stId, idx) => (
                  <button
                    key={stId}
                    type="button"
                    data-stage-id={stId}
                    aria-label={`Escenario ${CHARACTERS[stId].stage.name}`}
                    onClick={() => {
                      arcadeAudio.playMenuMove();
                      onSelectStage(stId);
                    }}
                    className={`w-4 h-4 font-mono-num font-bold text-[9px] border cursor-pointer ${
                      selectedStage === stId
                        ? 'bg-amber-400 text-zinc-950 border-white'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-amber-300'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons Dock at bottom of CARACTERÍSTICAS panel */}
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handleRandomPick}
                className="flex items-center justify-center gap-1 px-2 py-1 bg-zinc-950/90 hover:bg-zinc-900 text-amber-300 border border-amber-400/70 font-arcade font-bold cursor-pointer whitespace-nowrap"
                style={{ fontSize: 'clamp(7.5px, 0.76vw, 12px)' }}
              >
                <Shuffle className="w-3 h-3 shrink-0" />
                <span>ALEATORIO</span>
              </button>

              {onOpenStagePreviewer && (
                <button
                  type="button"
                  data-testid="open-stage-previewer-select"
                  onClick={onOpenStagePreviewer}
                  className="flex items-center justify-center gap-1 px-2 py-1 bg-zinc-950/90 hover:bg-zinc-900 text-sky-300 border border-sky-400/70 font-arcade font-bold cursor-pointer whitespace-nowrap"
                  style={{ fontSize: 'clamp(7.5px, 0.76vw, 12px)' }}
                >
                  <Eye className="w-3 h-3 shrink-0" />
                  <span>ESCENARIOS</span>
                </button>
              )}
            </div>

            <button
              type="button"
              data-start="true"
              onClick={onConfirmMatch}
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 hover:from-amber-300 hover:to-yellow-200 text-zinc-950 border-2 border-white font-arcade font-black shadow-[0_0_16px_rgba(250,204,21,0.65)] cursor-pointer whitespace-nowrap"
              style={{ fontSize: 'clamp(8.5px, 0.9vw, 14px)' }}
            >
              <Swords className="w-3.5 h-3.5 shrink-0" />
              <span>¡PELEAR AHORA!</span>
            </button>
          </div>
        </div>

        {/* -----------------------------------------------------------------
            BARRA INFERIOR DE CONTROLES ARCADE (Interactive Hotspots)
           ----------------------------------------------------------------- */}
        <button
          type="button"
          aria-label="P1: Mover / Confirmar selección"
          onClick={() => {
            if (!selectState.player1.confirmed) {
              handleConfirmSlot(1, gameMode === 'arcade');
            } else if (!selectState.player2.confirmed) {
              handleConfirmSlot(2, true);
            } else {
              onConfirmMatch();
            }
          }}
          style={{
            left: `${layout.bottomConfirmHotspot.leftPct}%`,
            top: `${layout.bottomConfirmHotspot.topPct}%`,
            width: `${layout.bottomConfirmHotspot.widthPct}%`,
            height: `${layout.bottomConfirmHotspot.heightPct}%`,
          }}
          className="absolute z-20 bg-transparent hover:bg-white/5 border-0 cursor-pointer focus:outline-none"
        >
          <span className="sr-only">P1: MOVER / CONFIRMAR</span>
        </button>

        <button
          type="button"
          aria-label="ESC: Volver al menú principal"
          onClick={onBackToMenu}
          style={{
            left: `${layout.bottomBackHotspot.leftPct}%`,
            top: `${layout.bottomBackHotspot.topPct}%`,
            width: `${layout.bottomBackHotspot.widthPct}%`,
            height: `${layout.bottomBackHotspot.heightPct}%`,
          }}
          className="absolute z-20 bg-transparent hover:bg-white/5 border-0 cursor-pointer focus:outline-none"
        >
          <span className="sr-only">VOLVER AL MENÚ</span>
        </button>
      </div>
    </div>
  );
}

export const CharacterSelectScreen = CharacterSelect;
export default CharacterSelect;
