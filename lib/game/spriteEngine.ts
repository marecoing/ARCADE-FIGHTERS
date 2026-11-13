import {
  AttackId,
  CharacterId,
  FighterRuntime,
  FighterState,
} from './types';
import {
  CharacterSpriteSheetConfig,
  SPRITE_SHEET_CONFIGS,
  SpriteCellFrame,
} from './spriteData';
import {
  HD_ATLAS_MANIFESTS,
  HdAnimationClip,
  HdAnimationStateName,
  HdCharacterAtlasManifest,
  HdSpriteFrame,
} from './hdAtlasData';
import { CHARACTERS } from './characters';

export type AnimationName =
  | HdAnimationStateName
  | 'jump'
  | 'block'
  | 'hit'
  | 'special'
  | 'super';

export const ALL_25_HD_ANIMATION_STATES: {
  id: HdAnimationStateName;
  label: string;
  category: 'Base' | 'Salto' | 'Defensa' | 'Ataque' | 'Daño' | 'Especial';
}[] = [
  { id: 'idle', label: '1. Idle (Posición de Guardia)', category: 'Base' },
  { id: 'walkForward', label: '2. Caminar Adelante', category: 'Base' },
  { id: 'walkBackward', label: '3. Caminar Atrás', category: 'Base' },
  { id: 'dash', label: '4. Dash / Impulso Rápido', category: 'Base' },
  { id: 'jumpStart', label: '5. Inicio de Salto (Jump Start)', category: 'Salto' },
  { id: 'jumpRise', label: '6. Subida de Salto (Jump Rise)', category: 'Salto' },
  { id: 'jumpApex', label: '7. Punto Máximo (Jump Apex)', category: 'Salto' },
  { id: 'jumpFall', label: '8. Caída de Salto (Jump Fall)', category: 'Salto' },
  { id: 'jumpLand', label: '9. Aterrizaje (Jump Land)', category: 'Salto' },
  { id: 'crouch', label: '10. Agacharse (Crouch)', category: 'Defensa' },
  { id: 'guardHigh', label: '11. Guardia Alta (Guard High)', category: 'Defensa' },
  { id: 'guardLow', label: '12. Guardia Baja (Guard Low)', category: 'Defensa' },
  { id: 'lightPunch', label: '13. Puño Rápido (LP)', category: 'Ataque' },
  { id: 'heavyPunch', label: '14. Puño Fuerte (HP)', category: 'Ataque' },
  { id: 'lightKick', label: '15. Patada Rápida (LK)', category: 'Ataque' },
  { id: 'heavyKick', label: '16. Patada Fuerte (HK)', category: 'Ataque' },
  { id: 'special1', label: '17. Ataque Especial 1', category: 'Especial' },
  { id: 'special2', label: '18. Ataque Especial 2', category: 'Especial' },
  { id: 'superAttack', label: '19. Superataque (100% Barra)', category: 'Especial' },
  { id: 'hitLight', label: '20. Impacto Leve (Hit Light)', category: 'Daño' },
  { id: 'hitHeavy', label: '21. Impacto Fuerte (Hit Heavy)', category: 'Daño' },
  { id: 'knockdown', label: '22. Derribo / Caída al Suelo', category: 'Daño' },
  { id: 'getUp', label: '23. Levantarse del Suelo (Get Up)', category: 'Daño' },
  { id: 'victory', label: '24. Pose de Victoria', category: 'Especial' },
  { id: 'defeat', label: '25. Derrota (KO en Suelo)', category: 'Daño' },
];

export interface FrameData {
  frameIndex: number;
  frameId: string;
  row: number;
  col: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  anchorX: number;
  footY: number;
  offsetX: number;
  offsetY: number;
  durationMs: number;
  rotationDeg?: number;
  sourceType: 'HD_ATLAS' | 'LEGACY_FALLBACK';
  uniformScale: number;
}

export interface SpriteAnimation {
  name: AnimationName;
  label: string;
  frames: FrameData[];
  loop: boolean;
  isNativeIllustrated: boolean;
  sourceType: 'HD_ATLAS' | 'LEGACY_FALLBACK';
  transitionalNote?: string;
}

export interface LoadedSpriteAsset {
  characterId: CharacterId;
  config: CharacterSpriteSheetConfig;
  hdManifest: HdCharacterAtlasManifest;
  // Preserved 1254x1254 original sprite sheet (for portraits & legacy fallback comparison)
  image: HTMLImageElement | null;
  altCanvas: HTMLCanvasElement | null;
  naturalWidth: number;
  naturalHeight: number;
  status: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  // Primary 1536x1024 HD animation atlas (Combat Animation System 2.0)
  hdImage: HTMLImageElement | null;
  hdAltCanvas: HTMLCanvasElement | null;
  hdNaturalWidth: number;
  hdNaturalHeight: number;
  hdStatus: 'idle' | 'loading' | 'ready' | 'error';
  hdErrorMessage: string | null;
}

