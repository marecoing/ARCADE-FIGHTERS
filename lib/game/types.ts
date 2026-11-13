export type CharacterId =
  | 'mostasa'
  | 'braian'
  | 'rag'
  | 'patova'
  | 'jenny'
  | 'alien';

export type FighterState =
  | 'idle'
  | 'walking'
  | 'crouching'
  | 'jumping'
  | 'attacking'
  | 'blocking'
  | 'hitstun'
  | 'knockdown'
  | 'recovering'
  | 'special'
  | 'super'
  | 'victory'
  | 'defeated';

export type FighterHitReaction =
  | 'none'
  | 'light'
  | 'heavy'
  | 'low'
  | 'air'
  | 'counter'
  | 'guard'
  | 'knockdown'
  | 'air_knockdown'
  | 'recovery';

export type AttackId =
  | 'lp'
  | 'hp'
  | 'lk'
  | 'hk'
  | 'clp'
  | 'chp'
  | 'clk'
  | 'chk'
  | 'jlp'
  | 'jhp'
  | 'jlk'
  | 'jhk'
  | 'grab'
  | 'special1'
  | 'special2'
  | 'special3'
  | 'super';

export type HitLevel = 'high' | 'mid' | 'low' | 'throw';

export interface RectBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AttackFrameData {
  id: AttackId;
  name: string;
  command: string;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  chipDamage: number;
  hitstun: number;
  blockstun: number;
  pushback: number;
  knockbackX: number;
  knockbackY: number;
  hitstop: number;
  meterGain: number;
  hitLevel: HitLevel;
  attackLevel?: 'high' | 'mid' | 'low';
  causesKnockdown: boolean;
  invulnerableEndFrame: number;
  armorEndFrame?: number;
  priority?: number;
  juggleLimit?: number;
  cancelWindowStart: number;
  cancelWindowEnd: number;
  cancelOptions: AttackId[];
  hitbox: RectBox;
  moveVx: number;
  moveVy: number;
  spawnsProjectile?: boolean;
  teleportOffset?: number;
  effectColor: string;
  secondaryColor: string;
}

export type CombatMove = AttackFrameData;

export interface CharacterStats {
  strength: number; // 1-10
  speed: number; // 1-10
  defense: number; // 1-10
  reach: number; // 1-10
  technique: number; // 1-10
}

export interface CharacterPalette {
  skin: string;
  skinShadow: string;
  hair: string;
  primary: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  boots: string;
  gloves: string;
  aura: string;
}

export interface StageDefinition {
  id: CharacterId;
  name: string;
  location: string;
  skyTop: string;
  skyBottom: string;
  floorTop: string;
  floorBottom: string;
  gridColor: string;
  neonAccent: string;
  musicStyle: string;
}

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  shortName: string;
  nickname: string;
  archetype: string;
  origin: string;
  ageOrType: string;
  bio: string;
  fightingStyle: string;
  introQuote: string;
  victoryQuote: string;
  arcadeEndingTitle: string;
  arcadeEndingText: string[];
  stats: CharacterStats;
  walkSpeedForward: number;
  walkSpeedBackward: number;
  jumpVx: number;
  jumpVy: number;
  gravity: number;
  heightScale: number;
  widthScale: number;
  palette: CharacterPalette;
  altPalette: CharacterPalette;
  stage: StageDefinition;
  moves: Record<AttackId, AttackFrameData>;
}

export interface InputSnapshot {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  lp: boolean;
  hp: boolean;
  lk: boolean;
  hk: boolean;
  grab?: boolean;
  special1: boolean;
  special2: boolean;
  special3: boolean;
  superBtn: boolean;
  justPressed: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    lp: boolean;
    hp: boolean;
    lk: boolean;
    hk: boolean;
    grab?: boolean;
    special1: boolean;
    special2: boolean;
    special3: boolean;
    superBtn: boolean;
  };
}

export interface BufferedInputEntry {
  frame: number;
  dir: 'N' | 'U' | 'D' | 'B' | 'F' | 'DF' | 'DB' | 'UF' | 'UB';
  lp: boolean;
  hp: boolean;
  lk: boolean;
  hk: boolean;
  grab?: boolean;
  special1?: boolean;
  special2?: boolean;
  special3?: boolean;
  superBtn?: boolean;
}

