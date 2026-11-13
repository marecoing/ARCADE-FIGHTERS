'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  Crosshair,
  Music,
  Maximize2,
  Layers,
} from 'lucide-react';
import { CHARACTERS, CHARACTER_ORDER } from '@/lib/game/characters';
import {
  createEmptyInputSnapshot,
  createInitialMatchState,
  FPS,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  stepMatchSimulation,
} from '@/lib/game/rules';
import { computeAiInput } from '@/lib/game/ai';
import { renderMatchCanvas } from '@/lib/game/sprites';
import { arcadeAudio } from '@/lib/game/audio';
import {
  CharacterId,
  DifficultyLevel,
  GameMode,
  GameOptions,
  InputSnapshot,
  MatchSimulationState,
  ScreenState,
  TrainingSettings,
} from '@/lib/game/types';
import {
  CharacterPortrait,
  FighterPreviewCanvas,
} from './CharacterPortrait';
import { CharacterSelect } from './CharacterSelect';
import { VersusTransition } from './VersusTransition';
import { SpriteInspectorModal } from './SpriteInspectorModal';
import { SoundTestModal } from './SoundTestModal';
import { StagePreviewerModal } from './StagePreviewerModal';
import { TitleScreen } from './TitleScreen';
import { MainMenu } from './MainMenu';
import { MainMenuOptionId } from '@/lib/game/menuOptions';
import {
  resolveCombatSpriteFrame,
  spriteSheetManager,
} from '@/lib/game/spriteEngine';
import { STAGE_REGISTRY, stageAssetManager } from '@/lib/game/stageData';
import { METAL_SOUNDTRACK } from '@/lib/game/metalSongs';

const DEFAULT_OPTIONS: GameOptions = {
  musicVolume: 65,
  sfxVolume: 80,
  musicEnabled: true,
  sfxEnabled: true,
  chipMode8Bit: 'metal_overdrive',
  dynamicMusicIntensity: true,
  difficulty: 'NORMAL',
  roundsToWin: 2,
  scanlines: true,
  cameraShake: true,
  showHitboxes: false,
  muted: false,
};

const DEFAULT_TRAINING: TrainingSettings = {
  dummyBehavior: 'stand',
  infiniteHp: true,
  infiniteMeter: true,
  showHitboxes: false,
  showFrameData: true,
};

interface HudSnapshot {
  p1Hp: number;
  p1TrailingHp: number;
  p1Meter: number;
  p1Rounds: number;
  p1Combo: number;
  p1State: string;
  p2Hp: number;
  p2TrailingHp: number;
  p2Meter: number;
  p2Rounds: number;
  p2Combo: number;
  p2State: string;
  timerSeconds: number;
  roundNumber: number;
  lastMoveText: string;
  fps: number;
  inputHistory: string;
  frameDataInfo: {
    moveName: string;
    startup: number;
    active: number;
    recovery: number;
    frameAdvantage: number;
    scalingPercent: number;
    hitDamage: number;
    comboDamage: number;
    isCounter: boolean;
    isPunish: boolean;
  } | null;
}

function formatInputHistoryStream(
  buffer: MatchSimulationState['p1']['inputBuffer']
): string {
  const dirArrow: Record<string, string> = {
    U: '↑',
    D: '↓',
    B: '←',
    F: '→',
    UB: '↖',
    UF: '↗',
    DB: '↙',
    DF: '↘',
    N: '·',
  };
  const tokens: string[] = [];
  let lastToken = '';
  for (const entry of buffer) {
    const d = entry.dir !== 'N' ? dirArrow[entry.dir] || entry.dir : '';
    const pressedBtns: string[] = [];
    if (entry.lp) pressedBtns.push('LP');
    if (entry.hp) pressedBtns.push('HP');
    if (entry.lk) pressedBtns.push('LK');
    if (entry.hk) pressedBtns.push('HK');
    if (entry.grab) pressedBtns.push('GRAB');
    if (entry.special1) pressedBtns.push('SP1');
    if (entry.special2) pressedBtns.push('SP2');
    if (entry.special3) pressedBtns.push('SP3');
    if (entry.superBtn) pressedBtns.push('SUPER');

    const btns = pressedBtns.join('+');
    const combined = [d, btns].filter(Boolean).join('');
    if (combined && combined !== lastToken) {
      tokens.push(combined);
      lastToken = combined;
    }
  }
  return tokens.slice(-8).join(' ') || 'NEUTRAL';
}