export interface MissingAnimationEntry {
  animation: AnimationName;
  label: string;
  status: 'NATIVE_ILLUSTRATED' | 'TRANSITIONAL_ADAPTED';
  sourceFramesUsed: string;
  description: string;
}

export const MISSING_ANIMATIONS_REPORT: MissingAnimationEntry[] =
  ALL_25_HD_ANIMATION_STATES.map((item) => ({
    animation: item.id,
    label: item.label,
    status: 'NATIVE_ILLUSTRATED',
    sourceFramesUsed: `Atlas HD (1536×1024) · Clip '${item.id}'`,
    description: `Secuencia multi-fotograma extraída del nuevo Atlas HD con respaldo automático a spritesheet.png (1254×1254).`,
  }));

function buildHdFrameData(
  hdFrame: HdSpriteFrame,
  seqIndex: number,
  uniformScale: number,
  durationScale = 1
): FrameData {
  return {
    frameIndex: seqIndex,
    frameId: hdFrame.id,
    row: hdFrame.row,
    col: hdFrame.col,
    sourceX: hdFrame.x,
    sourceY: hdFrame.y,
    sourceWidth: hdFrame.width,
    sourceHeight: hdFrame.height,
    bboxX: 0,
    bboxY: 0,
    bboxWidth: hdFrame.width,
    bboxHeight: hdFrame.height,
    anchorX: hdFrame.anchorX,
    footY: hdFrame.anchorY,
    offsetX: hdFrame.offsetX,
    offsetY: hdFrame.offsetY,
    durationMs: Math.max(35, Math.round(hdFrame.durationMs * durationScale)),
    rotationDeg: 0,
    sourceType: 'HD_ATLAS',
    uniformScale,
  };
}

function buildLegacyFrameData(
  cell: SpriteCellFrame,
  uniformScale: number,
  durationMs: number,
  offsetX = 0,
  offsetY = 0,
  rotationDeg = 0
): FrameData {
  return {
    frameIndex: cell.index,
    frameId: `legacy_${cell.index}`,
    row: cell.row,
    col: cell.col,
    sourceX: cell.sourceX,
    sourceY: cell.sourceY,
    sourceWidth: cell.sourceWidth,
    sourceHeight: cell.sourceHeight,
    bboxX: cell.bboxX,
    bboxY: cell.bboxY,
    bboxWidth: cell.bboxWidth,
    bboxHeight: cell.bboxHeight,
    anchorX: cell.anchorX,
    footY: cell.footY,
    offsetX,
    offsetY,
    durationMs,
    rotationDeg,
    sourceType: 'LEGACY_FALLBACK',
    uniformScale,
  };
}

function normalizeClipAlias(name: AnimationName): HdAnimationStateName {
  switch (name) {
    case 'jump':
      return 'jumpRise';
    case 'block':
      return 'guardHigh';
    case 'hit':
      return 'hitLight';
    case 'special':
      return 'special1';
    case 'super':
      return 'superAttack';
    default:
      return name;
  }
}