export interface FighterRuntime {
  playerIndex: 1 | 2;
  characterId: CharacterId;
  isAltPalette: boolean;
  isCpu: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1; // 1 = right, -1 = left
  hp: number;
  maxHp: number;
  trailingHp: number;
  meter: number; // 0 to 100
  maxMeter: number;
  state: FighterState;
  stateFrame: number;
  currentAttack: AttackId | null;
  attackHasHit: boolean;
  attackHasBeenBlocked?: boolean;
  hitReaction: FighterHitReaction;
  hitstunFrames: number;
  blockstunFrames: number;
  knockdownFrames: number;
  invulnerableFrames: number;
  flashFrames: number;
  dashFrames: number;
  dashDir: 1 | -1 | 0;
  chainCount: number;
  juggleCount: number;
  comboCount: number;
  comboDamage: number;
  maxComboReached: number;
  totalDamageDealt: number;
  scaleX: number;
  scaleY: number;
  walkPhase: number;
  crouching: boolean;
  grounded: boolean;
  inputBuffer: BufferedInputEntry[];
  aiCooldown: number;
  aiCurrentPlan: 'approach' | 'retreat' | 'zone' | 'pressure' | 'defend';
  aiPlanTimer: number;
}

export interface ProjectileRuntime {
  id: number;
  ownerPlayer: 1 | 2;
  characterId: CharacterId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  chipDamage: number;
  hitstun: number;
  blockstun: number;
  pushback: number;
  color: string;
  coreColor: string;
  active: boolean;
  lifeFrames: number;
}

export interface ParticleRuntime {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  type:
    | 'spark'
    | 'dust'
    | 'energy'
    | 'electric'
    | 'hitring'
    | 'retazo'
    | 'guard_ring'
    | 'counter_burst'
    | 'slash_arc';
}

export type GameMode = 'arcade' | 'versus' | 'cpu' | 'training';
export type DifficultyLevel = 'EASY' | 'NORMAL' | 'HARD';
export type ScreenState =
  | 'title'
  | 'mainMenu'
  | 'select'
  | 'vs'
  | 'playing'
  | 'paused'
  | 'gameover'
  | 'ending'
  | 'options'
  | 'howto'
  | 'soundtest';

export interface TrainingSettings {
  dummyBehavior: 'stand' | 'crouch' | 'jump' | 'block_all' | 'cpu';
  infiniteHp: boolean;
  infiniteMeter: boolean;
  showHitboxes: boolean;
  showFrameData: boolean;
}

export interface GameOptions {
  musicVolume: number; // 0-100
  sfxVolume: number; // 0-100
  musicEnabled: boolean;
  sfxEnabled: boolean;
  chipMode8Bit: 'nes_pure' | 'metal_overdrive';
  dynamicMusicIntensity: boolean;
  difficulty: DifficultyLevel;
  roundsToWin: 1 | 2 | 3;
  scanlines: boolean;
  cameraShake: boolean;
  showHitboxes: boolean;
  muted: boolean;
}

export interface RoundAnnouncement {
  text: string;
  subtext?: string;
  framesRemaining: number;
  totalFrames: number;
  color: string;
}

export interface CombatCalloutBanner {
  id: number;
  player: 1 | 2;
  text: string;
  subtext?: string;
  color: string;
  framesRemaining: number;
  totalFrames: number;
}

export interface MatchSimulationState {
  frame: number;
  cameraX: number;
  cameraY: number;
  cameraShakeTrauma: number;
  hitstopFrames: number;
  superFreezeFrames: number;
  superFreezeActor: 1 | 2 | null;
  superMoveTitle: string;
  roundNumber: number;
  roundTimerFrames: number; // 99 * 60
  p1RoundsWon: number;
  p2RoundsWon: number;
  roundPhase: 'intro' | 'fighting' | 'ko_slowmo' | 'round_over' | 'match_over';
  roundPhaseFrames: number;
  roundWinner: 1 | 2 | 'draw' | null;
  matchWinner: 1 | 2 | null;
  wasPerfect: boolean;
  wasSuperFinish: boolean;
  stageId: CharacterId;
  announcement: RoundAnnouncement | null;
  combatCallout?: CombatCalloutBanner | null;
  p1: FighterRuntime;
  p2: FighterRuntime;
  projectiles: ProjectileRuntime[];
  particles: ParticleRuntime[];
  lastHitEvent: {
    frame: number;
    attacker: 1 | 2;
    moveId?: AttackId;
    moveName: string;
    damage: number;
    blocked: boolean;
    isCounter?: boolean;
    isPunish?: boolean;
    contactX?: number;
    contactY?: number;
    scalingPercent?: number;
    frameAdvantage?: number;
  } | null;
}
