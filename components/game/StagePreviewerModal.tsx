'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  X,
  Eye,
  Layers,
  MoveHorizontal,
  Music,
  Sparkles,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { CHARACTERS, CHARACTER_ORDER } from '@/lib/game/characters';
import {
  GROUND_Y,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  STAGE_WIDTH,
} from '@/lib/game/rules';
import {
  STAGE_REGISTRY,
  stageAssetManager,
  stageCharacterMap,
} from '@/lib/game/stageData';
import { renderStageBackground } from '@/lib/game/stages';
import {
  AnimationName,
  SpriteAnimationController,
  spriteSheetManager,
} from '@/lib/game/spriteEngine';
import { renderSpriteFrame } from '@/lib/game/sprites';
import { arcadeAudio } from '@/lib/game/audio';
import { CharacterId } from '@/lib/game/types';

export interface StagePreviewerModalProps {
  initialStage?: CharacterId;
  onSelectStageForMatch?: (stageId: CharacterId) => void;
  onClose: () => void;
}

export function StagePreviewerModal({
  initialStage = 'mostasa',
  onSelectStageForMatch,
  onClose,
}: StagePreviewerModalProps) {
  const [stageId, setStageId] = useState<CharacterId>(initialStage);
  const [p1Char, setP1Char] = useState<CharacterId>(initialStage);
  const [p2Char, setP2Char] = useState<CharacterId>(
    initialStage === 'patova' ? 'mostasa' : 'patova'
  );
  const [testPose, setTestPose] = useState<AnimationName>('idle');

  // Layer toggles (Section 11 & 20)
  const [showFarLayer, setShowFarLayer] = useState<boolean>(true);
  const [showMidLayer, setShowMidLayer] = useState<boolean>(true);
  const [showNearLayer, setShowNearLayer] = useState<boolean>(true);
  const [showFloorLayer, setShowFloorLayer] = useState<boolean>(true);
  const [showAmbientEffects, setShowAmbientEffects] = useState<boolean>(true);

  // Camera & diagnostic toggles (Section 20)
  const [enableParallax, setEnableParallax] = useState<boolean>(true);
  const [showFullFrame, setShowFullFrame] = useState<boolean>(false);
  const [showFloorLine, setShowFloorLine] = useState<boolean>(true);
  const [showStageBounds, setShowStageBounds] = useState<boolean>(true);
  const [showTestFighters, setShowTestFighters] = useState<boolean>(true);
  const [cameraX, setCameraX] = useState<number>(
    (STAGE_WIDTH - LOGICAL_WIDTH) / 2
  );
  const [autoPanCamera, setAutoPanCamera] = useState<boolean>(false);
  const [readyCount, setReadyCount] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number>(0);
  const p1CtrlRef = useRef<SpriteAnimationController>(
    new SpriteAnimationController(p1Char)
  );
  const p2CtrlRef = useRef<SpriteAnimationController>(
    new SpriteAnimationController(p2Char)
  );

  useEffect(() => {
    stageAssetManager.preloadAll();
    spriteSheetManager.preloadAll();
    const sync = () => {
      setReadyCount(stageAssetManager.getReadyCount());
    };
    const tId = window.setTimeout(sync, 0);
    const unsub = stageAssetManager.subscribe(sync);
    return () => {
      window.clearTimeout(tId);
      unsub();
    };
  }, []);

  useEffect(() => {
    const ctrl = new SpriteAnimationController(p1Char);
    ctrl.setAnimation(testPose, true);
    p1CtrlRef.current = ctrl;
  }, [p1Char, testPose]);

  useEffect(() => {
    const ctrl = new SpriteAnimationController(p2Char);
    ctrl.setAnimation(testPose, true);
    p2CtrlRef.current = ctrl;
  }, [p2Char, testPose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let rafId = 0;
    const maxCamX = STAGE_WIDTH - LOGICAL_WIDTH; // 320

    const renderLoop = () => {
      frameRef.current += 1;
      const f = frameRef.current;

      let activeCamX = cameraX;
      if (autoPanCamera && !showFullFrame) {
        activeCamX =
          maxCamX / 2 + Math.sin(f * 0.025) * (maxCamX / 2);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

          // 1. Render Stage with selected layer & debug flags
          renderStageBackground(ctx, stageId, activeCamX, f, false, {
            showFarLayer,
            showMidLayer,
            showNearLayer,
            showFloorLayer,
            showAmbientEffects,
            enableParallax,
            showFullFrame,
            showFloorLine,
            showStageBounds,
          });

          // 2. Render Two Test Fighters using their official 1254x1254 PNG sprites
          if (showTestFighters) {
            p1CtrlRef.current.update(1000 / 60);
            p2CtrlRef.current.update(1000 / 60);

            const p1WorldX = 450;
            const p2WorldX = 830;
            const p1ScreenX = showFullFrame
              ? 310
              : p1WorldX - activeCamX;
            const p2ScreenX = showFullFrame
              ? 650
              : p2WorldX - activeCamX;

            renderSpriteFrame(
              ctx,
              p1Char,
              p1CtrlRef.current.getCurrentFrame(),
              p1ScreenX,
              GROUND_Y,
              true,
              false,
              {
                showShadow: true,
                groundY: GROUND_Y,
                debugOverlay: {
                  showAnchorPoint: showFloorLine,
                },
              }
            );

            renderSpriteFrame(
              ctx,
              p2Char,
              p2CtrlRef.current.getCurrentFrame(),
              p2ScreenX,
              GROUND_Y,
              false,
              p1Char === p2Char,
              {
                showShadow: true,
                groundY: GROUND_Y,
                debugOverlay: {
                  showAnchorPoint: showFloorLine,
                },
              }
            );
          }
        }
      }

      rafId = window.requestAnimationFrame(renderLoop);
    };

    rafId = window.requestAnimationFrame(renderLoop);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    autoPanCamera,
    cameraX,
    enableParallax,
    p1Char,
    p2Char,
    showAmbientEffects,
    showFarLayer,
    showFloorLayer,
    showFloorLine,
    showFullFrame,
    showMidLayer,
    showNearLayer,
    showStageBounds,
    showTestFighters,
    stageId,
  ]);

  const currentStage = STAGE_REGISTRY[stageId];
  const maxCamX = STAGE_WIDTH - LOGICAL_WIDTH;

  const handleSelectStage = (id: CharacterId) => {
    setStageId(id);
    setP1Char(id);
    setP2Char(id === 'patova' ? 'mostasa' : 'patova');
    if (onSelectStageForMatch) {
      onSelectStageForMatch(id);
    }
  };

  return (
    <div
      data-testid="stage-previewer-modal"
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-3 md:p-5 overflow-y-auto"
    >
      <div className="w-full max-w-6xl bg-zinc-900 border-2 border-amber-400 p-4 md:p-5 space-y-4 my-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl md:text-2xl font-arcade font-bold text-amber-400">
                PREVISUALIZADOR DE ESCENARIOS · 6 FONDOS OFICIALES (1920×1080)
              </h2>
            </div>
            <p className="text-xs text-zinc-400 font-mono-num">
              {readyCount}/6 escenarios multicapa listos · Registro:{' '}
              <span className="text-emerald-400">
                {stageCharacterMap[stageId]}
              </span>{' '}
              · Suelo: Y={GROUND_Y}px · Mundo: {STAGE_WIDTH}×{LOGICAL_HEIGHT}px
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => arcadeAudio.playTrack(stageId, true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400 text-amber-300 text-xs font-arcade font-bold cursor-pointer whitespace-nowrap"
            >
              <Music className="w-3.5 h-3.5" />
              ESCUCHAR TEMA: {currentStage.musicTitle.toUpperCase()}
            </button>
            <button
              type="button"
              data-testid="close-stage-previewer"
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-arcade font-bold cursor-pointer whitespace-nowrap"
            >
              <X className="w-4 h-4" />
              CERRAR (ESC)
            </button>
          </div>
        </div>

        {/* Stage Selector Tabs (6 Official Stages) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {CHARACTER_ORDER.map((id) => {
            const st = STAGE_REGISTRY[id];
            const active = stageId === id;
            return (
              <button
                key={id}
                type="button"
                data-testid={`preview-stage-${st.id}`}
                onClick={() => handleSelectStage(id)}
                className={`p-2 text-left border transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-400 text-zinc-950 border-amber-200'
                    : 'bg-zinc-950 text-zinc-200 border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <div className="text-xs font-arcade font-bold truncate">
                  {st.name}
                </div>
                <div
                  className={`text-[10px] truncate ${
                    active ? 'text-zinc-900 font-semibold' : 'text-zinc-400'
                  }`}
                >
                  {CHARACTERS[id].shortName} · {st.setting}
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Grid: Live 960x540 Stage Canvas + Layer & Camera Inspector Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left 8 Cols: Live 960x540 Stage Canvas */}
          <div className="lg:col-span-8 space-y-2">
            <div className="relative w-full aspect-video bg-zinc-950 border-2 border-zinc-800 overflow-hidden">
              <canvas
                ref={canvasRef}
                data-testid="stage-preview-canvas"
                width={LOGICAL_WIDTH}
                height={LOGICAL_HEIGHT}
                className="w-full h-full object-contain"
              />
              <div className="pointer-events-none absolute top-2 left-2 right-2 flex items-center justify-between text-[11px] font-mono-num bg-black/75 px-2.5 py-1 border border-zinc-700 text-zinc-200">
                <span>
                  <strong className="text-amber-400">{currentStage.name}</strong>{' '}
                  ({currentStage.id}) · {currentStage.location}
                </span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  1920×1080 PNG + 4 CAPAS RGBA
                </span>
              </div>
            </div>

            {/* Camera X Pan Slider */}
            <div className="bg-zinc-950 border border-zinc-800 p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <MoveHorizontal className="w-4 h-4 text-amber-400" />
                <span className="font-mono-num text-zinc-300">
                  Desplazamiento Cámara X: {Math.round(cameraX)}px / {maxCamX}px
                </span>
              </div>

              <div className="flex items-center gap-3 flex-1 max-w-md">
                <input
                  type="range"
                  min={0}
                  max={maxCamX}
                  value={cameraX}
                  disabled={showFullFrame}
                  onChange={(e) => {
                    setAutoPanCamera(false);
                    setCameraX(Number(e.target.value));
                  }}
                  className="flex-1 accent-amber-400"
                />
                <button
                  type="button"
                  data-testid="toggle-auto-pan"
                  onClick={() => setAutoPanCamera((prev) => !prev)}
                  className={`px-3 py-1 text-xs font-arcade font-bold border cursor-pointer whitespace-nowrap ${
                    autoPanCamera
                      ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                  }`}
                >
                  {autoPanCamera ? 'AUTO-PAN: ON' : 'AUTO-PAN: OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* Right 4 Cols: Layer Toggles, Debug Lines & Fighter Scale Verification */}
          <div className="lg:col-span-4 bg-zinc-950 border border-zinc-800 p-3.5 space-y-3 text-xs">
            <div className="font-arcade font-bold text-sm text-amber-400 border-b border-zinc-800 pb-1.5 flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              SISTEMA DE CAPAS Y PARALLAX
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {(
                [
                  [
                    'CAPA 1: BACKGROUND FAR (0.28x)',
                    showFarLayer,
                    () => setShowFarLayer((v) => !v),
                  ],
                  [
                    'CAPA 2: BACKGROUND MID (0.56x)',
                    showMidLayer,
                    () => setShowMidLayer((v) => !v),
                  ],
                  [
                    'CAPA 3: BACKGROUND NEAR (0.82x)',
                    showNearLayer,
                    () => setShowNearLayer((v) => !v),
                  ],
                  [
                    'CAPA 4: FIGHT FLOOR (1.00x)',
                    showFloorLayer,
                    () => setShowFloorLayer((v) => !v),
                  ],
                  [
                    'CAPA 5: AMBIENT EFFECTS',
                    showAmbientEffects,
                    () => setShowAmbientEffects((v) => !v),
                  ],
                ] as const
              ).map(([label, enabled, toggle]) => (
                <button
                  key={label}
                  type="button"
                  onClick={toggle}
                  className={`flex items-center justify-between px-2.5 py-1.5 border font-mono-num text-[11px] cursor-pointer ${
                    enabled
                      ? 'bg-emerald-950/50 border-emerald-500/70 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}
                >
                  <span>{label}</span>
                  <span className="font-bold">{enabled ? 'ON' : 'OFF'}</span>
                </button>
              ))}
            </div>

            <div className="font-arcade font-bold text-sm text-amber-400 border-b border-zinc-800 pb-1.5 pt-1 flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              DIAGNÓSTICO DE COMBATE Y CÁMARA
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setShowFullFrame((v) => !v)}
                className={`px-2 py-1.5 border font-arcade font-bold text-[11px] cursor-pointer whitespace-nowrap ${
                  showFullFrame
                    ? 'bg-amber-400 text-zinc-950 border-amber-200'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                }`}
              >
                {showFullFrame ? 'FONDO 100%' : 'VISTA CÁMARA'}
              </button>
              <button
                type="button"
                onClick={() => setEnableParallax((v) => !v)}
                className={`px-2 py-1.5 border font-arcade font-bold text-[11px] cursor-pointer whitespace-nowrap ${
                  enableParallax
                    ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                }`}
              >
                PARALLAX: {enableParallax ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                onClick={() => setShowFloorLine((v) => !v)}
                className={`px-2 py-1.5 border font-arcade font-bold text-[11px] cursor-pointer whitespace-nowrap ${
                  showFloorLine
                    ? 'bg-amber-400 text-zinc-950 border-amber-200'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                }`}
              >
                SUELO: {showFloorLine ? 'VISIBLE' : 'OCULTO'}
              </button>
              <button
                type="button"
                onClick={() => setShowStageBounds((v) => !v)}
                className={`px-2 py-1.5 border font-arcade font-bold text-[11px] cursor-pointer whitespace-nowrap ${
                  showStageBounds
                    ? 'bg-sky-400 text-zinc-950 border-sky-200'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                }`}
              >
                LÍMITES: {showStageBounds ? 'VISIBLE' : 'OCULTO'}
              </button>
            </div>

            {/* Test Fighters & Scale Verification */}
            <div className="font-arcade font-bold text-sm text-amber-400 border-b border-zinc-800 pb-1.5 pt-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                LUCHADORES DE PRUEBA
              </span>
              <button
                type="button"
                onClick={() => setShowTestFighters((v) => !v)}
                className={`px-2 py-0.5 text-[10px] border cursor-pointer ${
                  showTestFighters
                    ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                }`}
              >
                {showTestFighters ? 'MOSTRANDO' : 'OCULTOS'}
              </button>
            </div>

            {showTestFighters && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">
                      Personaje Izquierda (P1)
                    </label>
                    <select
                      value={p1Char}
                      onChange={(e) => setP1Char(e.target.value as CharacterId)}
                      className="w-full bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs text-amber-300"
                    >
                      {CHARACTER_ORDER.map((cid) => (
                        <option key={cid} value={cid}>
                          {CHARACTERS[cid].shortName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">
                      Personaje Derecha (P2)
                    </label>
                    <select
                      value={p2Char}
                      onChange={(e) => setP2Char(e.target.value as CharacterId)}
                      className="w-full bg-zinc-900 border border-zinc-700 px-2 py-1 text-xs text-sky-300"
                    >
                      {CHARACTER_ORDER.map((cid) => (
                        <option key={cid} value={cid}>
                          {CHARACTERS[cid].shortName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ['idle', 'Guardia'],
                      ['walkForward', 'Caminar'],
                      ['heavyPunch', 'Puño'],
                      ['heavyKick', 'Patada'],
                    ] as const
                  ).map(([anim, label]) => (
                    <button
                      key={anim}
                      type="button"
                      onClick={() => setTestPose(anim)}
                      className={`flex-1 py-1 text-[10px] font-arcade font-bold border cursor-pointer ${
                        testPose === anim
                          ? 'bg-amber-400 text-zinc-950 border-amber-200'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ambient effects list for active stage */}
            <div className="pt-1 border-t border-zinc-800 space-y-1">
              <div className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Efectos Ambientales Activos:
              </div>
              <div className="text-[10px] font-mono-num text-zinc-400 leading-relaxed">
                {currentStage.ambientEffects.join(' · ')}
              </div>
            </div>
          </div>
        </div>

        {/* 6-Stage Visual Gallery Strip for Quick Evaluation */}
        <div className="border-t border-zinc-800 pt-3">
          <div className="text-xs font-arcade font-bold text-zinc-300 mb-2">
            GALERÍA DE LOS 6 ESCENARIOS OFICIALES (CLICK PARA INSPECCIONAR):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {CHARACTER_ORDER.map((id) => {
              const st = STAGE_REGISTRY[id];
              const active = stageId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectStage(id)}
                  className={`group text-left border-2 overflow-hidden bg-zinc-950 transition-all cursor-pointer ${
                    active
                      ? 'border-amber-400 shadow-[0_0_14px_rgba(250,204,21,0.35)]'
                      : 'border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="relative w-full aspect-video bg-zinc-900 overflow-hidden">
                    <Image
                      src={st.backgroundUrl}
                      alt={st.name}
                      fill
                      sizes="240px"
                      referrerPolicy="no-referrer"
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <div className="p-1.5">
                    <div className="text-[11px] font-arcade font-bold text-amber-300 truncate">
                      {st.name}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {CHARACTERS[id].shortName} · ♪ {st.musicTitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StagePreviewerModal;