export function buildLegacyCharacterAnimations(
  characterId: CharacterId
): Record<AnimationName, SpriteAnimation> {
  const cfg = SPRITE_SHEET_CONFIGS[characterId];
  const f = cfg.frames;
  const s = cfg.uniformScale540p;
  const charDef = CHARACTERS[characterId];
  const speedFactor = 1 - (charDef.stats.speed - 6) * 0.045;
  const dur = (ms: number) => Math.max(45, Math.round(ms * speedFactor));

  const mk = (
    name: AnimationName,
    label: string,
    loop: boolean,
    frames: FrameData[],
    isNative = true,
    note?: string
  ): SpriteAnimation => ({
    name,
    label,
    loop,
    frames,
    isNativeIllustrated: isNative,
    sourceType: 'LEGACY_FALLBACK',
    transitionalNote: note,
  });

  const base: Record<HdAnimationStateName, SpriteAnimation> = {
    idle: mk('idle', 'Idle (Original 4×4)', true, [
      buildLegacyFrameData(f[0], s, dur(150)),
      buildLegacyFrameData(f[1], s, dur(150)),
      buildLegacyFrameData(f[2], s, dur(150)),
      buildLegacyFrameData(f[3], s, dur(150)),
    ]),
    walkForward: mk('walkForward', 'Caminar Adelante (Original 4×4)', true, [
      buildLegacyFrameData(f[4], s, dur(115)),
      buildLegacyFrameData(f[5], s, dur(115)),
      buildLegacyFrameData(f[6], s, dur(115)),
      buildLegacyFrameData(f[7], s, dur(115)),
    ]),
    walkBackward: mk('walkBackward', 'Caminar Atrás (Original 4×4)', true, [
      buildLegacyFrameData(f[7], s, dur(125)),
      buildLegacyFrameData(f[6], s, dur(125)),
      buildLegacyFrameData(f[5], s, dur(125)),
      buildLegacyFrameData(f[4], s, dur(125)),
    ]),
    dash: mk('dash', 'Dash (Original 4×4)', false, [
      buildLegacyFrameData(f[4], s, dur(75)),
      buildLegacyFrameData(f[5], s, dur(75)),
    ]),
    jumpStart: mk('jumpStart', 'Inicio Salto (Original)', false, [
      buildLegacyFrameData(f[1], s, 90),
    ], false),
    jumpRise: mk('jumpRise', 'Subida Salto (Original)', false, [
      buildLegacyFrameData(f[12], s, 160),
    ], false),
    jumpApex: mk('jumpApex', 'Cima Salto (Original)', false, [
      buildLegacyFrameData(f[12], s, 140),
    ], false),
    jumpFall: mk('jumpFall', 'Caída Salto (Original)', false, [
      buildLegacyFrameData(f[15], s, 160),
    ], false),
    jumpLand: mk('jumpLand', 'Aterrizaje (Original)', false, [
      buildLegacyFrameData(f[1], s, 90),
    ], false),
    crouch: mk('crouch', 'Agacharse (Original)', true, [
      buildLegacyFrameData(f[1], s, 200),
    ], false),
    guardHigh: mk('guardHigh', 'Guardia Alta (Original)', true, [
      buildLegacyFrameData(f[8], s, 180, 6, 0),
    ], false),
    guardLow: mk('guardLow', 'Guardia Baja (Original)', true, [
      buildLegacyFrameData(f[1], s, 180, 6, 0),
    ], false),
    lightPunch: mk('lightPunch', 'Puño Rápido LP (Original)', false, [
      buildLegacyFrameData(f[8], s, dur(65)),
      buildLegacyFrameData(f[9], s, dur(110)),
      buildLegacyFrameData(f[10], s, dur(75)),
      buildLegacyFrameData(f[11], s, dur(65)),
    ]),
    heavyPunch: mk('heavyPunch', 'Puño Fuerte HP (Original)', false, [
      buildLegacyFrameData(f[8], s, dur(95)),
      buildLegacyFrameData(f[9], s, dur(150), -6, 0),
      buildLegacyFrameData(f[10], s, dur(110)),
      buildLegacyFrameData(f[11], s, dur(95)),
    ]),
    lightKick: mk('lightKick', 'Patada Rápida LK (Original)', false, [
      buildLegacyFrameData(f[12], s, dur(70)),
      buildLegacyFrameData(f[13], s, dur(115)),
      buildLegacyFrameData(f[14], s, dur(90)),
      buildLegacyFrameData(f[15], s, dur(75)),
    ]),
    heavyKick: mk('heavyKick', 'Patada Fuerte HK (Original)', false, [
      buildLegacyFrameData(f[12], s, dur(85)),
      buildLegacyFrameData(f[13], s, dur(95)),
      buildLegacyFrameData(f[14], s, dur(165), -8, 0),
      buildLegacyFrameData(f[15], s, dur(105)),
    ]),
    hitLight: mk('hitLight', 'Impacto Leve (Original)', false, [
      buildLegacyFrameData(f[11], s, 120, 10, 0, -6),
    ], false),
    hitHeavy: mk('hitHeavy', 'Impacto Fuerte (Original)', false, [
      buildLegacyFrameData(f[11], s, 110, 12, 0, -6),
      buildLegacyFrameData(f[12], s, 140, 16, 0, -10),
    ], false),
    knockdown: mk('knockdown', 'Derribo (Original)', false, [
      buildLegacyFrameData(f[12], s, 140, 14, 0, -28),
      buildLegacyFrameData(f[11], s, 240, 18, 0, -72),
    ], false),
    getUp: mk('getUp', 'Levantarse (Original)', false, [
      buildLegacyFrameData(f[1], s, 150, 6, 0, -15),
      buildLegacyFrameData(f[0], s, 120),
    ], false),
    special1: mk('special1', 'Especial 1 (Original)', false, [
      buildLegacyFrameData(f[8], s, dur(75)),
      buildLegacyFrameData(f[9], s, dur(130)),
      buildLegacyFrameData(f[10], s, dur(130)),
      buildLegacyFrameData(f[11], s, dur(90)),
    ]),
    special2: mk('special2', 'Especial 2 (Original)', false, [
      buildLegacyFrameData(f[12], s, dur(80)),
      buildLegacyFrameData(f[13], s, dur(110)),
      buildLegacyFrameData(f[14], s, dur(140)),
      buildLegacyFrameData(f[15], s, dur(95)),
    ]),
    superAttack: mk('superAttack', 'Superataque (Original)', false, [
      buildLegacyFrameData(f[8], s, 70),
      buildLegacyFrameData(f[9], s, 110, -8, 0),
      buildLegacyFrameData(f[12], s, 65),
      buildLegacyFrameData(f[13], s, 95),
      buildLegacyFrameData(f[14], s, 160, -12, 0),
      buildLegacyFrameData(f[10], s, 85),
    ], false),
    victory: mk('victory', 'Victoria (Original)', true, [
      buildLegacyFrameData(f[8], s, 140),
      buildLegacyFrameData(f[9], s, 220),
      buildLegacyFrameData(f[14], s, 240),
      buildLegacyFrameData(f[0], s, 260),
    ], false),
    defeat: mk('defeat', 'Derrota (Original)', false, [
      buildLegacyFrameData(f[11], s, 400, 16, 0, -75),
    ], false),
  };

  return {
    ...base,
    jump: { ...base.jumpRise, name: 'jump' },
    block: { ...base.guardHigh, name: 'block' },
    hit: { ...base.hitLight, name: 'hit' },
    special: { ...base.special1, name: 'special' },
    super: { ...base.superAttack, name: 'super' },
  };
}

