'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FlipHorizontal,
  Crosshair,
  Box,
  Grid,
  Users,
  Layers,
  FileCheck2,
  Columns,
  X,
  CheckCircle2,
} from 'lucide-react';
import { CHARACTERS, CHARACTER_ORDER } from '@/lib/game/characters';
import { HD_ATLAS_MANIFESTS, HdAnimationStateName } from '@/lib/game/hdAtlasData';
import {
  createFighterRuntime,
  getActiveHitbox,
  getFighterHurtboxes,
} from '@/lib/game/rules';
import { SPRITE_SHEET_CONFIGS } from '@/lib/game/spriteData';
import {
  ALL_25_HD_ANIMATION_STATES,
  SpriteAnimationController,
  spriteSheetManager,
} from '@/lib/game/spriteEngine';
import { renderSpriteFrame } from '@/lib/game/sprites';
import { CharacterId } from '@/lib/game/types';

interface SpriteInspectorModalProps {
  onClose: () => void;
  initialCharacter?: CharacterId;
}

export function SpriteInspectorModal({
  onClose,
  initialCharacter = 'mostasa',
}: SpriteInspectorModalProps) {
  const [activeTab, setActiveTab] = useState<
    'single' | 'compare' | 'lineup' | 'audit'
  >('single');
  const [selectedChar, setSelectedChar] =
    useState<CharacterId>(initialCharacter);
  const [selectedAnim, setSelectedAnim] =
    useState<HdAnimationStateName>('idle');
  const [playing, setPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [facingRight, setFacingRight] = useState<boolean>(true);
  const [isAltPalette, setIsAltPalette] = useState<boolean>(false);
  const [useLegacySource, setUseLegacySource] = useState<boolean>(false);
  const [splitCompareInSingle, setSplitCompareInSingle] =
    useState<boolean>(false);
  const [showCheckerboard, setShowCheckerboard] = useState<boolean>(true);
  const [showAnchor, setShowAnchor] = useState<boolean>(true);
  const [showBounds, setShowBounds] = useState<boolean>(true);
  const [showHitboxes, setShowHitboxes] = useState<boolean>(true);
  const [lineupAnim, setLineupAnim] = useState<HdAnimationStateName>('idle');

  const [hudFrameInfo, setHudFrameInfo] = useState({
    seqIndex: 0,
    seqLength: 5,
    frameId: 'r0_f0',
    row: 0,
    col: 0,
    sourceX: 0,
    sourceY: 0,
    sourceWidth: 100,
    sourceHeight: 144,
    anchorX: 50,
    footY: 142,
    durationMs: 120,
    sourceType: 'HD_ATLAS' as 'HD_ATLAS' | 'LEGACY_FALLBACK',
  });

  const singleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lineupCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const hdControllerRef = useRef<SpriteAnimationController>(
    new SpriteAnimationController(initialCharacter, false)
  );
  const legacyControllerRef = useRef<SpriteAnimationController>(
    new SpriteAnimationController(initialCharacter, true)
  );

  // Sync controllers when character, animation, or source changes
  useEffect(() => {
    spriteSheetManager.preloadAll();
    const hdCtrl = new SpriteAnimationController(selectedChar, false);
    hdCtrl.setAnimation(selectedAnim, true);
    hdControllerRef.current = hdCtrl;

    const legCtrl = new SpriteAnimationController(selectedChar, true);
    legCtrl.setAnimation(selectedAnim, true);
    legacyControllerRef.current = legCtrl;
  }, [selectedChar, selectedAnim]);

  useEffect(() => {
    hdControllerRef.current.setPlaying(playing);
    hdControllerRef.current.setSpeed(speed);
    hdControllerRef.current.setFacingRight(facingRight);

    legacyControllerRef.current.setPlaying(playing);
    legacyControllerRef.current.setSpeed(speed);
    legacyControllerRef.current.setFacingRight(facingRight);
  }, [playing, speed, facingRight, selectedChar, selectedAnim]);

  // Single / Split-Compare Inspector Loop
  useEffect(() => {
    if (activeTab !== 'single' && activeTab !== 'compare') return;

    const tick = () => {
      const hdCtrl = hdControllerRef.current;
      const legCtrl = legacyControllerRef.current;
      hdCtrl.update(33);
      legCtrl.update(33);

      const activeCtrl = useLegacySource ? legCtrl : hdCtrl;
      const frame = activeCtrl.getCurrentFrame();
      const anim = activeCtrl.getCurrentAnimation();

      setHudFrameInfo({
        seqIndex: activeCtrl.getCurrentFrameSequenceIndex(),
        seqLength: anim.frames.length,
        frameId: frame.frameId,
        row: frame.row,
        col: frame.col,
        sourceX: frame.sourceX,
        sourceY: frame.sourceY,
        sourceWidth: frame.sourceWidth,
        sourceHeight: frame.sourceHeight,
        anchorX: frame.anchorX,
        footY: frame.footY,
        durationMs: frame.durationMs,
        sourceType: frame.sourceType,
      });

      const canvas =
        activeTab === 'compare'
          ? compareCanvasRef.current
          : singleCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Checkerboard transparency background
      if (showCheckerboard) {
        const tile = 20;
        for (let y = 0; y < h; y += tile) {
          for (let x = 0; x < w; x += tile) {
            ctx.fillStyle =
              (Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0
                ? '#18181b'
                : '#27272a';
            ctx.fillRect(x, y, tile, tile);
          }
        }
      } else {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, w, h);
      }

      const groundY = 335;

      // Common ground reference line
      ctx.save();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, groundY);
      ctx.lineTo(w - 20, groundY);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`GROUND_Y (${groundY}px)`, 24, groundY + 16);
      ctx.restore();

      const isSplitComparison =
        activeTab === 'compare' || splitCompareInSingle;

      if (isSplitComparison) {
        const leftX = Math.round(w * 0.27);
        const rightX = Math.round(w * 0.73);

        // Divider line
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(w / 2, 16);
        ctx.lineTo(w / 2, groundY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(
          'RESPALDO ORIGINAL (1254×1254 · 16 FOTOS)',
          leftX,
          26
        );
        ctx.fillStyle = '#4ade80';
        ctx.fillText(
          `NUEVO ATLAS HD (1536×1024 · ${HD_ATLAS_MANIFESTS[selectedChar].totalExtractedFrames} FOTOS)`,
          rightX,
          26
        );
        ctx.restore();

        // Left: Legacy 1254x1254
        renderSpriteFrame(
          ctx,
          selectedChar,
          legCtrl.getCurrentFrame(),
          leftX,
          groundY,
          facingRight,
          isAltPalette,
          {
            scaleMultiplier: 1,
            showShadow: true,
            groundY,
            forceLegacyFallback: true,
            debugOverlay: {
              showCellBounds: showBounds,
              showTightBbox: showBounds,
              showAnchorPoint: showAnchor,
            },
          }
        );

        // Right: New HD 1536x1024
        renderSpriteFrame(
          ctx,
          selectedChar,
          hdCtrl.getCurrentFrame(),
          rightX,
          groundY,
          facingRight,
          isAltPalette,
          {
            scaleMultiplier: 1,
            showShadow: true,
            groundY,
            forceLegacyFallback: false,
            debugOverlay: {
              showCellBounds: showBounds,
              showTightBbox: showBounds,
              showAnchorPoint: showAnchor,
            },
          }
        );
      } else {
        const centerX = Math.round(w / 2);

        renderSpriteFrame(
          ctx,
          selectedChar,
          frame,
          centerX,
          groundY,
          facingRight,
          isAltPalette,
          {
            scaleMultiplier: 1,
            showShadow: true,
            groundY,
            forceLegacyFallback: useLegacySource,
            debugOverlay: {
              showCellBounds: showBounds,
              showTightBbox: showBounds,
              showAnchorPoint: showAnchor,
            },
          }
        );

        // Draw combat Hurtboxes & Active Hitbox when toggled
        if (showHitboxes) {
          const dummy = createFighterRuntime(
            1,
            selectedChar,
            isAltPalette,
            false
          );
          dummy.x = centerX;
          dummy.y = groundY;
          dummy.facing = facingRight ? 1 : -1;
          dummy.crouching =
            selectedAnim === 'crouch' || selectedAnim === 'guardLow';

          const isAttackClip =
            selectedAnim === 'lightPunch' ||
            selectedAnim === 'heavyPunch' ||
            selectedAnim === 'lightKick' ||
            selectedAnim === 'heavyKick' ||
            selectedAnim === 'special1' ||
            selectedAnim === 'special2' ||
            selectedAnim === 'superAttack';

          if (isAttackClip) {
            dummy.state =
              selectedAnim === 'special1' || selectedAnim === 'special2'
                ? 'special'
                : selectedAnim === 'superAttack'
                  ? 'super'
                  : 'attacking';
            dummy.currentAttack =
              selectedAnim === 'lightPunch'
                ? 'lp'
                : selectedAnim === 'heavyPunch'
                  ? 'hp'
                  : selectedAnim === 'lightKick'
                    ? 'lk'
                    : selectedAnim === 'heavyKick'
                      ? 'hk'
                      : selectedAnim === 'special1'
                        ? 'special1'
                        : selectedAnim === 'special2'
                          ? 'special2'
                          : 'super';
            const move = CHARACTERS[selectedChar].moves[dummy.currentAttack];
            const seqIdx = activeCtrl.getCurrentFrameSequenceIndex();
            const seqLen = Math.max(1, anim.frames.length);
            const ratio = seqIdx / seqLen;
            if (ratio >= 0.25 && ratio <= 0.75) {
              dummy.stateFrame = move.startup;
            } else {
              dummy.stateFrame = 0;
            }
          }

          const hurtboxes = getFighterHurtboxes(dummy);
          ctx.save();
          ctx.strokeStyle = '#22c55e';
          ctx.fillStyle = 'rgba(34, 197, 94, 0.16)';
          ctx.lineWidth = 2;
          for (const hb of hurtboxes) {
            ctx.fillRect(hb.x, hb.y, hb.width, hb.height);
            ctx.strokeRect(hb.x, hb.y, hb.width, hb.height);
          }

          const activeHit = getActiveHitbox(dummy);
          if (activeHit) {
            ctx.strokeStyle = '#ef4444';
            ctx.fillStyle = 'rgba(239, 68, 68, 0.32)';
            ctx.fillRect(
              activeHit.x,
              activeHit.y,
              activeHit.width,
              activeHit.height
            );
            ctx.strokeRect(
              activeHit.x,
              activeHit.y,
              activeHit.width,
              activeHit.height
            );
          }
          ctx.restore();
        }
      }
    };

    tick();
    const timer = window.setInterval(tick, 33);
    return () => window.clearInterval(timer);
  }, [
    activeTab,
    selectedChar,
    selectedAnim,
    facingRight,
    isAltPalette,
    useLegacySource,
    splitCompareInSingle,
    showCheckerboard,
    showAnchor,
    showBounds,
    showHitboxes,
  ]);

  // 6-Character Common Ground Line Comparison Loop
  useEffect(() => {
    if (activeTab !== 'lineup') return;

    const controllers = CHARACTER_ORDER.map((id) => {
      const c = new SpriteAnimationController(id, false);
      c.setAnimation(lineupAnim, true);
      return c;
    });

    const tick = () => {
      const canvas = lineupCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const tile = 24;
      for (let y = 0; y < h; y += tile) {
        for (let x = 0; x < w; x += tile) {
          ctx.fillStyle =
            (Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0
              ? '#141418'
              : '#1f1f25';
          ctx.fillRect(x, y, tile, tile);
        }
      }

      const groundY = 338;
      const rulerHeights = [165, 220, 250, 290];
      ctx.save();
      ctx.font = '10px monospace';
      for (const rh of rulerHeights) {
        const ry = groundY - rh;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, ry);
        ctx.lineTo(w, ry);
        ctx.stroke();
        ctx.fillStyle = 'rgba(250, 204, 21, 0.75)';
        ctx.fillText(`${rh}px`, 8, ry - 3);
      }

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(w, groundY);
      ctx.stroke();
      ctx.restore();

      CHARACTER_ORDER.forEach((charId, idx) => {
        const ctrl = controllers[idx];
        ctrl.update(33);
        const frame = ctrl.getCurrentFrame();
        const hdManifest = HD_ATLAS_MANIFESTS[charId];
        const xPos = 95 + idx * 155;

        renderSpriteFrame(
          ctx,
          charId,
          frame,
          xPos,
          groundY,
          true,
          false,
          {
            scaleMultiplier: 1,
            showShadow: true,
            groundY,
            debugOverlay: {
              showAnchorPoint: true,
            },
          }
        );

        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(CHARACTERS[charId].shortName, xPos, groundY + 20);
        ctx.fillStyle = '#4ade80';
        ctx.font = '10px monospace';
        ctx.fillText(
          `HD ${hdManifest.totalExtractedFrames}f (esc ${hdManifest.uniformScale540p}x)`,
          xPos,
          groundY + 34
        );
        ctx.restore();
      });
    };

    tick();
    const timer = window.setInterval(tick, 33);
    return () => window.clearInterval(timer);
  }, [activeTab, lineupAnim]);

  const charCfg = SPRITE_SHEET_CONFIGS[selectedChar];
  const hdManifest = HD_ATLAS_MANIFESTS[selectedChar];
  const asset = spriteSheetManager.getAsset(selectedChar);

  return (
    <div
      data-testid="sprite-inspector-modal"
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-3 md:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-6xl bg-zinc-950 border-2 border-amber-400 p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-400 text-zinc-950 font-mono-num font-black text-[10px]">
                COMBAT ANIMATION SYSTEM 2.0
              </span>
              <h2 className="text-xl md:text-2xl font-arcade font-bold text-amber-400">
                ANIMATION LAB · INSPECTOR DE ATLAS HD Y SPRITES
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Inspección interactiva de las 6 nuevas hojas de animación HD (1536
              × 1024 px · 547 fotogramas totales · 25 estados por luchador) con
              comparador frente a los sprites originales de respaldo (1254 ×
              1254 px).
            </p>
          </div>
          <button
            type="button"
            data-testid="close-sprite-inspector"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-arcade font-bold text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
            CERRAR ANIMATION LAB
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="tab-single-inspector"
            onClick={() => setActiveTab('single')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-arcade font-bold border cursor-pointer ${
              activeTab === 'single'
                ? 'bg-amber-400 text-zinc-950 border-amber-200'
                : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <Layers className="w-4 h-4" />
            1. ANIMATION LAB (25 ESTADOS HD)
          </button>
          <button
            type="button"
            data-testid="tab-compare-inspector"
            onClick={() => setActiveTab('compare')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-arcade font-bold border cursor-pointer ${
              activeTab === 'compare'
                ? 'bg-amber-400 text-zinc-950 border-amber-200'
                : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <Columns className="w-4 h-4" />
            2. COMPARADOR: ORIGINAL vs ATLAS HD
          </button>
          <button
            type="button"
            data-testid="tab-lineup-inspector"
            onClick={() => setActiveTab('lineup')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-arcade font-bold border cursor-pointer ${
              activeTab === 'lineup'
                ? 'bg-amber-400 text-zinc-950 border-amber-200'
                : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <Users className="w-4 h-4" />
            3. ESCALA Y SUELO COMÚN (6 LUCHADORES)
          </button>
          <button
            type="button"
            data-testid="tab-missing-report"
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-arcade font-bold border cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-amber-400 text-zinc-950 border-amber-200'
                : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            4. AUDITORÍA VISUAL Y 25 CLIPS
          </button>
        </div>

        {/* TAB 1 & TAB 2: SINGLE FIGHTER INSPECTOR & SIDE-BY-SIDE COMPARATOR */}
        {(activeTab === 'single' || activeTab === 'compare') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Controls */}
            <div className="lg:col-span-4 space-y-3 bg-zinc-900/80 border border-zinc-800 p-3.5">
              <div>
                <label className="block text-xs font-mono-num text-amber-400 font-bold mb-1.5">
                  SELECCIONAR PERSONAJE (6 ATLAS HD):
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CHARACTER_ORDER.map((id) => (
                    <button
                      key={id}
                      type="button"
                      data-testid={`animlab-char-${id}`}
                      onClick={() => setSelectedChar(id)}
                      className={`px-2.5 py-1.5 text-left text-xs font-arcade font-bold border cursor-pointer truncate ${
                        selectedChar === id
                          ? 'bg-amber-400 text-zinc-950 border-amber-200'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      {CHARACTERS[id].shortName}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono-num text-amber-400 font-bold mb-1.5">
                  ANIMACIÓN ({ALL_25_HD_ANIMATION_STATES.length} ESTADOS HD):
                </label>
                <select
                  data-testid="animlab-state-select"
                  value={selectedAnim}
                  onChange={(e) =>
                    setSelectedAnim(e.target.value as HdAnimationStateName)
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 px-2.5 py-2 text-xs text-white font-mono-num"
                >
                  {ALL_25_HD_ANIMATION_STATES.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.category}] {a.label} (
                      {hdManifest.clips[a.id].frames.length}f)
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Switcher: HD Atlas vs Legacy Backup vs Split Compare */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                <div className="text-xs font-mono-num text-zinc-400">
                  FUENTE GRÁFICA ACTIVA:
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setUseLegacySource(false);
                      setSplitCompareInSingle(false);
                    }}
                    className={`px-2 py-1.5 text-xs font-arcade font-bold border cursor-pointer ${
                      !useLegacySource && !splitCompareInSingle
                        ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                    }`}
                  >
                    ★ ATLAS HD NUEVO
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseLegacySource(true);
                      setSplitCompareInSingle(false);
                    }}
                    className={`px-2 py-1.5 text-xs font-arcade font-bold border cursor-pointer ${
                      useLegacySource && !splitCompareInSingle
                        ? 'bg-sky-400 text-zinc-950 border-sky-200'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                    }`}
                  >
                    RESPALDO 4×4
                  </button>
                </div>
                <button
                  type="button"
                  data-testid="toggle-split-compare"
                  onClick={() => setSplitCompareInSingle((s) => !s)}
                  className={`w-full py-1.5 px-2.5 text-xs font-arcade font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                    splitCompareInSingle || activeTab === 'compare'
                      ? 'bg-amber-400 text-zinc-950 border-amber-200'
                      : 'bg-zinc-950 text-amber-300 border-amber-400/50'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  COMPARAR LADO A LADO (ORIGINAL vs HD)
                </button>
              </div>

              {/* Playback & Frame Stepping */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="text-xs font-mono-num text-zinc-400">
                  CONTROL DE REPRODUCCIÓN Y FOTOGRAMAS:
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="animlab-step-prev"
                    onClick={() => {
                      setPlaying(false);
                      hdControllerRef.current.setPlaying(false);
                      hdControllerRef.current.stepBackward();
                      legacyControllerRef.current.setPlaying(false);
                      legacyControllerRef.current.stepBackward();
                    }}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-xs font-arcade font-bold text-zinc-200 cursor-pointer"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                    -1
                  </button>
                  <button
                    type="button"
                    data-testid="animlab-play-pause"
                    onClick={() => setPlaying((p) => !p)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-arcade font-bold cursor-pointer"
                  >
                    {playing ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        PAUSAR
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        PLAY
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    data-testid="animlab-step-next"
                    onClick={() => {
                      setPlaying(false);
                      hdControllerRef.current.setPlaying(false);
                      hdControllerRef.current.stepForward();
                      legacyControllerRef.current.setPlaying(false);
                      legacyControllerRef.current.stepForward();
                    }}
                    className="flex-1 flex items-center justify-center gap-1 py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-xs font-arcade font-bold text-zinc-200 cursor-pointer"
                  >
                    +1
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Speed Selector */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  <span className="text-xs text-zinc-400">Velocidad:</span>
                  {[0.25, 0.5, 1, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      className={`px-2 py-1 text-[11px] font-mono-num border cursor-pointer ${
                        speed === s
                          ? 'bg-amber-400 text-zinc-950 border-amber-200 font-bold'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-800'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Debug Toggles */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                <div className="text-xs font-mono-num text-zinc-400">
                  CAPAS DE INSPECCIÓN TÉCNICA:
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFacingRight((f) => !f)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-700 text-zinc-200 cursor-pointer"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    {facingRight ? 'Dir: Derecha' : 'Dir: Izquierda'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAltPalette((p) => !p)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-zinc-950 border border-zinc-700 text-zinc-200 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    {isAltPalette ? 'Paleta 2P' : 'Paleta 1P'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCheckerboard((c) => !c)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border cursor-pointer ${
                      showCheckerboard
                        ? 'bg-zinc-800 border-amber-400 text-amber-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    Transparencia
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAnchor((a) => !a)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border cursor-pointer ${
                      showAnchor
                        ? 'bg-zinc-800 border-rose-400 text-rose-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    Ancla Pies
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBounds((b) => !b)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border cursor-pointer ${
                      showBounds
                        ? 'bg-zinc-800 border-sky-400 text-sky-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    BBox Recorte
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHitboxes((h) => !h)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border cursor-pointer ${
                      showHitboxes
                        ? 'bg-zinc-800 border-emerald-400 text-emerald-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    Hit/Hurtboxes
                  </button>
                </div>
              </div>
            </div>

            {/* Center & Right: Live Canvas + Telemetry */}
            <div className="lg:col-span-8 space-y-3">
              <div className="relative bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden">
                <canvas
                  ref={
                    activeTab === 'compare'
                      ? compareCanvasRef
                      : singleCanvasRef
                  }
                  width={680}
                  height={380}
                  className="w-full h-auto max-h-96 object-contain"
                />
              </div>

              {/* Real-Time Frame & Asset Diagnostics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono-num bg-zinc-900/90 border border-zinc-800 p-3">
                <div>
                  <span className="text-zinc-400 block">Atlas HD Activo:</span>
                  <span className="text-emerald-400 font-bold truncate block">
                    {hdManifest.atlasPath}
                  </span>
                  <span className="text-zinc-300">
                    {asset.hdNaturalWidth || 1536} ×{' '}
                    {asset.hdNaturalHeight || 1024} px ({asset.hdStatus})
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">
                    Fotograma Extraído:
                  </span>
                  <span className="text-amber-300 font-bold">
                    ID {hudFrameInfo.frameId} (Paso{' '}
                    {hudFrameInfo.seqIndex + 1}/{hudFrameInfo.seqLength})
                  </span>
                  <span className="text-zinc-300 block">
                    src: ({hudFrameInfo.sourceX}, {hudFrameInfo.sourceY}){' '}
                    {hudFrameInfo.sourceWidth}×{hudFrameInfo.sourceHeight} px
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">
                    Anclaje y Duración:
                  </span>
                  <span className="text-rose-300 font-bold">
                    Ancla: ({hudFrameInfo.anchorX}, {hudFrameInfo.footY})
                  </span>
                  <span className="text-zinc-300 block">
                    Duración: {hudFrameInfo.durationMs} ms · Fila{' '}
                    {hudFrameInfo.row + 1}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">
                    Respaldo Original:
                  </span>
                  <span className="text-sky-300 font-bold truncate block">
                    {charCfg.assetPath}
                  </span>
                  <span className="text-zinc-300 block">
                    Escala HD: {hdManifest.uniformScale540p}x ({asset.status})
                  </span>
                </div>
              </div>

              {/* Visual Audit & Status Badge Banner */}
              <div className="p-3 border bg-emerald-950/35 border-emerald-500/60 text-xs space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-arcade font-bold text-white">
                      {CHARACTERS[selectedChar].name} ·{' '}
                      {hdManifest.totalExtractedFrames} FOTOGRAMAS HD EXTRAÍDOS (
                      {hdManifest.rowCount} FILAS)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-emerald-400 text-zinc-950 font-mono-num font-bold text-[10px]">
                      HD NUEVA ({hdManifest.clips[selectedAnim].frames.length}{' '}
                      FRAMES)
                    </span>
                    <span className="px-2 py-0.5 bg-sky-400 text-zinc-950 font-mono-num font-bold text-[10px]">
                      RESPALDO: INTACTO
                    </span>
                  </div>
                </div>
                <p className="text-zinc-300 leading-relaxed">
                  <strong>Auditoría Visual:</strong> {hdManifest.auditNotes}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 6-FIGHTER COMMON GROUND LINE COMPARISON */}
        {activeTab === 'lineup' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-900 border border-zinc-800 p-3">
              <div className="text-xs text-zinc-300">
                <strong>Prueba Visual de Escala y Suelo Común:</strong> Los 6
                luchadores renderizados con sus nuevos Atlas HD sobre{' '}
                <code>GROUND_Y</code> respetando proporciones físicas (Patova
                Marcelo 1.82x el más corpulento; The Litlle Rag 1.32x el más
                bajo).
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['idle', 'Idle HD'],
                    ['walkForward', 'Caminar HD'],
                    ['heavyPunch', 'Puño Fuerte HD'],
                    ['heavyKick', 'Patada Fuerte HD'],
                    ['special1', 'Especial 1 HD'],
                    ['superAttack', 'Super HD'],
                    ['knockdown', 'Derribo HD'],
                    ['victory', 'Victoria HD'],
                  ] as const
                ).map(([animId, label]) => (
                  <button
                    key={animId}
                    type="button"
                    onClick={() => setLineupAnim(animId)}
                    className={`px-2.5 py-1.5 text-xs font-arcade font-bold border cursor-pointer ${
                      lineupAnim === animId
                        ? 'bg-amber-400 text-zinc-950 border-amber-200'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 overflow-hidden">
              <canvas
                ref={lineupCanvasRef}
                width={960}
                height={385}
                className="w-full h-auto block"
              />
            </div>
          </div>
        )}

        {/* TAB 4: VISUAL AUDIT & 25 ANIMATION STATES MATRIX */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CHARACTER_ORDER.map((cid) => {
                const m = HD_ATLAS_MANIFESTS[cid];
                return (
                  <div
                    key={cid}
                    className="p-3 bg-zinc-900 border border-zinc-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-arcade font-bold text-amber-400 text-sm">
                        {CHARACTERS[cid].name}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-400 text-zinc-950 font-mono-num font-bold text-[10px]">
                        {m.totalExtractedFrames} FOTOS HD · {m.rowCount} FILAS
                      </span>
                    </div>
                    <div className="text-zinc-400 font-mono-num text-[11px]">
                      Atlas HD: <code>{m.atlasPath}</code> | Respaldo:{' '}
                      <code>{m.fallbackSheetPath}</code>
                    </div>
                    <p className="text-zinc-300 leading-relaxed">
                      {m.auditNotes}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-3">
              <h3 className="text-xs font-arcade font-bold text-amber-400 mb-2">
                MATRIZ DE LOS 25 ESTADOS DE ANIMACIÓN HD ({CHARACTERS[selectedChar].shortName})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-60 overflow-y-auto pr-1">
                {ALL_25_HD_ANIMATION_STATES.map((st) => {
                  const clip = hdManifest.clips[st.id];
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        setSelectedAnim(st.id);
                        setActiveTab('single');
                      }}
                      className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-left text-xs cursor-pointer space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono-num font-bold text-white truncate">
                          {st.id}
                        </span>
                        <span className="px-1.5 py-0.5 bg-emerald-400 text-zinc-950 font-mono-num font-bold text-[9px]">
                          HD ({clip.frames.length}f)
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {st.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