export default function ArcadeFightersGame() {
  const [screen, setScreen] = useState<ScreenState>('title');
  const [gameMode, setGameMode] = useState<GameMode>('arcade');
  const [p1Char, setP1Char] = useState<CharacterId>('mostasa');
  const [p2Char, setP2Char] = useState<CharacterId>('patova');
  const [selectedStage, setSelectedStage] = useState<CharacterId>('patova');
  const [selectingSlot, setSelectingSlot] = useState<1 | 2>(1);
  const [arcadeStageIdx, setArcadeStageIdx] = useState<number>(0);
  const [arcadeLadder, setArcadeLadder] = useState<CharacterId[]>([
    'braian',
    'rag',
    'jenny',
    'patova',
    'alien',
  ]);
  const [options, setOptions] = useState<GameOptions>(DEFAULT_OPTIONS);
  const [training, setTraining] = useState<TrainingSettings>(DEFAULT_TRAINING);
  const [showSpriteInspector, setShowSpriteInspector] =
    useState<boolean>(false);
  const [showSoundTest, setShowSoundTest] = useState<boolean>(false);
  const [showStagePreviewer, setShowStagePreviewer] =
    useState<boolean>(false);
  const [mainMenuInitialIndex, setMainMenuInitialIndex] = useState<number>(0);
  const [spritesReadyCount, setSpritesReadyCount] = useState<number>(0);
  const [spriteErrors, setSpriteErrors] = useState<string[]>([]);
  const [stagesReadyCount, setStagesReadyCount] = useState<number>(0);
  const [stageErrors, setStageErrors] = useState<string[]>([]);
  const [matchSummary, setMatchSummary] = useState<{
    winner: 1 | 2;
    p1Rounds: number;
    p2Rounds: number;
    maxCombo: number;
    totalDamage: number;
    timeRemaining: number;
  } | null>(null);

  const [hud, setHud] = useState<HudSnapshot>({
    p1Hp: 1000,
    p1TrailingHp: 1000,
    p1Meter: 0,
    p1Rounds: 0,
    p1Combo: 0,
    p1State: 'idle',
    p2Hp: 1000,
    p2TrailingHp: 1000,
    p2Meter: 0,
    p2Rounds: 0,
    p2Combo: 0,
    p2State: 'idle',
    timerSeconds: 99,
    roundNumber: 1,
    lastMoveText: '',
    fps: 60,
    inputHistory: 'NEUTRAL',
    frameDataInfo: null,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simStateRef = useRef<MatchSimulationState | null>(null);
  const keysHeldRef = useRef<Set<string>>(new Set());
  const keysJustPressedRef = useRef<Set<string>>(new Set());
  const virtualButtonsRef = useRef<Set<string>>(new Set());
  const optionsRef = useRef<GameOptions>(options);
  const trainingRef = useRef<TrainingSettings>(training);
  const screenRef = useRef<ScreenState>(screen);
  const gameModeRef = useRef<GameMode>(gameMode);
  const lastAnnouncedRef = useRef<string>('');

  useEffect(() => {
    optionsRef.current = options;
    arcadeAudio.setVolumes(
      options.musicVolume,
      options.sfxVolume,
      options.muted,
      {
        musicEnabled: options.musicEnabled,
        sfxEnabled: options.sfxEnabled,
        chipMode8Bit: options.chipMode8Bit,
        dynamicMusicIntensity: options.dynamicMusicIntensity,
      }
    );
    try {
      localStorage.setItem('arcade_fighters_96_options', JSON.stringify(options));
    } catch {
      // Ignore storage error
    }
  }, [options]);

  useEffect(() => {
    trainingRef.current = training;
  }, [training]);

  useEffect(() => {
    screenRef.current = screen;
    // Sync document.body.dataset.state as required by game shell contract
    if (typeof document !== 'undefined') {
      if (screen === 'playing') {
        document.body.dataset.state = 'playing';
      } else if (screen === 'paused') {
        document.body.dataset.state = 'paused';
      } else if (screen === 'gameover' || screen === 'ending') {
        document.body.dataset.state = 'gameover';
      } else {
        document.body.dataset.state = 'title';
      }
    }

    // Dynamic 8-Bit Heavy Metal Soundtrack transitions per game state
    // Do not restart 'menu' music when transitioning between 'title' and 'mainMenu'
    if (screen === 'title' || screen === 'mainMenu') {
      arcadeAudio.playTrack('menu', false);
    } else if (screen === 'select') {
      arcadeAudio.playTrack('select', false);
    } else if (screen === 'ending') {
      arcadeAudio.playTrack('victory', false);
    }
  }, [screen]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  const startMatchImmediate = useCallback(
    (
      c1: CharacterId,
      c2: CharacterId,
      mode: GameMode,
      stage: CharacterId
    ) => {
      const p2IsCpu = mode !== 'versus';
      const initial = createInitialMatchState(c1, c2, p2IsCpu, stage);
      simStateRef.current = initial;
      lastAnnouncedRef.current = '';
      keysHeldRef.current.clear();
      keysJustPressedRef.current.clear();
      setMatchSummary(null);
      setHud({
        p1Hp: 1000,
        p1TrailingHp: 1000,
        p1Meter:
          mode === 'training' && trainingRef.current.infiniteMeter ? 100 : 0,
        p1Rounds: 0,
        p1Combo: 0,
        p1State: 'idle',
        p2Hp: 1000,
        p2TrailingHp: 1000,
        p2Meter:
          mode === 'training' && trainingRef.current.infiniteMeter ? 100 : 0,
        p2Rounds: 0,
        p2Combo: 0,
        p2State: 'idle',
        timerSeconds: 99,
        roundNumber: 1,
        lastMoveText: '',
        fps: 60,
        inputHistory: 'NEUTRAL',
        frameDataInfo: null,
      });
      setScreen('playing');
      if (typeof document !== 'undefined') {
        document.body.dataset.state = 'playing';
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
      arcadeAudio.startStageMusic(stage);
    },
    []
  );

  // Preload all 6 official 1254x1254 PNG sprite sheets and all 6 official 1920x1080 stages on mount
  useEffect(() => {
    spriteSheetManager.preloadAll();
    stageAssetManager.preloadAll();
    const syncAssets = () => {
      setSpritesReadyCount(spriteSheetManager.getReadyCount());
      setSpriteErrors(spriteSheetManager.getErrors());
      setStagesReadyCount(stageAssetManager.getReadyCount());
      setStageErrors(stageAssetManager.getErrors());
    };
    const id = window.setTimeout(syncAssets, 0);
    const unsubSprites = spriteSheetManager.subscribe(syncAssets);
    const unsubStages = stageAssetManager.subscribe(syncAssets);
    return () => {
      window.clearTimeout(id);
      unsubSprites();
      unsubStages();
    };
  }, []);

  // Load saved options and check ?autostart=1 on mount
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem('arcade_fighters_96_options');
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<GameOptions>;
          setOptions((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // Ignore
      }

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('autostart') === '1') {
          startMatchImmediate('mostasa', 'patova', 'arcade', 'patova');
        }
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [startMatchImmediate]);

  // Expose deterministic state inspection and stepping hooks
  useEffect(() => {
    const win = window as unknown as {
      render_game_to_text?: () => string;
      advanceTime?: (ms: number) => void;
    };

    win.render_game_to_text = () => {
      const s = simStateRef.current;
      return JSON.stringify({
        screen: screenRef.current,
        mode: gameModeRef.current,
        spritesReady: spriteSheetManager.isAllReady(),
        spritesLoadedCount: spriteSheetManager.getReadyCount(),
        stagesReady: stageAssetManager.isAllReady(),
        stagesLoadedCount: stageAssetManager.getReadyCount(),
        selectedP1: p1Char,
        selectedP2: p2Char,
        selectedStage,
        activeStageSlug: STAGE_REGISTRY[s?.stageId ?? selectedStage].id,
        frame: s?.frame ?? 0,
        roundNumber: s?.roundNumber ?? 1,
        roundPhase: s?.roundPhase ?? 'none',
        timerSeconds: s ? Math.ceil(s.roundTimerFrames / FPS) : 99,
        p1: s
          ? {
              id: s.p1.characterId,
              x: Math.round(s.p1.x),
              y: Math.round(s.p1.y),
              hp: s.p1.hp,
              meter: s.p1.meter,
              state: s.p1.state,
              spriteCell: resolveCombatSpriteFrame(s.p1).frame.frameIndex,
            }
          : null,
        p2: s
          ? {
              id: s.p2.characterId,
              x: Math.round(s.p2.x),
              y: Math.round(s.p2.y),
              hp: s.p2.hp,
              meter: s.p2.meter,
              state: s.p2.state,
              spriteCell: resolveCombatSpriteFrame(s.p2).frame.frameIndex,
            }
          : null,
      });
    };

    win.advanceTime = (ms: number) => {
      const s = simStateRef.current;
      if (!s) return;
      const steps = Math.max(1, Math.round((ms / 1000) * FPS));
      for (let i = 0; i < steps; i++) {
        const p1In = createEmptyInputSnapshot();
        const p2In =
          gameModeRef.current === 'versus'
            ? createEmptyInputSnapshot()
            : computeAiInput(
                s,
                s.p2,
                s.p1,
                optionsRef.current.difficulty,
                gameModeRef.current === 'training'
                  ? trainingRef.current
                  : undefined
              );
        stepMatchSimulation(
          s,
          p1In,
          p2In,
          optionsRef.current.roundsToWin,
          gameModeRef.current === 'training' ? trainingRef.current : undefined
        );
      }
    };
  }, [p1Char, p2Char, selectedStage]);

  // Unified Keyboard & Focus-Loss Input Hub
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      // Prevent browser scrolling on game keys
      if (
        [
          'Space',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
        ].includes(code)
      ) {
        e.preventDefault();
      }

      if (screenRef.current === 'vs') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          arcadeAudio.playMenuConfirm();
          startMatchImmediate(p1Char, p2Char, gameModeRef.current, selectedStage);
          return;
        }
      }

      if (code === 'Escape') {
        if (screenRef.current === 'options' || screenRef.current === 'howto') {
          e.preventDefault();
          arcadeAudio.playMenuBack();
          setScreen('mainMenu');
          return;
        }
      }

      if (code === 'Escape' || code === 'KeyP') {
        if (screenRef.current === 'playing') {
          setScreen('paused');
          arcadeAudio.playMenuMove();
          return;
        } else if (screenRef.current === 'paused') {
          setScreen('playing');
          arcadeAudio.playMenuMove();
          return;
        }
      }

      if (code === 'KeyM' && (screenRef.current === 'playing' || screenRef.current === 'paused')) {
        setOptions((prev) => ({ ...prev, muted: !prev.muted }));
        return;
      }

      if (code === 'KeyH' && screenRef.current === 'playing') {
        setOptions((prev) => ({ ...prev, showHitboxes: !prev.showHitboxes }));
        return;
      }

      if (!keysHeldRef.current.has(code)) {
        keysJustPressedRef.current.add(code);
      }
      keysHeldRef.current.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const clearAllKeys = () => {
      keysHeldRef.current.clear();
      keysJustPressedRef.current.clear();
      virtualButtonsRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearAllKeys);
    document.addEventListener('visibilitychange', clearAllKeys);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearAllKeys);
      document.removeEventListener('visibilitychange', clearAllKeys);
    };
  }, [p1Char, p2Char, selectedStage, startMatchImmediate]);

  // Auto-advance VS screen after 3.2s
  useEffect(() => {
    if (screen !== 'vs') return;
    const timer = window.setTimeout(() => {
      startMatchImmediate(p1Char, p2Char, gameMode, selectedStage);
    }, 3200);
    return () => clearTimeout(timer);
  }, [screen, p1Char, p2Char, gameMode, selectedStage, startMatchImmediate]);

  // Main 60Hz Fixed-Step Combat Simulation Loop
  useEffect(() => {
    if (screen !== 'playing') return;

    let lastTime = performance.now();
    let accumulator = 0;
    let smoothedFps = 60;
    const fixedDt = 1 / FPS;

    const buildP1Input = (): InputSnapshot => {
      const held = keysHeldRef.current;
      const jp = keysJustPressedRef.current;
      const vb = virtualButtonsRef.current;

      const isSinglePlayer = gameModeRef.current !== 'versus';
      const up =
        held.has('KeyW') || (isSinglePlayer && held.has('ArrowUp'));
      const down =
        held.has('KeyS') || (isSinglePlayer && held.has('ArrowDown'));
      const left =
        held.has('KeyA') || (isSinglePlayer && held.has('ArrowLeft'));
      const right =
        held.has('KeyD') || (isSinglePlayer && held.has('ArrowRight'));

      return {
        up,
        down,
        left,
        right,
        lp: held.has('KeyF') || vb.has('lp'),
        hp: held.has('KeyG') || vb.has('hp'),
        lk: held.has('KeyV') || vb.has('lk'),
        hk: held.has('KeyB') || vb.has('hk'),
        grab: held.has('KeyT') || vb.has('grab'),
        special1: held.has('KeyC') || vb.has('special1'),
        special2: held.has('KeyQ') || vb.has('special2'),
        special3: held.has('KeyE') || vb.has('special3'),
        superBtn: held.has('Space') || held.has('KeyR') || vb.has('super'),
        justPressed: {
          up: jp.has('KeyW') || (isSinglePlayer && jp.has('ArrowUp')),
          down: jp.has('KeyS') || (isSinglePlayer && jp.has('ArrowDown')),
          left: jp.has('KeyA') || (isSinglePlayer && jp.has('ArrowLeft')),
          right: jp.has('KeyD') || (isSinglePlayer && jp.has('ArrowRight')),
          lp: jp.has('KeyF') || vb.has('lp'),
          hp: jp.has('KeyG') || vb.has('hp'),
          lk: jp.has('KeyV') || vb.has('lk'),
          hk: jp.has('KeyB') || vb.has('hk'),
          grab: jp.has('KeyT') || vb.has('grab'),
          special1: jp.has('KeyC') || vb.has('special1'),
          special2: jp.has('KeyQ') || vb.has('special2'),
          special3: jp.has('KeyE') || vb.has('special3'),
          superBtn: jp.has('Space') || jp.has('KeyR') || vb.has('super'),
        },
      };
    };

    const buildP2HumanInput = (): InputSnapshot => {
      const held = keysHeldRef.current;
      const jp = keysJustPressedRef.current;
      return {
        up: held.has('ArrowUp'),
        down: held.has('ArrowDown'),
        left: held.has('ArrowLeft'),
        right: held.has('ArrowRight'),
        lp: held.has('KeyJ'),
        hp: held.has('KeyK'),
        lk: held.has('KeyN'),
        hk: held.has('KeyM'),
        grab: held.has('KeyY'),
        special1: held.has('KeyL'),
        special2: held.has('KeyU'),
        special3: held.has('KeyI'),
        superBtn: held.has('KeyO') || held.has('Enter'),
        justPressed: {
          up: jp.has('ArrowUp'),
          down: jp.has('ArrowDown'),
          left: jp.has('ArrowLeft'),
          right: jp.has('ArrowRight'),
          lp: jp.has('KeyJ'),
          hp: jp.has('KeyK'),
          lk: jp.has('KeyN'),
          hk: jp.has('KeyM'),
          grab: jp.has('KeyY'),
          special1: jp.has('KeyL'),
          special2: jp.has('KeyU'),
          special3: jp.has('KeyI'),
          superBtn: jp.has('KeyO') || jp.has('Enter'),
        },
      };
    };

    const tick = () => {
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      if (rawDt > 0.002 && rawDt < 0.2) {
        const instantFps = Math.min(60, Math.round(1 / rawDt));
        smoothedFps = Math.round(smoothedFps * 0.85 + instantFps * 0.15);
      }
      const clampedDt = Math.min(Math.max(rawDt, fixedDt), 0.05);
      accumulator += clampedDt;

      const state = simStateRef.current;
      if (state) {
        while (accumulator >= fixedDt) {
          const p1In = buildP1Input();
          const p2In =
            gameModeRef.current === 'versus'
              ? buildP2HumanInput()
              : computeAiInput(
                  state,
                  state.p2,
                  state.p1,
                  optionsRef.current.difficulty,
                  gameModeRef.current === 'training'
                    ? trainingRef.current
                    : undefined
                );

          // Check audio cues before/after step
          const prevHitFrame = state.lastHitEvent?.frame ?? -1;
          const prevSuperFreeze = state.superFreezeFrames;
          const prevP1Attack = state.p1.currentAttack;
          const prevP2Attack = state.p2.currentAttack;

          stepMatchSimulation(
            state,
            p1In,
            p2In,
            optionsRef.current.roundsToWin,
            gameModeRef.current === 'training'
              ? trainingRef.current
              : undefined
          );

          keysJustPressedRef.current.clear();
          virtualButtonsRef.current.clear();

          // Trigger SFX for swings, hits, supers, and announcements
          if (state.superFreezeFrames > prevSuperFreeze) {
            arcadeAudio.playSuperFlash();
          } else if (
            (state.p1.currentAttack && state.p1.currentAttack !== prevP1Attack) ||
            (state.p2.currentAttack && state.p2.currentAttack !== prevP2Attack)
          ) {
            const moveId = state.p1.currentAttack || state.p2.currentAttack;
            if (
              moveId === 'special1' ||
              moveId === 'special2' ||
              moveId === 'special3'
            ) {
              arcadeAudio.playSpecial();
            } else {
              arcadeAudio.playSwing(moveId === 'hp' || moveId === 'hk');
            }
          }

          if (state.lastHitEvent && state.lastHitEvent.frame !== prevHitFrame) {
            arcadeAudio.playHit(
              state.lastHitEvent.damage >= 70,
              state.lastHitEvent.blocked
            );
          }

          if (
            state.announcement &&
            state.announcement.text !== lastAnnouncedRef.current
          ) {
            lastAnnouncedRef.current = state.announcement.text;
            arcadeAudio.announce(state.announcement.text);
          }

          // Dynamic critical health musical intensity (< 20% HP = < 200 HP)
          arcadeAudio.setCriticalHealthMode(
            state.roundPhase === 'fighting' &&
              (state.p1.hp < 200 || state.p2.hp < 200)
          );

          // Check Match Over transition
          if (state.roundPhase === 'match_over' && state.matchWinner) {
            const winner = state.matchWinner;
            arcadeAudio.setCriticalHealthMode(false);
            arcadeAudio.playTrack(
              winner === 1 || gameModeRef.current === 'versus'
                ? 'victory'
                : 'gameover'
            );
            setMatchSummary({
              winner,
              p1Rounds: state.p1RoundsWon,
              p2Rounds: state.p2RoundsWon,
              maxCombo: state.p1.maxComboReached,
              totalDamage: state.p1.totalDamageDealt,
              timeRemaining: Math.ceil(state.roundTimerFrames / FPS),
            });
            setScreen('gameover');
            return;
          }

          accumulator -= fixedDt;
        }

        // Render Canvas 2D
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const showBoxes =
              optionsRef.current.showHitboxes ||
              (gameModeRef.current === 'training' &&
                trainingRef.current.showHitboxes);
            renderMatchCanvas(
              ctx,
              state,
              showBoxes,
              optionsRef.current.cameraShake
            );
          }
        }

        // Throttle React HUD updates to every 3 frames (~20Hz)
        if (state.frame % 3 === 0) {
          const activeMoveId = state.p1.currentAttack;
          const p1Moves = CHARACTERS[state.p1.characterId].moves;
          const activeMove = activeMoveId ? p1Moves[activeMoveId] : null;
          const hitEv = state.lastHitEvent;

          setHud({
            p1Hp: state.p1.hp,
            p1TrailingHp: state.p1.trailingHp,
            p1Meter: state.p1.meter,
            p1Rounds: state.p1RoundsWon,
            p1Combo: state.p2.comboCount,
            p1State: state.p1.state,
            p2Hp: state.p2.hp,
            p2TrailingHp: state.p2.trailingHp,
            p2Meter: state.p2.meter,
            p2Rounds: state.p2RoundsWon,
            p2Combo: state.p1.comboCount,
            p2State: state.p2.state,
            timerSeconds: Math.ceil(state.roundTimerFrames / FPS),
            roundNumber: state.roundNumber,
            lastMoveText: hitEv
              ? `${hitEv.moveName} (${hitEv.blocked ? 'BLOQUEADO' : `${hitEv.damage} DMG · ${hitEv.scalingPercent}%`})`
              : '',
            fps: smoothedFps,
            inputHistory: formatInputHistoryStream(state.p1.inputBuffer),
            frameDataInfo: hitEv
              ? {
                  moveName: hitEv.moveName,
                  startup: activeMove?.startup ?? 5,
                  active: activeMove?.active ?? 4,
                  recovery: activeMove?.recovery ?? 10,
                  frameAdvantage: hitEv.frameAdvantage ?? 2,
                  scalingPercent: hitEv.scalingPercent ?? 100,
                  hitDamage: hitEv.damage,
                  comboDamage: state.p2.comboDamage || hitEv.damage,
                  isCounter: Boolean(hitEv.isCounter),
                  isPunish: Boolean(hitEv.isPunish),
                }
              : activeMove
                ? {
                    moveName: activeMove.name,
                    startup: activeMove.startup,
                    active: activeMove.active,
                    recovery: activeMove.recovery,
                    frameAdvantage: activeMove.hitstun - activeMove.recovery,
                    scalingPercent: 100,
                    hitDamage: activeMove.damage,
                    comboDamage: state.p2.comboDamage,
                    isCounter: false,
                    isPunish: false,
                  }
                : null,
          });
        }
      }
    };

    tick();
    const timerId = window.setInterval(tick, 16);
    return () => window.clearInterval(timerId);
  }, [screen]);

  const handleSelectMode = (mode: GameMode) => {
    setGameMode(mode);
    setSelectingSlot(1);
    setArcadeStageIdx(0);
    setScreen('select');
  };

  const handleMainMenuOption = (optionId: MainMenuOptionId) => {
    switch (optionId) {
      case 'arcade':
        setMainMenuInitialIndex(0);
        handleSelectMode('arcade');
        break;
      case 'versus':
        setMainMenuInitialIndex(1);
        handleSelectMode('versus');
        break;
      case 'cpu':
        setMainMenuInitialIndex(2);
        handleSelectMode('cpu');
        break;
      case 'training':
        setMainMenuInitialIndex(3);
        handleSelectMode('training');
        break;
      case 'options':
        setMainMenuInitialIndex(4);
        setScreen('options');
        break;
      case 'howto':
        setMainMenuInitialIndex(5);
        setScreen('howto');
        break;
      case 'soundtest':
        setMainMenuInitialIndex(6);
        setShowSoundTest(true);
        break;
      case 'exit':
        setMainMenuInitialIndex(0);
        setScreen('title');
        break;
    }
  };

  const handleConfirmCharacterSelect = () => {
    arcadeAudio.playMenuConfirm();
    if (gameMode === 'arcade') {
      // Build 5-opponent ladder excluding P1's character, starting with p2Char if different
      const rest = CHARACTER_ORDER.filter(
        (id) => id !== p1Char && id !== p2Char
      );
      const opponents =
        p2Char !== p1Char ? [p2Char, ...rest] : rest;
      setArcadeLadder(opponents);
      setArcadeStageIdx(0);
      const firstOpponent = opponents[0];
      setP2Char(firstOpponent);
      setSelectedStage(firstOpponent);
      setScreen('vs');
    } else if (gameMode === 'training') {
      startMatchImmediate(p1Char, p2Char, 'training', selectedStage);
    } else {
      setScreen('vs');
    }
  };

  const handleNextArcadeOpponent = () => {
    arcadeAudio.playMenuConfirm();
    const nextIdx = arcadeStageIdx + 1;
    if (nextIdx >= arcadeLadder.length) {
      setScreen('ending');
      return;
    }
    setArcadeStageIdx(nextIdx);
    const nextOpp = arcadeLadder[nextIdx];
    setP2Char(nextOpp);
    setSelectedStage(nextOpp);
    setScreen('vs');
  };

  const triggerVirtualButton = (btn: string) => {
    virtualButtonsRef.current.add(btn);
  };

  const p1Def = CHARACTERS[p1Char];
  const p2Def = CHARACTERS[p2Char];
  const isMirrorMatch = p1Char === p2Char;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none">
      {/* Optional CRT Scanlines Overlay (pure CSS linear-gradient, zero backdrop-filter) */}
      {options.scanlines && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 opacity-25"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 1px, transparent 1px, transparent 3px)',
          }}
        />
      )}

      {/* =====================================================================
          1A. OFFICIAL PORTADA / TITLE SCREEN (/assets/ui/title-screen.png)
         ===================================================================== */}
      {screen === 'title' && (
        <TitleScreen
          onEnterMainMenu={() => {
            setMainMenuInitialIndex(0);
            setScreen('mainMenu');
          }}
        />
      )}

      {/* =====================================================================
          1B. OFFICIAL 8-OPTION MAIN MENU (/assets/ui/main-menu.png)
         ===================================================================== */}
      {screen === 'mainMenu' && (
        <MainMenu
          initialSelectedIndex={mainMenuInitialIndex}
          onSelectOption={handleMainMenuOption}
          onBackToTitle={() => {
            setMainMenuInitialIndex(0);
            setScreen('title');
          }}
        />
      )}

      {/* =====================================================================
          2. CHARACTER SELECT SCREEN (3x2 Grid + Stats + Bios + Live Preview)
         ===================================================================== */}
      {screen === 'select' && (
        <CharacterSelect
          gameMode={gameMode}
          p1Char={p1Char}
          p2Char={p2Char}
          selectedStage={selectedStage}
          selectingSlot={selectingSlot}
          onSelectP1={(cid) => {
            setP1Char(cid);
            if (gameMode === 'training') {
              setSelectedStage(cid);
            }
          }}
          onSelectP2={setP2Char}
          onSelectStage={setSelectedStage}
          onChangeSlot={setSelectingSlot}
          onBackToMenu={() => {
            arcadeAudio.playMenuBack();
            setScreen('mainMenu');
          }}
          onConfirmMatch={handleConfirmCharacterSelect}
          onOpenStagePreviewer={() => setShowStagePreviewer(true)}
        />
      )}

      {/* =====================================================================
          3. VS PRESENTATION SCREEN (VersusTransition)
         ===================================================================== */}
      {screen === 'vs' && (
        <VersusTransition
          gameMode={gameMode}
          p1Char={p1Char}
          p2Char={p2Char}
          selectedStage={selectedStage}
          arcadeStageIdx={arcadeStageIdx}
          arcadeTotalStages={arcadeLadder.length}
          onStartMatch={() =>
            startMatchImmediate(p1Char, p2Char, gameMode, selectedStage)
          }
        />
      )}

      {/* =====================================================================
          4. ACTIVE COMBAT ARENA & PERIMETER HUD ('playing' / 'paused' / 'gameover')
         ===================================================================== */}
      {(screen === 'playing' ||
        screen === 'paused' ||
        screen === 'gameover') && (
        <div className="relative w-full h-full flex items-center justify-center bg-zinc-950">
          {/* Isolated 960x540 Logical Combat Canvas */}
          <canvas
            ref={canvasRef}
            data-testid="arcade-canvas"
            width={LOGICAL_WIDTH}
            height={LOGICAL_HEIGHT}
            className="w-full h-full object-contain"
          />

          {/* Low-Occlusion Perimeter HUD Overlay (pointer-events-none on container) */}
          <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 md:p-5">
            {/* TOP HUD CLUSTER: P1 Vitality | Timer & Round | P2 Vitality */}
            <div className="w-full max-w-6xl mx-auto">
              <div className="flex items-start justify-between gap-3">
                {/* P1 Health & Info */}
                <div className="flex-1 flex items-start gap-2.5">
                  <CharacterPortrait characterId={p1Char} size="sm" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-arcade font-bold text-sm md:text-base text-amber-300 tracking-wide">
                          {p1Def.shortName}
                        </span>
                        {/* Round Won Pips */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: options.roundsToWin }).map(
                            (_, idx) => (
                              <span
                                key={idx}
                                className={`inline-block w-3 h-3 border border-amber-300 ${
                                  idx < hud.p1Rounds
                                    ? 'bg-amber-400'
                                    : 'bg-zinc-900'
                                }`}
                              />
                            )
                          )}
                        </div>
                      </div>
                      <span className="font-mono-num text-xs text-zinc-200 font-bold">
                        HP {Math.max(0, Math.round(hud.p1Hp))}
                      </span>
                    </div>

                    {/* P1 Health Bar with Trailing Damage Ghost Bar */}
                    <div className="relative w-full h-5 bg-zinc-950 border-2 border-amber-400/90 overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
                      <div
                        className="absolute inset-y-0 right-0 bg-red-600/85 transition-all duration-75"
                        style={{
                          width: `${Math.max(0, Math.min(100, (hud.p1TrailingHp / 1000) * 100))}%`,
                        }}
                      />
                      <div
                        className={`absolute inset-y-0 right-0 ${
                          hud.p1Hp < 250
                            ? 'bg-rose-500'
                            : 'bg-gradient-to-l from-amber-300 via-yellow-400 to-emerald-500'
                        }`}
                        style={{
                          width: `${Math.max(0, Math.min(100, (hud.p1Hp / 1000) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Center Arcade Timer & Round Counter */}
                <div className="flex flex-col items-center px-3 py-1 bg-zinc-950/95 border-2 border-amber-400 shadow-[0_4px_12px_rgba(0,0,0,0.9)] shrink-0">
                  <span className="text-[10px] font-arcade font-bold text-zinc-400 tracking-widest">
                    {gameMode === 'training'
                      ? 'TRAINING'
                      : `ROUND ${hud.roundNumber}`}
                  </span>
                  <span className="text-2xl md:text-3xl font-mono-num font-black text-amber-400 leading-none">
                    {gameMode === 'training'
                      ? '99'
                      : String(hud.timerSeconds).padStart(2, '0')}
                  </span>
                </div>

                {/* P2 Health & Info */}
                <div className="flex-1 flex items-start gap-2.5">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-num text-xs text-zinc-200 font-bold">
                        HP {Math.max(0, Math.round(hud.p2Hp))}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: options.roundsToWin }).map(
                            (_, idx) => (
                              <span
                                key={idx}
                                className={`inline-block w-3 h-3 border border-sky-300 ${
                                  idx < hud.p2Rounds
                                    ? 'bg-sky-400'
                                    : 'bg-zinc-900'
                                }`}
                              />
                            )
                          )}
                        </div>
                        <span className="font-arcade font-bold text-sm md:text-base text-sky-300 tracking-wide">
                          {p2Def.shortName}
                        </span>
                      </div>
                    </div>

                    {/* P2 Health Bar */}
                    <div className="relative w-full h-5 bg-zinc-950 border-2 border-sky-400/90 overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
                      <div
                        className="absolute inset-y-0 left-0 bg-red-600/85 transition-all duration-75"
                        style={{
                          width: `${Math.max(0, Math.min(100, (hud.p2TrailingHp / 1000) * 100))}%`,
                        }}
                      />
                      <div
                        className={`absolute inset-y-0 left-0 ${
                          hud.p2Hp < 250
                            ? 'bg-rose-500'
                            : 'bg-gradient-to-r from-sky-300 via-cyan-400 to-emerald-500'
                        }`}
                        style={{
                          width: `${Math.max(0, Math.min(100, (hud.p2Hp / 1000) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                  <CharacterPortrait
                    characterId={p2Char}
                    isAlt={isMirrorMatch}
                    size="sm"
                    flipHorizontal
                  />
                </div>

                {/* Top-Right Compact Utility Icon Buttons (Mute, Hitboxes, Pause) */}
                <div className="pointer-events-auto flex items-center gap-1.5 ml-1">
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Alternar Sonido"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setOptions((prev) => ({ ...prev, muted: !prev.muted }));
                    }}
                    className="p-2 bg-zinc-900/95 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 cursor-pointer"
                  >
                    {options.muted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-amber-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="hud-open-animation-lab"
                    aria-label="Abrir Animation Lab"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setShowSpriteInspector(true);
                    }}
                    className="px-2 py-1.5 bg-zinc-900/95 hover:bg-zinc-800 border border-emerald-400/70 text-emerald-300 text-[10px] font-arcade font-bold cursor-pointer whitespace-nowrap"
                  >
                    ANIM LAB
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Mostrar Hitboxes"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setOptions((prev) => ({
                        ...prev,
                        showHitboxes: !prev.showHitboxes,
                      }));
                    }}
                    className={`p-2 bg-zinc-900/95 hover:bg-zinc-800 border cursor-pointer ${
                      options.showHitboxes
                        ? 'border-emerald-400 text-emerald-400'
                        : 'border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <Crosshair className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Pausar Juego"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setScreen('paused');
                    }}
                    className="p-2 bg-zinc-900/95 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Advanced Training Mode Inspector Strip (ETAPA I - Combat System 3.0) */}
              {gameMode === 'training' && (
                <div className="pointer-events-auto mt-2 space-y-1.5 bg-zinc-950/92 border border-zinc-800 px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-emerald-400 font-arcade font-bold">
                        DUMMY:
                      </span>
                      {(
                        [
                          ['stand', 'Inmóvil'],
                          ['crouch', 'Agachado'],
                          ['jump', 'Saltando'],
                          ['block_all', 'Bloqueo Total'],
                          ['cpu', 'IA Activa'],
                        ] as const
                      ).map(([beh, label]) => (
                        <button
                          key={beh}
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.currentTarget.blur();
                            setTraining((prev) => ({
                              ...prev,
                              dummyBehavior: beh,
                            }));
                          }}
                          className={`px-2 py-0.5 font-mono-num cursor-pointer whitespace-nowrap ${
                            training.dummyBehavior === beh
                              ? 'bg-emerald-400 text-zinc-950 font-bold'
                              : 'bg-zinc-900 text-zinc-300 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 font-mono-num flex-wrap">
                      <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-emerald-400 font-bold">
                        {hud.fps} FPS
                      </span>
                      <button
                        type="button"
                        tabIndex={-1}
                        data-testid="training-toggle-hitboxes"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          const nextVal = !(
                            training.showHitboxes || options.showHitboxes
                          );
                          setTraining((prev) => ({
                            ...prev,
                            showHitboxes: nextVal,
                          }));
                          setOptions((prev) => ({
                            ...prev,
                            showHitboxes: nextVal,
                          }));
                        }}
                        className={`px-2 py-0.5 border cursor-pointer whitespace-nowrap ${
                          training.showHitboxes || options.showHitboxes
                            ? 'border-emerald-400 text-emerald-300 bg-emerald-950/50'
                            : 'border-zinc-700 text-zinc-400'
                        }`}
                      >
                        4-Vol Boxes:{' '}
                        {training.showHitboxes || options.showHitboxes
                          ? 'ON'
                          : 'OFF'}
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        data-testid="training-reset-btn"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          startMatchImmediate(
                            p1Char,
                            p2Char,
                            'training',
                            selectedStage
                          );
                        }}
                        className="px-2 py-0.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold cursor-pointer whitespace-nowrap"
                      >
                        REINICIAR POSICIÓN
                      </button>
                    </div>
                  </div>

                  {/* Frame Data & Input Buffer Telemetry Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-800/80 font-mono-num text-[11px]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-zinc-400">
                        INPUT BUFFER:{' '}
                        <strong className="text-amber-300">
                          {hud.inputHistory}
                        </strong>
                      </span>
                      <span className="text-zinc-400">
                        ESTADO P1:{' '}
                        <strong className="text-white uppercase">
                          {hud.p1State}
                        </strong>
                      </span>
                    </div>

                    {hud.frameDataInfo ? (
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-sky-300 font-bold">
                          {hud.frameDataInfo.moveName}
                        </span>
                        <span className="text-zinc-300">
                          S/A/R:{' '}
                          <strong>
                            {hud.frameDataInfo.startup}f /{' '}
                            {hud.frameDataInfo.active}f /{' '}
                            {hud.frameDataInfo.recovery}f
                          </strong>
                        </span>
                        <span
                          className={
                            hud.frameDataInfo.frameAdvantage >= 0
                              ? 'text-emerald-400 font-bold'
                              : 'text-rose-400 font-bold'
                          }
                        >
                          Ventaja:{' '}
                          {hud.frameDataInfo.frameAdvantage >= 0
                            ? `+${hud.frameDataInfo.frameAdvantage}f`
                            : `${hud.frameDataInfo.frameAdvantage}f`}
                        </span>
                        <span className="text-amber-300">
                          Scaling: {hud.frameDataInfo.scalingPercent}%
                        </span>
                        <span className="text-white font-bold">
                          DMG: {hud.frameDataInfo.hitDamage} (Total:{' '}
                          {hud.frameDataInfo.comboDamage})
                        </span>
                      </div>
                    ) : (
                      <span className="text-zinc-500">
                        Ejecutá un golpe para inspeccionar Startup / Active /
                        Recovery / Ventaja de Frames
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* BOTTOM PERIMETER CLUSTER: Super Power Meters + Quick Action Bar */}
            <div className="w-full max-w-6xl mx-auto flex flex-col gap-2">
              <div className="flex items-end justify-between gap-6">
                {/* P1 Super Power Meter */}
                <div className="w-64 md:w-80 bg-zinc-950/90 border border-amber-400/80 p-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono-num mb-1">
                    <span className="font-bold text-amber-300">
                      {hud.p1Meter >= 100
                        ? '★ SUPER LISTO (ESPACIO / R) ★'
                        : 'POWER METER P1'}
                    </span>
                    <span className="text-zinc-200">{Math.round(hud.p1Meter)}%</span>
                  </div>
                  <div className="w-full h-3 bg-zinc-900 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 ${
                        hud.p1Meter >= 100
                          ? 'bg-gradient-to-r from-amber-300 via-rose-500 to-yellow-300'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, hud.p1Meter)}%` }}
                    />
                  </div>
                </div>

                {/* Quick Interactive Move Bar (Keyboard + Clickable Affordances) */}
                <div className="pointer-events-auto hidden md:flex items-center gap-1.5 bg-zinc-950/90 border border-zinc-800 px-2.5 py-1.5 text-[11px] font-mono-num">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerVirtualButton('lp');
                    }}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 cursor-pointer whitespace-nowrap"
                  >
                    [F] Puño L
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerVirtualButton('hp');
                    }}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 cursor-pointer whitespace-nowrap"
                  >
                    [G] Puño F
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerVirtualButton('lk');
                    }}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 cursor-pointer whitespace-nowrap"
                  >
                    [V] Patada L
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerVirtualButton('hk');
                    }}
                    className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 cursor-pointer whitespace-nowrap"
                  >
                    [B] Patada F
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerVirtualButton('grab');
                    }}
                    className="px-2 py-1 bg-purple-950/80 hover:bg-purple-900 border border-purple-500/70 text-purple-200 cursor-pointer whitespace-nowrap"
                  >
                    [T] Agarre
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerVirtualButton('special1');
                    }}
                    className="px-2 py-1 bg-amber-950/80 hover:bg-amber-900 border border-amber-500/70 text-amber-300 cursor-pointer whitespace-nowrap"
                  >
                    [C] {p1Def.moves.special1.name}
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerVirtualButton('super');
                    }}
                    disabled={hud.p1Meter < 100}
                    className={`px-2 py-1 border cursor-pointer whitespace-nowrap ${
                      hud.p1Meter >= 100
                        ? 'bg-rose-600 hover:bg-rose-500 border-amber-300 text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    [Espacio] SUPER
                  </button>
                </div>

                {/* P2 Super Power Meter */}
                <div className="w-64 md:w-80 bg-zinc-950/90 border border-sky-400/80 p-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono-num mb-1">
                    <span className="text-zinc-200">{Math.round(hud.p2Meter)}%</span>
                    <span className="font-bold text-sky-300">
                      {hud.p2Meter >= 100 ? '★ SUPER READY ★' : 'POWER METER P2'}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-zinc-900 overflow-hidden">
                    <div
                      className={`h-full ml-auto transition-all duration-75 ${
                        hud.p2Meter >= 100
                          ? 'bg-gradient-to-l from-sky-300 via-purple-500 to-cyan-300'
                          : 'bg-sky-400'
                      }`}
                      style={{ width: `${Math.min(100, hud.p2Meter)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================================
              PAUSE MODAL ('paused')
             ================================================================= */}
          {screen === 'paused' && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
              <div className="w-full max-w-md bg-zinc-900 border-2 border-amber-400 p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h2 className="text-2xl font-arcade font-bold text-amber-400">
                    JUEGO EN PAUSA
                  </h2>
                  <span className="text-xs font-mono-num text-zinc-400">
                    ESC / P
                  </span>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 p-3 text-xs space-y-1.5">
                  <div className="font-bold text-amber-300">
                    Movimientos de {p1Def.shortName}:
                  </div>
                  <div>· {p1Def.moves.special1.name}: {p1Def.moves.special1.command}</div>
                  <div>· {p1Def.moves.special2.name}: {p1Def.moves.special2.command}</div>
                  <div>· {p1Def.moves.special3.name}: {p1Def.moves.special3.command}</div>
                  <div className="text-rose-400 font-semibold">
                    · SUPER ({p1Def.moves.super.name}): {p1Def.moves.super.command}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setScreen('playing')}
                    className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-arcade font-bold text-base cursor-pointer whitespace-nowrap"
                  >
                    CONTINUAR COMBATE (RESUME)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startMatchImmediate(
                        p1Char,
                        p2Char,
                        gameMode,
                        selectedStage
                      )
                    }
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-arcade font-bold text-sm cursor-pointer whitespace-nowrap"
                  >
                    REINICIAR PELEA (RESTART)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.stopMusic();
                      setScreen('select');
                    }}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-arcade font-bold text-sm cursor-pointer whitespace-nowrap"
                  >
                    CAMBIAR PERSONAJE
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      arcadeAudio.stopMusic();
                      setScreen('mainMenu');
                    }}
                    className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 font-arcade font-bold text-sm cursor-pointer whitespace-nowrap"
                  >
                    SALIR AL MENÚ PRINCIPAL
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              VICTORY / GAME OVER MODAL ('gameover')
             ================================================================= */}
          {screen === 'gameover' && matchSummary && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
              <div className="w-full max-w-lg bg-zinc-900 border-2 border-amber-400 p-6 space-y-5 shadow-2xl">
                <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
                  <CharacterPortrait
                    characterId={matchSummary.winner === 1 ? p1Char : p2Char}
                    isAlt={matchSummary.winner === 2 && isMirrorMatch}
                    size="md"
                  />
                  <div>
                    <div className="text-xs font-mono-num font-bold text-amber-400">
                      {matchSummary.winner === 1
                        ? '¡VICTORIA DEL JUGADOR 1!'
                        : gameMode === 'versus'
                          ? '¡VICTORIA DEL JUGADOR 2!'
                          : 'DERROTA · CONTINUE?'}
                    </div>
                    <h2 className="text-2xl font-arcade font-bold text-white">
                      {matchSummary.winner === 1 ? p1Def.name : p2Def.name} WINS!
                    </h2>
                    <p className="text-xs italic text-amber-300 mt-1">
                      &ldquo;
                      {matchSummary.winner === 1
                        ? p1Def.victoryQuote
                        : p2Def.victoryQuote}
                      &rdquo;
                    </p>
                  </div>
                </div>

                {/* 3 Tabular-Nums Stat Tiles */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-zinc-950 border border-zinc-800 p-3">
                    <div className="text-[11px] text-zinc-400">ROUNDS</div>
                    <div className="text-xl font-mono-num font-bold text-white">
                      {matchSummary.p1Rounds} - {matchSummary.p2Rounds}
                    </div>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 p-3">
                    <div className="text-[11px] text-zinc-400">MAX COMBO</div>
                    <div className="text-xl font-mono-num font-bold text-amber-400">
                      {matchSummary.maxCombo} HITS
                    </div>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 p-3">
                    <div className="text-[11px] text-zinc-400">DAÑO TOTAL</div>
                    <div className="text-xl font-mono-num font-bold text-emerald-400">
                      {matchSummary.totalDamage}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {gameMode === 'arcade' && matchSummary.winner === 1 ? (
                    <button
                      type="button"
                      data-start="true"
                      onClick={handleNextArcadeOpponent}
                      className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-arcade font-bold text-lg cursor-pointer whitespace-nowrap"
                    >
                      {arcadeStageIdx + 1 >= arcadeLadder.length
                        ? '★ VER SECUENCIA FINAL DE CAMPEÓN ★'
                        : `SIGUIENTE RIVAL (${arcadeStageIdx + 2}/${arcadeLadder.length}) →`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-start="true"
                      onClick={() =>
                        startMatchImmediate(
                          p1Char,
                          p2Char,
                          gameMode,
                          selectedStage
                        )
                      }
                      className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-arcade font-bold text-lg cursor-pointer whitespace-nowrap"
                    >
                      REVANCHA INMEDIATA (PLAY AGAIN)
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        arcadeAudio.stopMusic();
                        setScreen('select');
                      }}
                      className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-arcade font-bold text-sm cursor-pointer whitespace-nowrap"
                    >
                      SELECTOR DE LUCHADORES
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        arcadeAudio.stopMusic();
                        setScreen('mainMenu');
                      }}
                      className="py-2.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-arcade font-bold text-sm cursor-pointer whitespace-nowrap"
                    >
                      MENÚ PRINCIPAL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          5. ARCADE TOURNAMENT ENDING & 1996 CREDITS ('ending')
         ===================================================================== */}
      {screen === 'ending' && (
        <div className="relative w-full h-full flex flex-col justify-between p-6 md:p-12 bg-zinc-950 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <span className="text-xs font-mono-num text-amber-400">
              ★ CAMPEÓN OFICIAL · ARCADE FIGHTERS &apos;96 ★
            </span>
            <span className="text-xs font-mono-num text-zinc-400">
              TOURNAMENT CLEAR
            </span>
          </div>

          <div className="max-w-4xl mx-auto my-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center py-6">
            <div className="md:col-span-5 flex flex-col items-center bg-zinc-900 border-2 border-amber-400 p-6">
              <FighterPreviewCanvas
                characterId={p1Char}
                poseState="victory"
                facing={1}
              />
              <h2 className="mt-4 text-2xl font-arcade font-bold text-amber-400 text-center">
                {p1Def.name}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">{p1Def.origin}</p>
            </div>

            <div className="md:col-span-7 space-y-4">
              <h1 className="text-2xl md:text-3xl font-arcade font-bold text-white">
                {p1Def.arcadeEndingTitle}
              </h1>
              <div className="space-y-3 text-sm md:text-base text-zinc-300 leading-relaxed">
                {p1Def.arcadeEndingText.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>

              <div className="pt-4 border-t border-zinc-800 text-xs font-mono-num text-zinc-400 space-y-1">
                <div className="text-amber-400 font-bold">
                  CRÉDITOS ARCADE STUDIO &apos;96:
                </div>
                <div>
                  Dirección de Combate &amp; Motor 60Hz: Litoral Arcade Works
                </div>
                <div>
                  Diseño de Personajes: Mostasa, El Braian, The Litlle Rag,
                  Patova Marcelo, Jenny El Travesaño &amp; The Alien
                </div>
                <div>
                  Sonido FM &amp; Sintetizadores: Web Audio 1996 Chip Engine
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  data-start="true"
                  onClick={() => {
                    arcadeAudio.stopMusic();
                    setScreen('select');
                  }}
                  className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-arcade font-bold text-sm cursor-pointer whitespace-nowrap"
                >
                  JUGAR CON OTRO PERSONAJE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    arcadeAudio.stopMusic();
                    setScreen('title');
                  }}
                  className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-arcade font-bold text-sm cursor-pointer whitespace-nowrap"
                >
                  VOLVER AL TÍTULO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          6. OPTIONS SCREEN ('options')
         ===================================================================== */}
      {screen === 'options' && (
        <div
          data-testid="options-screen"
          className="relative w-full h-full flex items-center justify-center p-4 md:p-6 bg-zinc-950 overflow-y-auto"
        >
          <div className="w-full max-w-2xl bg-zinc-900 border-2 border-amber-400 p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h1 className="text-2xl font-arcade font-bold text-amber-400">
                OPCIONES · CONFIGURACIÓN DE SISTEMA
              </h1>
              <button
                type="button"
                data-testid="options-back-button"
                onClick={() => {
                  arcadeAudio.playMenuBack();
                  setScreen('mainMenu');
                }}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-xs font-arcade font-bold text-zinc-950 cursor-pointer whitespace-nowrap"
              >
                ← GUARDAR Y VOLVER AL MENÚ (ESC)
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              {/* Music Volume */}
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="music-vol" className="text-zinc-300 font-medium">
                  Volumen de Música 8-Bit Heavy Metal ({options.musicVolume}%)
                </label>
                <input
                  id="music-vol"
                  type="range"
                  min={0}
                  max={100}
                  value={options.musicVolume}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      musicVolume: Number(e.target.value),
                    }))
                  }
                  className="w-48 accent-amber-400"
                />
              </div>

              {/* SFX Volume */}
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="sfx-vol" className="text-zinc-300 font-medium">
                  Volumen de Efectos de Sonido ({options.sfxVolume}%)
                </label>
                <input
                  id="sfx-vol"
                  type="range"
                  min={0}
                  max={100}
                  value={options.sfxVolume}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      sfxVolume: Number(e.target.value),
                    }))
                  }
                  className="w-48 accent-amber-400"
                />
              </div>

              {/* Enable / Disable Music & SFX */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  data-testid="options-toggle-music"
                  onClick={() =>
                    setOptions((prev) => ({
                      ...prev,
                      musicEnabled: !prev.musicEnabled,
                    }))
                  }
                  className={`px-3 py-2 text-xs font-arcade font-bold border cursor-pointer whitespace-nowrap ${
                    options.musicEnabled
                      ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                  }`}
                >
                  MÚSICA 8-BIT: {options.musicEnabled ? 'ACTIVADA' : 'DESACTIVADA'}
                </button>
                <button
                  type="button"
                  data-testid="options-toggle-sfx"
                  onClick={() =>
                    setOptions((prev) => ({
                      ...prev,
                      sfxEnabled: !prev.sfxEnabled,
                    }))
                  }
                  className={`px-3 py-2 text-xs font-arcade font-bold border cursor-pointer whitespace-nowrap ${
                    options.sfxEnabled
                      ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                  }`}
                >
                  EFECTOS SFX: {options.sfxEnabled ? 'ACTIVADOS' : 'DESACTIVADOS'}
                </button>
              </div>

              {/* 8-Bit Synth Mode */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-300 font-medium">
                  Calidad / Modo de Síntesis 8-Bit
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) => ({
                        ...prev,
                        chipMode8Bit: 'metal_overdrive',
                      }))
                    }
                    className={`px-3 py-1.5 text-xs font-arcade font-bold border cursor-pointer whitespace-nowrap ${
                      options.chipMode8Bit === 'metal_overdrive'
                        ? 'bg-amber-400 text-zinc-950 border-amber-200'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    8-BIT OVERDRIVE &apos;87
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) => ({
                        ...prev,
                        chipMode8Bit: 'nes_pure',
                      }))
                    }
                    className={`px-3 py-1.5 text-xs font-arcade font-bold border cursor-pointer whitespace-nowrap ${
                      options.chipMode8Bit === 'nes_pure'
                        ? 'bg-amber-400 text-zinc-950 border-amber-200'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    NES PURO (2A03)
                  </button>
                </div>
              </div>

              {/* Dynamic Musical Intensity (<20% HP) */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-300 font-medium">
                  Intensidad Musical Dinámica (&lt;20% HP)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setOptions((prev) => ({
                      ...prev,
                      dynamicMusicIntensity: !prev.dynamicMusicIntensity,
                    }))
                  }
                  className={`px-4 py-1.5 text-xs font-arcade font-bold border cursor-pointer whitespace-nowrap ${
                    options.dynamicMusicIntensity
                      ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                  }`}
                >
                  {options.dynamicMusicIntensity ? 'ACTIVADA' : 'DESACTIVADA'}
                </button>
              </div>

              {/* AI Difficulty */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-300 font-medium">
                  Dificultad de la CPU
                </span>
                <div className="flex gap-2">
                  {(['EASY', 'NORMAL', 'HARD'] as DifficultyLevel[]).map(
                    (diff) => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() =>
                          setOptions((prev) => ({ ...prev, difficulty: diff }))
                        }
                        className={`px-3 py-1.5 text-xs font-arcade font-bold border cursor-pointer whitespace-nowrap ${
                          options.difficulty === diff
                            ? 'bg-amber-400 text-zinc-950 border-amber-200'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                        }`}
                      >
                        {diff}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Rounds to Win */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-300 font-medium">
                  Rounds para Ganar
                </span>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({ ...prev, roundsToWin: r }))
                      }
                      className={`px-3 py-1.5 text-xs font-arcade font-bold border cursor-pointer whitespace-nowrap ${
                        options.roundsToWin === r
                          ? 'bg-amber-400 text-zinc-950 border-amber-200'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      {r === 1 ? '1 ROUND' : r === 2 ? '2 (MEJOR DE 3)' : '3 (MEJOR DE 5)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scanlines & Fullscreen */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-300 font-medium">
                  Efecto Monitor CRT Scanlines
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) => ({
                        ...prev,
                        scanlines: !prev.scanlines,
                      }))
                    }
                    className={`px-4 py-1.5 text-xs font-arcade font-bold border cursor-pointer whitespace-nowrap ${
                      options.scanlines
                        ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    {options.scanlines ? 'SCANLINES ON' : 'SCANLINES OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof document !== 'undefined') {
                        if (!document.fullscreenElement) {
                          document.documentElement
                            .requestFullscreen?.()
                            .catch(() => {});
                        } else {
                          document.exitFullscreen?.().catch(() => {});
                        }
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-arcade font-bold border border-zinc-700 bg-zinc-950 hover:bg-zinc-800 text-zinc-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                    PANTALLA COMPLETA
                  </button>
                </div>
              </div>

              {/* Camera Shake & Hitbox Debug */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-300 font-medium">
                  Vibración de Cámara / Hitboxes
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) => ({
                        ...prev,
                        cameraShake: !prev.cameraShake,
                      }))
                    }
                    className={`px-3 py-1.5 text-xs font-arcade font-bold border cursor-pointer whitespace-nowrap ${
                      options.cameraShake
                        ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    SHAKE: {options.cameraShake ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) => ({
                        ...prev,
                        showHitboxes: !prev.showHitboxes,
                      }))
                    }
                    className={`px-3 py-1.5 text-xs font-arcade font-bold border cursor-pointer whitespace-nowrap ${
                      options.showHitboxes
                        ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    HITBOXES: {options.showHitboxes ? 'VISIBLE' : 'OCULTO'}
                  </button>
                </div>
              </div>

              {/* Quick Tool Launchers: Sound Test, Sprite Inspector & Stage Previewer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  data-testid="open-sound-test"
                  onClick={() => setShowSoundTest(true)}
                  className="py-2.5 px-3 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400 font-arcade font-bold text-xs tracking-wider cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Music className="w-4 h-4 shrink-0" />
                  <span>SOUND TEST ({Object.keys(METAL_SOUNDTRACK).length})</span>
                </button>
                <button
                  type="button"
                  data-testid="open-sprite-inspector"
                  onClick={() => setShowSpriteInspector(true)}
                  className="py-2.5 px-3 bg-zinc-950 hover:bg-zinc-800 text-emerald-300 border border-emerald-400/60 font-arcade font-bold text-xs tracking-wider cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Crosshair className="w-4 h-4 shrink-0" />
                  <span>ANIMATION LAB ({spritesReadyCount}/6 HD)</span>
                </button>
                <button
                  type="button"
                  data-testid="open-stage-previewer"
                  onClick={() => setShowStagePreviewer(true)}
                  className="py-2.5 px-3 bg-zinc-950 hover:bg-zinc-800 text-sky-300 border border-sky-400/60 font-arcade font-bold text-xs tracking-wider cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>ESCENARIOS ({stagesReadyCount}/6 PNG)</span>
                </button>
              </div>
              {(spriteErrors.length > 0 || stageErrors.length > 0) && (
                <div className="bg-rose-950/90 border border-rose-500 p-2 text-xs text-rose-200 font-mono-num">
                  ERROR DE CARGA DE RECURSOS:{' '}
                  {[...spriteErrors, ...stageErrors].join(' | ')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          7. HOW TO PLAY & COMMAND LIST SCREEN ('howto')
         ===================================================================== */}
      {screen === 'howto' && (
        <div
          data-testid="howto-screen"
          className="relative w-full h-full flex flex-col justify-between p-6 md:p-10 bg-zinc-950 overflow-y-auto"
        >
          <div className="max-w-5xl w-full mx-auto space-y-5 my-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h1 className="text-2xl md:text-3xl font-arcade font-bold text-amber-400">
                CÓMO JUGAR · MANUAL DE COMBATE ARCADE &apos;96
              </h1>
              <button
                type="button"
                data-testid="howto-back-button"
                onClick={() => {
                  arcadeAudio.playMenuBack();
                  setScreen('mainMenu');
                }}
                className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-arcade font-bold text-sm cursor-pointer whitespace-nowrap"
              >
                ← VOLVER AL MENÚ (ESC)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 p-4 space-y-1.5 text-xs">
                <h2 className="text-base font-arcade font-bold text-amber-400">
                  CONTROLES JUGADOR 1
                </h2>
                <p>· <strong>W / A / S / D</strong>: Saltar, Izquierda, Agacharse, Derecha</p>
                <p>· <strong>F / G</strong>: Puñetazo Ligero (LP) / Fuerte (HP)</p>
                <p>· <strong>V / B</strong>: Patada Ligera (LK) / Fuerte (HK)</p>
                <p>· <strong>F + V (Cerca)</strong>: Agarre / Derribo Imbloqueable</p>
                <p>· <strong>C / Q / E</strong>: Ataques Especiales 1, 2 y 3</p>
                <p>· <strong>Espacio o R (Barra 100%)</strong>: SUPERATAQUE</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-4 space-y-1.5 text-xs">
                <h2 className="text-base font-arcade font-bold text-sky-400">
                  CONTROLES JUGADOR 2
                </h2>
                <p>· <strong>Flechas (↑ / ← / ↓ / →)</strong>: Saltar, Izquierda, Agacharse, Derecha</p>
                <p>· <strong>J / K</strong>: Puñetazo Ligero (LP) / Fuerte (HP)</p>
                <p>· <strong>N / M</strong>: Patada Ligera (LK) / Fuerte (HK)</p>
                <p>· <strong>J + N (Cerca)</strong>: Agarre / Derribo</p>
                <p>· <strong>L / U / I</strong>: Ataques Especiales 1, 2 y 3</p>
                <p>· <strong>O o Enter (Barra 100%)</strong>: SUPERATAQUE</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-4 space-y-1.5 text-xs">
                <h2 className="text-base font-arcade font-bold text-emerald-400">
                  BLOQUEOS, SALTOS Y REGLAS
                </h2>
                <p>· <strong>Bloqueo Alto</strong>: Mantener atrás (detiene golpes altos y medios).</p>
                <p>· <strong>Bloqueo Bajo</strong>: Mantener abajo-atrás (detiene barridas bajas).</p>
                <p>· <strong>Saltos y Aéreo</strong>: Saltá con W / ↑ y atacá en el aire para abrir la guardia.</p>
                <p>· <strong>Barra de Poder</strong>: Sube al conectar golpes o bloquear; al llegar a 100% habilita el Superataque.</p>
                <p>· <strong>Victoria</strong>: Ganá 2 rounds (1000 HP por round, límite 99 seg).</p>
              </div>
            </div>

            {/* Special Moves Reference Table for All 6 Fighters */}
            <div className="bg-zinc-900 border border-zinc-800 p-4">
              <h2 className="text-base font-arcade font-bold text-white mb-2.5">
                LISTA DE MOVIMIENTOS ESPECIALES Y SUPERATAQUES
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {CHARACTER_ORDER.map((cid) => {
                  const ch = CHARACTERS[cid];
                  return (
                    <div
                      key={cid}
                      className="p-3 bg-zinc-950 border border-zinc-800 space-y-1"
                    >
                      <div className="font-arcade font-bold text-amber-400 text-sm">
                        {ch.name}
                      </div>
                      <div>1. {ch.moves.special1.name} (C o ↓↘→)</div>
                      <div>2. {ch.moves.special2.name} (Q o →↓↘)</div>
                      <div>3. {ch.moves.special3.name} (E o ↓↙←)</div>
                      <div className="text-rose-400 font-bold">
                        ★ SUPER: {ch.moves.super.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showSpriteInspector && (
        <SpriteInspectorModal
          initialCharacter={p1Char}
          onClose={() => setShowSpriteInspector(false)}
        />
      )}

      {showSoundTest && (
        <SoundTestModal
          options={options}
          onUpdateOptions={(partial) =>
            setOptions((prev) => ({ ...prev, ...partial }))
          }
          onClose={() => setShowSoundTest(false)}
        />
      )}

      {showStagePreviewer && (
        <StagePreviewerModal
          initialStage={selectedStage}
          onSelectStageForMatch={setSelectedStage}
          onClose={() => setShowStagePreviewer(false)}
        />
      )}
    </main>
  );
}