export function buildCharacterAnimations(
  characterId: CharacterId,
  useLegacyFallback = false
): Record<AnimationName, SpriteAnimation> {
  if (useLegacyFallback) {
    return buildLegacyCharacterAnimations(characterId);
  }

  const manifest = HD_ATLAS_MANIFESTS[characterId];
  const charDef = CHARACTERS[characterId];
  const speedFactor = 1 - (charDef.stats.speed - 6) * 0.035;
  const scale = manifest.uniformScale540p;

  const labelMap: Record<HdAnimationStateName, string> = {
    idle: 'Guardia / Reposo (Idle HD)',
    walkForward: 'Caminar Adelante (HD)',
    walkBackward: 'Caminar Atrás (HD)',
    jumpStart: 'Inicio de Salto (HD)',
    jumpRise: 'Ascenso de Salto (HD)',
    jumpApex: 'Cima de Salto (HD)',
    jumpFall: 'Descenso de Salto (HD)',
    jumpLand: 'Aterrizaje (HD)',
    crouch: 'Agacharse (HD)',
    guardHigh: 'Bloqueo Alto (HD)',
    guardLow: 'Bloqueo Bajo (HD)',
    lightPunch: 'Puñetazo Rápido LP (HD)',
    heavyPunch: 'Puñetazo Fuerte HP (HD)',
    lightKick: 'Patada Rápida LK (HD)',
    heavyKick: 'Patada Fuerte HK (HD)',
    hitLight: 'Daño Leve (Hit Light HD)',
    hitHeavy: 'Daño Fuerte (Hit Heavy HD)',
    knockdown: 'Derribo y Caída al Suelo (HD)',
    getUp: 'Levantarse del Suelo (Get Up HD)',
    dash: 'Impulso / Dash (HD)',
    special1: 'Técnica Especial 1 (HD)',
    special2: 'Técnica Especial 2 (HD)',
    superAttack: 'Superataque 100% (HD)',
    victory: 'Celebración de Victoria (HD)',
    defeat: 'Derrota / KO en Suelo (HD)',
  };

  const result = {} as Record<AnimationName, SpriteAnimation>;

  (Object.keys(manifest.clips) as HdAnimationStateName[]).forEach((stateKey) => {
    const clip: HdAnimationClip = manifest.clips[stateKey];
    const frames = clip.frames.map((hdFrame, idx) =>
      buildHdFrameData(hdFrame, idx, scale, speedFactor)
    );
    result[stateKey] = {
      name: stateKey,
      label: labelMap[stateKey] || stateKey,
      frames,
      loop: clip.loop,
      isNativeIllustrated: true,
      sourceType: 'HD_ATLAS',
    };
  });

  // Backward-compatible aliases
  result.jump = { ...result.jumpRise, name: 'jump' };
  result.block = { ...result.guardHigh, name: 'block' };
  result.hit = { ...result.hitLight, name: 'hit' };
  result.special = { ...result.special1, name: 'special' };
  result.super = { ...result.superAttack, name: 'super' };

  return result;
}

/**
 * COMBAT ANIMATION SYSTEM 2.0: Central SpriteAnimationController
 * Manages character graphical animation state across all 25 HD clips and
 * supports toggling between the new 1536x1024 HD Atlas and the preserved 1254x1254 backup sheet.
 */
export class SpriteAnimationController {
  public readonly characterId: CharacterId;
  public readonly config: CharacterSpriteSheetConfig;
  public readonly hdManifest: HdCharacterAtlasManifest;
  public animations: Record<AnimationName, SpriteAnimation>;

  private currentAnimationName: AnimationName = 'idle';
  private currentFrameIdx = 0;
  private accumulatedTimeMs = 0;
  private playing = true;
  private speedMultiplier = 1;
  private facingRight = true;
  private useLegacyFallback = false;

  constructor(characterId: CharacterId, useLegacyFallback = false) {
    this.characterId = characterId;
    this.config = SPRITE_SHEET_CONFIGS[characterId];
    this.hdManifest = HD_ATLAS_MANIFESTS[characterId];
    this.useLegacyFallback = useLegacyFallback;
    this.animations = buildCharacterAnimations(characterId, useLegacyFallback);
  }

  public setUseLegacyFallback(useLegacy: boolean): void {
    if (this.useLegacyFallback === useLegacy) return;
    this.useLegacyFallback = useLegacy;
    this.animations = buildCharacterAnimations(this.characterId, useLegacy);
    this.currentFrameIdx = 0;
    this.accumulatedTimeMs = 0;
  }

  public isUsingLegacyFallback(): boolean {
    return this.useLegacyFallback;
  }

  public setAnimation(name: AnimationName, forceReset = false): void {
    const targetName = this.animations[name] ? name : normalizeClipAlias(name);
    if (this.currentAnimationName === targetName && !forceReset) return;
    this.currentAnimationName = targetName;
    this.currentFrameIdx = 0;
    this.accumulatedTimeMs = 0;
  }

  public getAnimationName(): AnimationName {
    return this.currentAnimationName;
  }

  public getCurrentAnimation(): SpriteAnimation {
    return (
      this.animations[this.currentAnimationName] ?? this.animations.idle
    );
  }

  public getCurrentFrame(): FrameData {
    const anim = this.getCurrentAnimation();
    return anim.frames[this.currentFrameIdx] ?? anim.frames[0];
  }

  public getCurrentFrameSequenceIndex(): number {
    return this.currentFrameIdx;
  }

  public setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, Math.min(4, multiplier));
  }

  public getSpeed(): number {
    return this.speedMultiplier;
  }

  public setFacingRight(facingRight: boolean): void {
    this.facingRight = facingRight;
  }

  public isFacingRight(): boolean {
    return this.facingRight;
  }

  public getScale(): number {
    return this.useLegacyFallback
      ? this.config.uniformScale540p
      : this.hdManifest.uniformScale540p;
  }

  public stepForward(): void {
    const anim = this.getCurrentAnimation();
    this.accumulatedTimeMs = 0;
    this.currentFrameIdx = (this.currentFrameIdx + 1) % anim.frames.length;
  }

  public stepBackward(): void {
    const anim = this.getCurrentAnimation();
    this.accumulatedTimeMs = 0;
    this.currentFrameIdx =
      (this.currentFrameIdx - 1 + anim.frames.length) % anim.frames.length;
  }

  public update(deltaMs: number): void {
    if (!this.playing) return;
    const anim = this.getCurrentAnimation();
    if (anim.frames.length <= 1) return;

    this.accumulatedTimeMs += deltaMs * this.speedMultiplier;
    let currentFrame = anim.frames[this.currentFrameIdx];

    while (this.accumulatedTimeMs >= currentFrame.durationMs) {
      this.accumulatedTimeMs -= currentFrame.durationMs;
      if (this.currentFrameIdx + 1 < anim.frames.length) {
        this.currentFrameIdx++;
      } else if (anim.loop) {
        this.currentFrameIdx = 0;
      } else {
        this.currentFrameIdx = anim.frames.length - 1;
        break;
      }
      currentFrame = anim.frames[this.currentFrameIdx];
    }
  }
}

function pickPhaseSynchronizedFrame(
  clip: HdAnimationClip,
  uniformScale: number,
  t: number,
  startup: number,
  active: number,
  recovery: number
): FrameData {
  const frames = clip.frames;
  const n = frames.length;
  if (n <= 1) {
    return buildHdFrameData(frames[0], 0, uniformScale);
  }

  const activeEnd = startup + active;
  const startupCount = Math.max(1, Math.min(Math.floor(n * 0.3), n - 2));
  const recoveryCount = Math.max(1, Math.min(Math.floor(n * 0.28), n - startupCount - 1));
  const activeCount = Math.max(1, n - startupCount - recoveryCount);

  let idx = 0;
  if (t < startup) {
    const p = Math.max(0, Math.min(0.999, t / Math.max(1, startup)));
    idx = Math.floor(p * startupCount);
  } else if (t < activeEnd) {
    const p = Math.max(0, Math.min(0.999, (t - startup) / Math.max(1, active)));
    idx = startupCount + Math.floor(p * activeCount);
  } else {
    const p = Math.max(
      0,
      Math.min(0.999, (t - activeEnd) / Math.max(1, recovery))
    );
    idx = startupCount + activeCount + Math.floor(p * recoveryCount);
  }

  const clampedIdx = Math.max(0, Math.min(n - 1, idx));
  return buildHdFrameData(frames[clampedIdx], clampedIdx, uniformScale);
}

/**
 * COMBAT ANIMATION SYSTEM 2.0: 60Hz Combat State -> HD Sprite Frame Resolver
 * Maps any FighterRuntime at 60Hz to its exact HD animation state and frame
 * so startup, active hitboxes, recovery, jump phases, guard, hitstun, knockdown,
 * and getUp transitions use the full multi-row HD sprite sheets.
 */
export function resolveCombatSpriteFrame(fighter: FighterRuntime): {
  animationName: AnimationName;
  frame: FrameData;
  crouchCompressionY: number;
  knockdownTiltDeg: number;
} {
  const manifest = HD_ATLAS_MANIFESTS[fighter.characterId];
  const scale = manifest.uniformScale540p;
  const clips = manifest.clips;
  const charDef = CHARACTERS[fighter.characterId];
  const state: FighterState = fighter.state;
  const t = Math.max(0, fighter.stateFrame);

  // 1. Attacking, Special & Super States (phase-locked to startup -> active -> recovery)
  if (state === 'attacking' || state === 'special' || state === 'super') {
    const moveId: AttackId = fighter.currentAttack || 'lp';
    const move = charDef.moves[moveId] || charDef.moves.lp;
    const startup = move.startup;
    const active = move.active;
    const recovery = move.recovery;

    let clipName: HdAnimationStateName = 'lightPunch';
    if (state === 'super' || moveId === 'super') {
      clipName = 'superAttack';
    } else if (state === 'special') {
      if (moveId === 'special1') {
        clipName = 'special1';
      } else {
        clipName = 'special2';
      }
    } else {
      switch (moveId) {
        case 'lp':
        case 'clp':
        case 'jlp':
          clipName = 'lightPunch';
          break;
        case 'hp':
        case 'chp':
        case 'jhp':
          clipName = 'heavyPunch';
          break;
        case 'lk':
        case 'clk':
        case 'jlk':
          clipName = 'lightKick';
          break;
        case 'hk':
        case 'chk':
        case 'jhk':
          clipName = 'heavyKick';
          break;
        default:
          clipName = 'lightPunch';
          break;
      }
    }

    const clip = clips[clipName] || clips.lightPunch;
    const frame = pickPhaseSynchronizedFrame(
      clip,
      scale,
      t,
      startup,
      active,
      recovery
    );

    return {
      animationName: clipName,
      frame,
      crouchCompressionY:
        moveId === 'clp' || moveId === 'chp' || moveId === 'clk' || moveId === 'chk'
          ? 0.94
          : 1,
      knockdownTiltDeg: 0,
    };
  }

  // 2. Dash / Impulse state or Walking Forward / Backward
  if (fighter.dashFrames > 0 && state === 'walking') {
    const clip = clips.dash;
    const idx = Math.min(
      clip.frames.length - 1,
      Math.floor((14 - fighter.dashFrames) / 3) % clip.frames.length
    );
    return {
      animationName: 'dash',
      frame: buildHdFrameData(clip.frames[idx], idx, scale),
      crouchCompressionY: 1,
      knockdownTiltDeg: 0,
    };
  }

  if (state === 'walking') {
    const isMovingForward = fighter.vx * fighter.facing >= 0;
    const speedAbs = Math.abs(fighter.vx);
    const clipName: HdAnimationStateName =
      isMovingForward && speedAbs > 6.5
        ? 'dash'
        : isMovingForward
          ? 'walkForward'
          : 'walkBackward';
    const clip = clips[clipName];
    const idx = Math.floor(t / 5) % clip.frames.length;
    return {
      animationName: clipName,
      frame: buildHdFrameData(clip.frames[idx], idx, scale),
      crouchCompressionY: 1,
      knockdownTiltDeg: 0,
    };
  }

  // 3. Jumping (jumpStart -> jumpRise -> jumpApex -> jumpFall)
  if (state === 'jumping') {
    let clipName: HdAnimationStateName = 'jumpRise';
    if (t < 4 && fighter.vy < 0) {
      clipName = 'jumpStart';
    } else if (fighter.vy < -2.2) {
      clipName = 'jumpRise';
    } else if (Math.abs(fighter.vy) <= 2.2) {
      clipName = 'jumpApex';
    } else {
      clipName = 'jumpFall';
    }
    const clip = clips[clipName];
    const idx = Math.min(clip.frames.length - 1, Math.floor(t / 6) % clip.frames.length);
    return {
      animationName: clipName,
      frame: buildHdFrameData(clip.frames[idx], idx, scale),
      crouchCompressionY: 1,
      knockdownTiltDeg: 0,
    };
  }

  // 4. Crouching (plays transition frames then holds low crouch pose)
  if (state === 'crouching') {
    const clip = clips.crouch;
    const idx = Math.min(clip.frames.length - 1, Math.floor(t / 4));
    return {
      animationName: 'crouch',
      frame: buildHdFrameData(clip.frames[idx], idx, scale),
      crouchCompressionY: 1,
      knockdownTiltDeg: 0,
    };
  }

  // 5. Blocking (Guard High vs Guard Low)
  if (state === 'blocking') {
    const clipName: HdAnimationStateName = fighter.crouching
      ? 'guardLow'
      : 'guardHigh';
    const clip = clips[clipName];
    const idx = Math.min(clip.frames.length - 1, Math.floor(t / 5) % clip.frames.length);
    return {
      animationName: clipName,
      frame: buildHdFrameData(clip.frames[idx], idx, scale),
      crouchCompressionY: 1,
      knockdownTiltDeg: 0,
    };
  }

  // 6. Hitstun (supports all 9 Hit Reaction categories: light, heavy, low, air, counter, etc.)
  if (state === 'hitstun') {
    const isHeavyReaction =
      fighter.hitReaction === 'heavy' ||
      fighter.hitReaction === 'counter' ||
      fighter.hitReaction === 'air' ||
      fighter.hitstunFrames >= 14;
    const clipName: HdAnimationStateName = isHeavyReaction ? 'hitHeavy' : 'hitLight';
    const clip = clips[clipName];
    const totalStun = Math.max(1, t + fighter.hitstunFrames);
    const progress = t / totalStun;
    const idx = Math.min(
      clip.frames.length - 1,
      Math.floor(progress * clip.frames.length)
    );
    return {
      animationName: clipName,
      frame: buildHdFrameData(clip.frames[idx], idx, scale),
      crouchCompressionY: fighter.hitReaction === 'low' ? 0.93 : 1,
      knockdownTiltDeg:
        fighter.hitReaction === 'air'
          ? -12
          : fighter.hitReaction === 'counter'
            ? -6
            : 0,
    };
  }

  // 7. Knockdown, Recovering (getUp) & Defeated (KO)
  if (state === 'knockdown') {
    const clip = clips.knockdown;
    const totalKd = Math.max(1, t + fighter.knockdownFrames);
    const progress = t / totalKd;
    const idx = Math.min(
      clip.frames.length - 1,
      Math.floor(progress * clip.frames.length)
    );
    return {
      animationName: 'knockdown',
      frame: buildHdFrameData(clip.frames[idx], idx, scale),
      crouchCompressionY: 1,
      knockdownTiltDeg: fighter.hitReaction === 'air_knockdown' && !fighter.grounded ? -18 : 0,
    };
  }

  if (state === 'recovering') {
    const clip = clips.getUp;
    const progress = Math.min(0.999, t / 18);
    const idx = Math.min(
      clip.frames.length - 1,
      Math.floor(progress * clip.frames.length)
    );
    return {
      animationName: 'getUp',
      frame: buildHdFrameData(clip.frames[idx], idx, scale),
      crouchCompressionY: 1,
      knockdownTiltDeg: 0,
    };
  }

  if (state === 'defeated') {
    const clip = clips.defeat;
    const idx = Math.min(clip.frames.length - 1, Math.floor(t / 8));
    return {
      animationName: 'defeat',
      frame: buildHdFrameData(clip.frames[idx], idx, scale),
      crouchCompressionY: 1,
      knockdownTiltDeg: 0,
    };
  }

  // 8. Victory
  if (state === 'victory') {
    const clip = clips.victory;
    const idx = Math.floor(t / 7) % clip.frames.length;
    return {
      animationName: 'victory',
      frame: buildHdFrameData(clip.frames[idx], idx, scale),
      crouchCompressionY: 1,
      knockdownTiltDeg: 0,
    };
  }

  // 9. Default: Idle (breathing combat stance)
  const idleClip = clips.idle;
  const idleIdx = Math.floor(t / 7) % idleClip.frames.length;
  return {
    animationName: 'idle',
    frame: buildHdFrameData(idleClip.frames[idleIdx], idleIdx, scale),
    crouchCompressionY: 1,
    knockdownTiltDeg: 0,
  };
}

/**
 * Global Sprite Sheet & HD Atlas Preloader
 * Preloads both:
 * 1) The new 1536x1024 HD Atlas (`atlas_hd.png`) + 2P alternate palette canvas
 * 2) The preserved 1254x1254 Original Sprite Sheet (`spritesheet.png`) + 2P alternate palette canvas
 */
class SpriteSheetManager {
  private assets: Record<CharacterId, LoadedSpriteAsset>;
  private listeners: Set<() => void> = new Set();
  private loadStarted = false;

  constructor() {
    const initial = {} as Record<CharacterId, LoadedSpriteAsset>;
    (Object.keys(SPRITE_SHEET_CONFIGS) as CharacterId[]).forEach((id) => {
      initial[id] = {
        characterId: id,
        config: SPRITE_SHEET_CONFIGS[id],
        hdManifest: HD_ATLAS_MANIFESTS[id],
        image: null,
        altCanvas: null,
        naturalWidth: 0,
        naturalHeight: 0,
        status: 'idle',
        errorMessage: null,
        hdImage: null,
        hdAltCanvas: null,
        hdNaturalWidth: 0,
        hdNaturalHeight: 0,
        hdStatus: 'idle',
        hdErrorMessage: null,
      };
    });
    this.assets = initial;
  }

  public preloadAll(): void {
    if (typeof window === 'undefined') return;
    if (this.loadStarted) return;
    this.loadStarted = true;

    (Object.keys(SPRITE_SHEET_CONFIGS) as CharacterId[]).forEach((id) => {
      this.loadCharacterSheet(id);
      this.loadCharacterHdAtlas(id);
    });
  }

  private buildAltPaletteCanvas(
    img: HTMLImageElement,
    width: number,
    height: number,
    hueRotateDeg: number
  ): HTMLCanvasElement | null {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.filter = `hue-rotate(${hueRotateDeg}deg) saturate(1.15)`;
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';
        return canvas;
      }
    } catch {
      // Fallback to main image if filter unsupported
    }
    return null;
  }

  private loadCharacterSheet(id: CharacterId): void {
    const asset = this.assets[id];
    asset.status = 'loading';
    this.notify();

    const img = new Image();
    img.decoding = 'async';

    const finalizeImage = () => {
      asset.image = img;
      asset.naturalWidth = img.naturalWidth || asset.config.expectedWidth;
      asset.naturalHeight = img.naturalHeight || asset.config.expectedHeight;
      asset.status = 'ready';
      asset.errorMessage = null;
      asset.altCanvas = this.buildAltPaletteCanvas(
        img,
        asset.naturalWidth,
        asset.naturalHeight,
        asset.config.altHueRotateDeg
      );
      this.notify();
    };

    img.onload = () => {
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(finalizeImage)
          .catch(() => finalizeImage());
      } else {
        finalizeImage();
      }
    };

    img.onerror = () => {
      if (img.src.indexOf(asset.config.originalUploadPath) === -1) {
        img.src = asset.config.originalUploadPath;
        return;
      }
      asset.status = 'error';
      asset.errorMessage = `No se pudo cargar spritesheet respaldo: ${asset.config.assetPath}`;
      this.notify();
    };

    img.src = asset.config.assetPath;
  }

  private loadCharacterHdAtlas(id: CharacterId): void {
    const asset = this.assets[id];
    asset.hdStatus = 'loading';
    this.notify();

    const img = new Image();
    img.decoding = 'async';

    const finalizeHd = () => {
      asset.hdImage = img;
      asset.hdNaturalWidth = img.naturalWidth || asset.hdManifest.atlasWidth;
      asset.hdNaturalHeight = img.naturalHeight || asset.hdManifest.atlasHeight;
      asset.hdStatus = 'ready';
      asset.hdErrorMessage = null;
      asset.hdAltCanvas = this.buildAltPaletteCanvas(
        img,
        asset.hdNaturalWidth,
        asset.hdNaturalHeight,
        asset.config.altHueRotateDeg
      );
      this.notify();
    };

    img.onload = () => {
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(finalizeHd)
          .catch(() => finalizeHd());
      } else {
        finalizeHd();
      }
    };

    img.onerror = () => {
      if (img.src.indexOf(asset.hdManifest.originalUploadPath) === -1) {
        img.src = asset.hdManifest.originalUploadPath;
        return;
      }
      asset.hdStatus = 'error';
      asset.hdErrorMessage = `Fallback activo a spritesheet.png para ${id}`;
      this.notify();
    };

    img.src = asset.hdManifest.atlasPath;
  }

  public getAsset(id: CharacterId): LoadedSpriteAsset {
    if (typeof window !== 'undefined' && !this.loadStarted) {
      this.preloadAll();
    }
    return this.assets[id];
  }

  public getAllAssets(): LoadedSpriteAsset[] {
    if (typeof window !== 'undefined' && !this.loadStarted) {
      this.preloadAll();
    }
    return Object.values(this.assets);
  }

  public isAllReady(): boolean {
    return Object.values(this.assets).every(
      (a) => a.hdStatus === 'ready' || a.status === 'ready'
    );
  }

  public getReadyCount(): number {
    return Object.values(this.assets).filter(
      (a) => a.hdStatus === 'ready' || a.status === 'ready'
    ).length;
  }

  public getErrors(): string[] {
    return Object.values(this.assets)
      .filter((a) => a.status === 'error' && a.hdStatus === 'error' && a.errorMessage)
      .map((a) => a.errorMessage as string);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const spriteSheetManager = new SpriteSheetManager();
