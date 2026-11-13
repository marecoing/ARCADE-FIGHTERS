import { CHARACTERS } from './characters';
import { SPRITE_SHEET_CONFIGS } from './spriteData';
import {
  AttackFrameData,
  AttackId,
  BufferedInputEntry,
  CharacterId,
  FighterRuntime,
  InputSnapshot,
  MatchSimulationState,
  ParticleRuntime,
  RectBox,
  TrainingSettings,
} from './types';

export const LOGICAL_WIDTH = 960;
export const LOGICAL_HEIGHT = 540;
export const STAGE_WIDTH = 1280;
export const STAGE_LEFT_BOUND = 110;
export const STAGE_RIGHT_BOUND = 1170;
export const GROUND_Y = 468;
export const ROUND_TIME_SECONDS = 99;
export const FPS = 60;
export const MAX_PARTICLES = 128;

export function createEmptyInputSnapshot(): InputSnapshot {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    lp: false,
    hp: false,
    lk: false,
    hk: false,
    special1: false,
    special2: false,
    special3: false,
    superBtn: false,
    justPressed: {
      up: false,
      down: false,
      left: false,
      right: false,
      lp: false,
      hp: false,
      lk: false,
      hk: false,
      special1: false,
      special2: false,
      special3: false,
      superBtn: false,
    },
  };
}

export function createFighterRuntime(
  playerIndex: 1 | 2,
  characterId: CharacterId,
  isAltPalette: boolean,
  isCpu: boolean
): FighterRuntime {
  const startX = playerIndex === 1 ? 430 : 850;
  const facing = playerIndex === 1 ? 1 : -1;
  return {
    playerIndex,
    characterId,
    isAltPalette,
    isCpu,
    x: startX,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    facing,
    hp: 1000,
    maxHp: 1000,
    trailingHp: 1000,
    meter: 0,
    maxMeter: 100,
    state: 'idle',
    stateFrame: 0,
    currentAttack: null,
    attackHasHit: false,
    attackHasBeenBlocked: false,
    hitReaction: 'none',
    hitstunFrames: 0,
    blockstunFrames: 0,
    knockdownFrames: 0,
    invulnerableFrames: 0,
    flashFrames: 0,
    dashFrames: 0,
    dashDir: 0,
    chainCount: 0,
    juggleCount: 0,
    comboCount: 0,
    comboDamage: 0,
    maxComboReached: 0,
    totalDamageDealt: 0,
    scaleX: 1,
    scaleY: 1,
    walkPhase: 0,
    crouching: false,
    grounded: true,
    inputBuffer: [],
    aiCooldown: 0,
    aiCurrentPlan: 'approach',
    aiPlanTimer: 0,
  };
}

export function createParticlePool(): ParticleRuntime[] {
  const pool: ParticleRuntime[] = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pool.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 4,
      color: '#facc15',
      alpha: 0,
      life: 0,
      maxLife: 20,
      type: 'spark',
    });
  }
  return pool;
}

export function spawnParticles(
  pool: ParticleRuntime[],
  x: number,
  y: number,
  count: number,
  color: string,
  type: ParticleRuntime['type'],
  speedScale = 1
): void {
  let spawned = 0;
  for (let i = 0; i < pool.length && spawned < count; i++) {
    const p = pool[i];
    if (!p.active) {
      const angle =
        (Math.PI * 2 * spawned) / Math.max(1, count) + (i % 3) * 0.2;
      const speed = (2.2 + (i % 5) * 1.4) * speedScale;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - (type === 'dust' ? 1.5 : 0.8);
      p.size =
        type === 'hitring' || type === 'guard_ring'
          ? 14
          : type === 'counter_burst'
            ? 10
            : type === 'slash_arc'
              ? 18
              : 3 + (i % 4) * 2;
      p.color = color;
      p.alpha = 1;
      p.life = 0;
      p.maxLife =
        type === 'hitring' || type === 'guard_ring'
          ? 14
          : type === 'counter_burst'
            ? 18
            : 16 + (i % 10);
      p.type = type;
      spawned++;
    }
  }
}

export function spawnCharacterSignatureHitEffects(
  pool: ParticleRuntime[],
  characterId: CharacterId,
  x: number,
  y: number,
  isHeavyOrSpecial: boolean
): void {
  switch (characterId) {
    case 'mostasa':
      // Gold & electric yellow heavy brawler sparks
      spawnParticles(
        pool,
        x,
        y,
        isHeavyOrSpecial ? 10 : 5,
        '#facc15',
        isHeavyOrSpecial ? 'electric' : 'spark',
        isHeavyOrSpecial ? 1.35 : 0.95
      );
      break;
    case 'braian':
      // Electric blue street speed bursts
      spawnParticles(
        pool,
        x,
        y,
        isHeavyOrSpecial ? 10 : 5,
        '#38bdf8',
        'spark',
        isHeavyOrSpecial ? 1.45 : 1.05
      );
      break;
    case 'rag':
      // Crimson chaotic bursts & fabric retazos
      spawnParticles(
        pool,
        x,
        y,
        isHeavyOrSpecial ? 9 : 4,
        '#f43f5e',
        'retazo',
        isHeavyOrSpecial ? 1.3 : 0.95
      );
      break;
    case 'patova':
      // Heavy shockwave ring + floor dust
      spawnParticles(
        pool,
        x,
        GROUND_Y,
        isHeavyOrSpecial ? 10 : 4,
        '#d4d4d8',
        'dust',
        1.15
      );
      break;
    case 'jenny':
      // Fuchsia & neon-violet glamour arcs
      spawnParticles(
        pool,
        x,
        y,
        isHeavyOrSpecial ? 10 : 5,
        '#e879f9',
        'slash_arc',
        isHeavyOrSpecial ? 1.3 : 0.95
      );
      break;
    case 'alien':
      // Cyan & psychic green cosmic energy
      spawnParticles(
        pool,
        x,
        y,
        isHeavyOrSpecial ? 11 : 5,
        '#2dd4bf',
        'energy',
        isHeavyOrSpecial ? 1.35 : 1.0
      );
      break;
  }
}

export function createInitialMatchState(
  p1Id: CharacterId,
  p2Id: CharacterId,
  p2IsCpu: boolean,
  stageId?: CharacterId
): MatchSimulationState {
  const isSameChar = p1Id === p2Id;
  return {
    frame: 0,
    cameraX: (STAGE_WIDTH - LOGICAL_WIDTH) / 2,
    cameraY: 0,
    cameraShakeTrauma: 0,
    hitstopFrames: 0,
    superFreezeFrames: 0,
    superFreezeActor: null,
    superMoveTitle: '',
    roundNumber: 1,
    roundTimerFrames: ROUND_TIME_SECONDS * FPS,
    p1RoundsWon: 0,
    p2RoundsWon: 0,
    roundPhase: 'intro',
    roundPhaseFrames: 90,
    roundWinner: null,
    matchWinner: null,
    wasPerfect: false,
    wasSuperFinish: false,
    stageId: stageId || p2Id,
    announcement: {
      text: 'ROUND 1',
      subtext: 'FIGHT!',
      framesRemaining: 90,
      totalFrames: 90,
      color: '#facc15',
    },
    combatCallout: null,
    p1: createFighterRuntime(1, p1Id, false, false),
    p2: createFighterRuntime(2, p2Id, isSameChar, p2IsCpu),
    projectiles: [],
    particles: createParticlePool(),
    lastHitEvent: null,
  };
}

export function resetForNextRound(state: MatchSimulationState): void {
  const p1MaxCombo = state.p1.maxComboReached;
  const p1TotalDamage = state.p1.totalDamageDealt;
  const p2MaxCombo = state.p2.maxComboReached;
  const p2TotalDamage = state.p2.totalDamageDealt;
  const p1Meter = state.p1.meter;
  const p2Meter = state.p2.meter;

  state.p1 = createFighterRuntime(
    1,
    state.p1.characterId,
    state.p1.isAltPalette,
    state.p1.isCpu
  );
  state.p2 = createFighterRuntime(
    2,
    state.p2.characterId,
    state.p2.isAltPalette,
    state.p2.isCpu
  );

  state.p1.meter = p1Meter;
  state.p1.maxComboReached = p1MaxCombo;
  state.p1.totalDamageDealt = p1TotalDamage;

  state.p2.meter = p2Meter;
  state.p2.maxComboReached = p2MaxCombo;
  state.p2.totalDamageDealt = p2TotalDamage;

  state.roundNumber += 1;
  state.roundTimerFrames = ROUND_TIME_SECONDS * FPS;
  state.roundPhase = 'intro';
  state.roundPhaseFrames = 90;
  state.roundWinner = null;
  state.wasPerfect = false;
  state.wasSuperFinish = false;
  state.projectiles = [];
  state.hitstopFrames = 0;
  state.superFreezeFrames = 0;
  state.superFreezeActor = null;
  state.combatCallout = null;
  state.cameraX = (STAGE_WIDTH - LOGICAL_WIDTH) / 2;
  state.announcement = {
    text: `ROUND ${state.roundNumber}`,
    subtext: 'FIGHT!',
    framesRemaining: 90,
    totalFrames: 90,
    color: '#facc15',
  };
}

export function boxesOverlap(a: RectBox, b: RectBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function computeContactPoint(
  hitbox: RectBox,
  hurtboxes: RectBox[]
): { x: number; y: number } {
  for (const hb of hurtboxes) {
    if (boxesOverlap(hitbox, hb)) {
      const ix1 = Math.max(hitbox.x, hb.x);
      const iy1 = Math.max(hitbox.y, hb.y);
      const ix2 = Math.min(hitbox.x + hitbox.width, hb.x + hb.width);
      const iy2 = Math.min(hitbox.y + hitbox.height, hb.y + hb.height);
      return {
        x: Math.round((ix1 + ix2) / 2),
        y: Math.round((iy1 + iy2) / 2),
      };
    }
  }
  return {
    x: Math.round(hitbox.x + hitbox.width / 2),
    y: Math.round(hitbox.y + hitbox.height / 2),
  };
}

/**
 * ETAPA B: PUSHBOX — Physical body separation volume in world coordinates.
 */
export function getFighterPushbox(fighter: FighterRuntime): RectBox {
  const pushWidths: Record<CharacterId, number> = {
    patova: 72,
    mostasa: 64,
    braian: 60,
    jenny: 58,
    alien: 58,
    rag: 54,
  };
  const pushHeights: Record<CharacterId, number> = {
    patova: 170,
    mostasa: 150,
    braian: 144,
    jenny: 152,
    alien: 148,
    rag: 120,
  };
  const w = pushWidths[fighter.characterId];
  const h = fighter.crouching
    ? Math.round(pushHeights[fighter.characterId] * 0.65)
    : pushHeights[fighter.characterId];
  return {
    x: Math.round(fighter.x - w / 2),
    y: Math.round(fighter.y - h),
    width: w,
    height: h,
  };
}

/**
 * ETAPA B: THROW RANGE — Valid throw/command-grab box in world coordinates.
 */
export function getFighterThrowBox(fighter: FighterRuntime): RectBox {
  const throwReach = fighter.characterId === 'patova' ? 78 : 62;
  const worldX =
    fighter.facing === 1 ? fighter.x + 8 : fighter.x - 8 - throwReach;
  return {
    x: Math.round(worldX),
    y: Math.round(fighter.y - 120),
    width: throwReach,
    height: 102,
  };
}

/**
 * ETAPA B: HURTBOXES — Head, Torso, Legs, and Extended Attacking Limb hurtboxes.
 */
export function getFighterHurtboxes(fighter: FighterRuntime): RectBox[] {
  const sheetCfg = SPRITE_SHEET_CONFIGS[fighter.characterId];
  // Ensure The Litlle Rag is compact (smaller than Patova) but never impossible to hit by standing attacks
  const rawHeight = sheetCfg.referenceHeight540p;
  const visualHeight = Math.max(195, rawHeight);
  const scale = sheetCfg.uniformScale540p;
  const idleBboxW = Math.max(115, sheetCfg.frames[0].bboxWidth * scale);

  if (fighter.state === 'defeated' || fighter.state === 'recovering') {
    return [];
  }

  // Grounded knockdown is invulnerable to OTG loops, but airborne knockdown/launch can be juggled up to 2 hits
  if (fighter.state === 'knockdown') {
    if (fighter.grounded || fighter.juggleCount >= 2) {
      return [];
    }
    const airW = Math.round(idleBboxW * 0.56);
    const airH = Math.round(visualHeight * 0.52);
    return [
      {
        x: Math.round(fighter.x - airW / 2),
        y: Math.round(fighter.y - airH - 18),
        width: airW,
        height: airH,
      },
    ];
  }

  if (fighter.crouching || fighter.state === 'crouching') {
    const w = Math.round(idleBboxW * 0.58);
    const h = Math.round(visualHeight * 0.62);
    const headW = Math.round(idleBboxW * 0.36);
    const headH = Math.round(visualHeight * 0.18);
    return [
      // Crouching Torso & Legs hurtbox
      {
        x: Math.round(fighter.x - w / 2),
        y: Math.round(fighter.y - h),
        width: w,
        height: h,
      },
      // Crouching Head hurtbox
      {
        x: Math.round(fighter.x - headW / 2 + fighter.facing * 6),
        y: Math.round(fighter.y - h - headH + 8),
        width: headW,
        height: headH,
      },
    ];
  }

  const bodyW = Math.round(idleBboxW * 0.52);
  const bodyH = Math.round(visualHeight * 0.62);
  const headW = Math.round(idleBboxW * 0.32);
  const headH = Math.round(visualHeight * 0.2);
  const legsW = Math.round(idleBboxW * 0.56);
  const legsH = Math.round(visualHeight * 0.34);

  const boxes: RectBox[] = [
    // 1. Primary Torso & Core hurtbox (kept first for deterministic height tests)
    {
      x: Math.round(fighter.x - bodyW / 2),
      y: Math.round(fighter.y - bodyH),
      width: bodyW,
      height: bodyH,
    },
    // 2. Head hurtbox (aligned tightly to head & neck)
    {
      x: Math.round(fighter.x - headW / 2 + fighter.facing * 4),
      y: Math.round(fighter.y - bodyH - headH + 10),
      width: headW,
      height: headH,
    },
    // 3. Legs hurtbox
    {
      x: Math.round(fighter.x - legsW / 2),
      y: Math.round(fighter.y - legsH),
      width: legsW,
      height: legsH,
    },
  ];

  // 4. Extended limb hurtbox during active and early recovery frames (enables whiff punishing)
  if (
    (fighter.state === 'attacking' || fighter.state === 'special') &&
    fighter.currentAttack
  ) {
    const move = CHARACTERS[fighter.characterId].moves[fighter.currentAttack];
    if (
      move &&
      fighter.stateFrame >= move.startup &&
      fighter.stateFrame <
        move.startup + move.active + Math.floor(move.recovery * 0.55)
    ) {
      const limbReach = Math.round(move.hitbox.width * 0.55);
      const limbX =
        fighter.facing === 1
          ? fighter.x + bodyW / 2
          : fighter.x - bodyW / 2 - limbReach;
      boxes.push({
        x: Math.round(limbX),
        y: Math.round(fighter.y + move.hitbox.y),
        width: limbReach,
        height: Math.max(24, move.hitbox.height),
      });
    }
  }

  return boxes;
}

/**
 * ETAPA B: HITBOX — Active offensive box strictly during active frames [startup, startup + active).
 */
export function getActiveHitbox(fighter: FighterRuntime): RectBox | null {
  if (
    fighter.state !== 'attacking' &&
    fighter.state !== 'special' &&
    fighter.state !== 'super'
  ) {
    return null;
  }
  if (!fighter.currentAttack || fighter.attackHasHit) {
    return null;
  }

  const def = CHARACTERS[fighter.characterId];
  const move: AttackFrameData = def.moves[fighter.currentAttack];
  if (!move) return null;

  if (
    fighter.stateFrame >= move.startup &&
    fighter.stateFrame < move.startup + move.active
  ) {
    if (fighter.currentAttack === 'grab') {
      return getFighterThrowBox(fighter);
    }

    const sheetCfg = SPRITE_SHEET_CONFIGS[fighter.characterId];
    const visualHeight = sheetCfg.referenceHeight540p;
    const scale = sheetCfg.uniformScale540p;
    const heightRatio = visualHeight / 150;

    const isKick =
      fighter.currentAttack === 'lk' ||
      fighter.currentAttack === 'hk' ||
      fighter.currentAttack === 'clk' ||
      fighter.currentAttack === 'chk' ||
      fighter.currentAttack === 'jlk' ||
      fighter.currentAttack === 'jhk';
    const refFrame = isKick ? sheetCfg.frames[14] : sheetCfg.frames[9];
    const spriteForwardReach = Math.round(
      (refFrame.bboxX + refFrame.bboxWidth - refFrame.anchorX + 6) * scale
    );

    const hb = move.hitbox;
    const boxWidth = Math.max(hb.width, spriteForwardReach - hb.x);
    const boxHeight = Math.round(hb.height * Math.max(1, heightRatio * 0.85));
    const worldX =
      fighter.facing === 1
        ? fighter.x + hb.x
        : fighter.x - hb.x - boxWidth;
    const worldY = Math.round(fighter.y + hb.y * heightRatio);
    return {
      x: Math.round(worldX),
      y: worldY,
      width: boxWidth,
      height: boxHeight,
    };
  }
  return null;
}

export function getRelativeDirection(
  input: InputSnapshot,
  facing: 1 | -1
): BufferedInputEntry['dir'] {
  const forward = facing === 1 ? input.right : input.left;
  const backward = facing === 1 ? input.left : input.right;
  if (input.up && forward) return 'UF';
  if (input.up && backward) return 'UB';
  if (input.down && forward) return 'DF';
  if (input.down && backward) return 'DB';
  if (input.up) return 'U';
  if (input.down) return 'D';
  if (forward) return 'F';
  if (backward) return 'B';
  return 'N';
}

export function recordInputBuffer(
  fighter: FighterRuntime,
  input: InputSnapshot,
  frame: number
): void {
  const dir = getRelativeDirection(input, fighter.facing);
  fighter.inputBuffer.push({
    frame,
    dir,
    lp: input.justPressed.lp,
    hp: input.justPressed.hp,
    lk: input.justPressed.lk,
    hk: input.justPressed.hk,
    special1: input.justPressed.special1,
    special2: input.justPressed.special2,
    special3: input.justPressed.special3,
    superBtn: input.justPressed.superBtn,
  });
  // Keep 15 frames of history as required by spec
  while (
    fighter.inputBuffer.length > 0 &&
    frame - fighter.inputBuffer[0].frame > 15
  ) {
    fighter.inputBuffer.shift();
  }
}

export function detectMotionPattern(
  buffer: BufferedInputEntry[],
  sequence: Array<BufferedInputEntry['dir']>
): boolean {
  let seqIdx = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i].dir === sequence[seqIdx]) {
      seqIdx++;
      if (seqIdx >= sequence.length) {
        return true;
      }
    }
  }
  return false;
}

function hasRecentBufferedPress(
  buffer: BufferedInputEntry[],
  key: 'lp' | 'hp' | 'lk' | 'hk' | 'special1' | 'special2' | 'special3' | 'superBtn',
  windowFrames = 5
): boolean {
  if (buffer.length === 0) return false;
  const latestFrame = buffer[buffer.length - 1].frame;
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (latestFrame - buffer[i].frame > windowFrames) break;
    if (buffer[i][key]) return true;
  }
  return false;
}

function consumeRecentBufferedPresses(fighter: FighterRuntime): void {
  for (const entry of fighter.inputBuffer) {
    entry.lp = false;
    entry.hp = false;
    entry.lk = false;
    entry.hk = false;
    entry.special1 = false;
    entry.special2 = false;
    entry.special3 = false;
    entry.superBtn = false;
  }
}

export function detectDashDirection(
  fighter: FighterRuntime,
  input: InputSnapshot
): 1 | -1 | 0 {
  const dir = getRelativeDirection(input, fighter.facing);
  const justPressedHoriz = input.justPressed.left || input.justPressed.right;
  if (!justPressedHoriz) return 0;

  if (
    dir === 'F' &&
    detectMotionPattern(fighter.inputBuffer.slice(-11), ['F', 'N', 'F'])
  ) {
    return fighter.facing;
  }
  if (
    dir === 'B' &&
    detectMotionPattern(fighter.inputBuffer.slice(-11), ['B', 'N', 'B'])
  ) {
    return (fighter.facing * -1) as 1 | -1;
  }
  return 0;
}

export function resolveRequestedAttack(
  fighter: FighterRuntime,
  input: InputSnapshot,
  allowBufferedPresses = false
): AttackId | null {
  const lpPressed =
    input.justPressed.lp ||
    (allowBufferedPresses && hasRecentBufferedPress(fighter.inputBuffer, 'lp'));
  const hpPressed =
    input.justPressed.hp ||
    (allowBufferedPresses && hasRecentBufferedPress(fighter.inputBuffer, 'hp'));
  const lkPressed =
    input.justPressed.lk ||
    (allowBufferedPresses && hasRecentBufferedPress(fighter.inputBuffer, 'lk'));
  const hkPressed =
    input.justPressed.hk ||
    (allowBufferedPresses && hasRecentBufferedPress(fighter.inputBuffer, 'hk'));
  const sp1Pressed =
    input.justPressed.special1 ||
    (allowBufferedPresses &&
      hasRecentBufferedPress(fighter.inputBuffer, 'special1'));
  const sp2Pressed =
    input.justPressed.special2 ||
    (allowBufferedPresses &&
      hasRecentBufferedPress(fighter.inputBuffer, 'special2'));
  const sp3Pressed =
    input.justPressed.special3 ||
    (allowBufferedPresses &&
      hasRecentBufferedPress(fighter.inputBuffer, 'special3'));
  const superPressed =
    input.justPressed.superBtn ||
    (allowBufferedPresses &&
      hasRecentBufferedPress(fighter.inputBuffer, 'superBtn'));

  const anyPunch = lpPressed || hpPressed;
  const anyKick = lkPressed || hkPressed;

  // 1. Highest Priority: Super Attack check (requires 100% meter)
  // Supports direct Super button, HP+HK, or Double Quarter-Circle Forward + Punch/Kick
  if (fighter.meter >= 100) {
    const doubleQcf =
      (anyPunch || anyKick) &&
      (detectMotionPattern(fighter.inputBuffer, ['D', 'DF', 'F', 'D', 'DF', 'F']) ||
        detectMotionPattern(fighter.inputBuffer, ['D', 'F', 'D', 'F']));
    if (superPressed || (hpPressed && hkPressed) || doubleQcf) {
      return 'super';
    }
  }

  // 2. Direct shortcut buttons for Special 1, 2, 3
  if (sp1Pressed) return 'special1';
  if (sp2Pressed) return 'special2';
  if (sp3Pressed) return 'special3';

  // 3. Classic arcade motion recognition in 15-frame buffer (Specials take priority over Normals)
  if (anyPunch || anyKick) {
    // Dragon Punch motion: F, D, DF + Punch
    if (
      anyPunch &&
      (detectMotionPattern(fighter.inputBuffer, ['F', 'D', 'DF']) ||
        detectMotionPattern(fighter.inputBuffer, ['F', 'D', 'F']))
    ) {
      return fighter.characterId === 'mostasa' ? 'special2' : 'special3';
    }
    // Quarter Circle Forward: D, DF, F or D, F
    if (
      detectMotionPattern(fighter.inputBuffer, ['D', 'DF', 'F']) ||
      detectMotionPattern(fighter.inputBuffer, ['D', 'F'])
    ) {
      if (anyPunch) return 'special1';
      if (anyKick)
        return fighter.characterId === 'jenny' ? 'special1' : 'special2';
    }
    // Quarter Circle Backward: D, DB, B or D, B
    if (
      detectMotionPattern(fighter.inputBuffer, ['D', 'DB', 'B']) ||
      detectMotionPattern(fighter.inputBuffer, ['D', 'B'])
    ) {
      if (anyKick) return 'special3';
      if (anyPunch) return 'special2';
    }
  }

  // 4. Close-range Grab (LP + LK or dedicated Grab button)
  if (
    fighter.grounded &&
    (input.justPressed.grab ||
      (input.lp && lkPressed) ||
      (input.lk && lpPressed))
  ) {
    return 'grab';
  }

  // 5. Air normals
  if (!fighter.grounded) {
    if (hpPressed) return 'jhp';
    if (hkPressed) return 'jhk';
    if (lpPressed) return 'jlp';
    if (lkPressed) return 'jlk';
    return null;
  }

  // 6. Crouching normals
  if (input.down) {
    if (hpPressed) return 'chp';
    if (hkPressed) return 'chk';
    if (lpPressed) return 'clp';
    if (lkPressed) return 'clk';
    return null;
  }

  // 7. Standing normals
  if (hpPressed) return 'hp';
  if (hkPressed) return 'hk';
  if (lpPressed) return 'lp';
  if (lkPressed) return 'lk';

  return null;
}

/**
 * ETAPA E: Chain Combos, Target Combos, Special Cancels & Super Cancels
 * Uses explicit move.cancelOptions and enforces a maximum chain limit so infinite loops cannot occur.
 */
export function canCancelCurrentMove(
  fighter: FighterRuntime,
  nextAttack: AttackId
): boolean {
  if (
    (fighter.state !== 'attacking' && fighter.state !== 'special') ||
    !fighter.currentAttack
  ) {
    return false;
  }
  const def = CHARACTERS[fighter.characterId];
  const currentMove = def.moves[fighter.currentAttack];
  if (!currentMove) return false;

  const hasConnected =
    fighter.attackHasHit || Boolean(fighter.attackHasBeenBlocked);
  const inCancelWindow =
    fighter.stateFrame >= currentMove.cancelWindowStart &&
    fighter.stateFrame <= currentMove.cancelWindowEnd &&
    hasConnected;

  if (!inCancelWindow) return false;

  // Check if nextAttack is explicitly listed in currentMove.cancelOptions
  const allowedByMove = currentMove.cancelOptions?.includes(nextAttack) ?? false;
  if (!allowedByMove) return false;

  if (nextAttack === 'super' && fighter.meter < 100) {
    return false;
  }

  // Prevent infinite normal chains: max 3 chained normals before requiring a Special/Super or neutral reset
  const isNormalNext =
    nextAttack === 'lp' ||
    nextAttack === 'hp' ||
    nextAttack === 'lk' ||
    nextAttack === 'hk' ||
    nextAttack === 'clp' ||
    nextAttack === 'chp' ||
    nextAttack === 'clk' ||
    nextAttack === 'chk';

  if (isNormalNext && fighter.chainCount >= 3) {
    return false;
  }

  return true;
}

export function startFighterAttack(
  state: MatchSimulationState,
  fighter: FighterRuntime,
  attackId: AttackId,
  isCancel = false
): void {
  const def = CHARACTERS[fighter.characterId];
  const move = def.moves[attackId];
  if (!move) return;

  const wasSpecialCancel =
    isCancel &&
    fighter.state === 'special' &&
    attackId === 'super';

  fighter.currentAttack = attackId;
  fighter.stateFrame = 0;
  fighter.attackHasHit = false;
  fighter.attackHasBeenBlocked = false;
  fighter.dashFrames = 0;
  fighter.invulnerableFrames = move.invulnerableEndFrame;
  fighter.chainCount = isCancel ? fighter.chainCount + 1 : 1;

  consumeRecentBufferedPresses(fighter);

  if (attackId === 'super') {
    fighter.state = 'super';
    fighter.meter = 0;
    state.superFreezeFrames = 28;
    state.superFreezeActor = fighter.playerIndex;
    state.superMoveTitle = move.name;
    if (wasSpecialCancel) {
      state.combatCallout = {
        id: state.frame,
        player: fighter.playerIndex,
        text: 'SUPER CANCEL!',
        color: '#facc15',
        framesRemaining: 45,
        totalFrames: 45,
      };
    }
    spawnParticles(
      state.particles,
      fighter.x,
      fighter.y - 70,
      22,
      move.effectColor,
      'energy',
      1.6
    );
  } else if (
    attackId === 'special1' ||
    attackId === 'special2' ||
    attackId === 'special3'
  ) {
    fighter.state = 'special';
    spawnParticles(
      state.particles,
      fighter.x,
      fighter.y - 60,
      10,
      move.effectColor,
      'energy',
      1.1
    );
  } else {
    fighter.state = 'attacking';
  }

  if (move.moveVy !== 0 && fighter.grounded) {
    fighter.vy = move.moveVy;
    fighter.grounded = false;
  }
}

export function isHoldingBack(
  fighter: FighterRuntime,
  input: InputSnapshot
): boolean {
  return fighter.facing === 1 ? input.left : input.right;
}

/**
 * ETAPA D: High Block, Low Block, and Air Overhead Rules
 * - Standing block (Back) stops 'high' (jumping overheads) and 'mid' attacks, fails vs 'low'.
 * - Crouching block (Down + Back) stops 'low' and 'mid' attacks, fails vs 'high' (jumping overheads).
 * - 'throw' is unblockable.
 */
export function canBlockAttack(
  defender: FighterRuntime,
  defenderInput: InputSnapshot,
  hitLevel: AttackFrameData['hitLevel']
): boolean {
  if (hitLevel === 'throw') return false;
  if (!defender.grounded) return false;
  const freeToBlock =
    defender.state === 'idle' ||
    defender.state === 'walking' ||
    defender.state === 'crouching' ||
    defender.state === 'blocking';
  if (!freeToBlock) return false;

  if (!isHoldingBack(defender, defenderInput)) return false;

  // Low attacks require crouch-blocking (Down + Back)
  if (hitLevel === 'low') {
    return defenderInput.down;
  }
  // High overhead / air attacks require stand-blocking (Back without Down)
  if (hitLevel === 'high') {
    return !defenderInput.down;
  }
  // Mid attacks are blocked by both standing and crouching block
  return true;
}

/**
 * ETAPA E: Exact Section 6 Combo Damage Scaling Table
 * Hit 1: 100%, Hit 2: 95%, Hit 3: 90%, Hit 4: 80%, Hit 5: 70%, Hit 6: 60%, Hit 7+: 50%
 */
export function getComboScalingMultiplier(hitNumber: number): number {
  if (hitNumber <= 1) return 1.0;
  if (hitNumber === 2) return 0.95;
  if (hitNumber === 3) return 0.9;
  if (hitNumber === 4) return 0.8;
  if (hitNumber === 5) return 0.7;
  if (hitNumber === 6) return 0.6;
  return 0.5;
}

export function calculateDamage(
  rawDamage: number,
  attackerId: CharacterId,
  defenderId: CharacterId,
  comboCountBeforeHit: number,
  isCounter = false
): number {
  const atkStats = CHARACTERS[attackerId].stats;
  const defStats = CHARACTERS[defenderId].stats;

  const strengthFactor = 0.88 + atkStats.strength * 0.025;
  const defenseFactor = 1.12 - defStats.defense * 0.022;
  const hitNumber = comboCountBeforeHit + 1;
  const comboScaling = getComboScalingMultiplier(hitNumber);
  const counterMultiplier = isCounter ? 1.15 : 1.0;

  return Math.max(
    4,
    Math.round(
      rawDamage *
        strengthFactor *
        defenseFactor *
        comboScaling *
        counterMultiplier
    )
  );
}

/**
 * ETAPA B: Pushbox-based Fighter Separation & Stage Corner Correction
 */
export function enforceFighterSeparation(
  p1: FighterRuntime,
  p2: FighterRuntime
): void {
  const dy = Math.abs(p1.y - p2.y);
  if (dy > 95) return; // One fighter is jumping high over the other

  const box1 = getFighterPushbox(p1);
  const box2 = getFighterPushbox(p2);
  const minDistance = Math.max(62, Math.round((box1.width + box2.width) / 2));

  const dx = p2.x - p1.x;
  const absDx = Math.abs(dx);
  if (absDx < minDistance) {
    const overlap = (minDistance - absDx) / 2 + 0.5;
    if (dx >= 0) {
      p1.x -= overlap;
      p2.x += overlap;
    } else {
      p1.x += overlap;
      p2.x -= overlap;
    }
  }

  // Clamp to stage bounds and push the other fighter back if one is pinned in the corner
  if (p1.x < STAGE_LEFT_BOUND) {
    const diff = STAGE_LEFT_BOUND - p1.x;
    p1.x = STAGE_LEFT_BOUND;
    if (Math.abs(p2.x - p1.x) < minDistance) {
      p2.x = Math.min(STAGE_RIGHT_BOUND, p1.x + minDistance);
    } else {
      p2.x = Math.min(STAGE_RIGHT_BOUND, p2.x + diff * 0.5);
    }
  } else if (p1.x > STAGE_RIGHT_BOUND) {
    const diff = p1.x - STAGE_RIGHT_BOUND;
    p1.x = STAGE_RIGHT_BOUND;
    if (Math.abs(p1.x - p2.x) < minDistance) {
      p2.x = Math.max(STAGE_LEFT_BOUND, p1.x - minDistance);
    } else {
      p2.x = Math.max(STAGE_LEFT_BOUND, p2.x - diff * 0.5);
    }
  }

  if (p2.x < STAGE_LEFT_BOUND) {
    p2.x = STAGE_LEFT_BOUND;
    if (Math.abs(p1.x - p2.x) < minDistance) {
      p1.x = Math.min(STAGE_RIGHT_BOUND, p2.x + minDistance);
    }
  } else if (p2.x > STAGE_RIGHT_BOUND) {
    p2.x = STAGE_RIGHT_BOUND;
    if (Math.abs(p2.x - p1.x) < minDistance) {
      p1.x = Math.max(STAGE_LEFT_BOUND, p2.x - minDistance);
    }
  }
}

export function updateFighterFacing(
  p1: FighterRuntime,
  p2: FighterRuntime
): void {
  const canTurn = (f: FighterRuntime) =>
    f.grounded &&
    (f.state === 'idle' || f.state === 'walking' || f.state === 'crouching');

  if (canTurn(p1)) {
    p1.facing = p2.x >= p1.x ? 1 : -1;
  }
  if (canTurn(p2)) {
    p2.facing = p1.x >= p2.x ? 1 : -1;
  }
}

function updateSingleFighter(
  state: MatchSimulationState,
  fighter: FighterRuntime,
  opponent: FighterRuntime,
  input: InputSnapshot
): void {
  const def = CHARACTERS[fighter.characterId];
  fighter.stateFrame += 1;

  // Smooth squash & stretch recovery
  fighter.scaleX += (1 - fighter.scaleX) * 0.25;
  fighter.scaleY += (1 - fighter.scaleY) * 0.25;

  // Trailing damage bar decay
  if (fighter.trailingHp > fighter.hp) {
    fighter.trailingHp = Math.max(fighter.hp, fighter.trailingHp - 2.2);
  } else {
    fighter.trailingHp = fighter.hp;
  }

  if (fighter.invulnerableFrames > 0) fighter.invulnerableFrames -= 1;
  if (fighter.flashFrames > 0) fighter.flashFrames -= 1;

  // Handle terminal round states
  if (fighter.state === 'victory' || fighter.state === 'defeated') {
    if (!fighter.grounded) {
      fighter.vy += def.gravity;
      fighter.y += fighter.vy;
      if (fighter.y >= GROUND_Y) {
        fighter.y = GROUND_Y;
        fighter.vy = 0;
        fighter.grounded = true;
      }
    }
    fighter.vx *= 0.8;
    fighter.x = Math.max(
      STAGE_LEFT_BOUND,
      Math.min(STAGE_RIGHT_BOUND, fighter.x + fighter.vx)
    );
    return;
  }

  // Handle Hitstun
  if (fighter.state === 'hitstun') {
    fighter.hitstunFrames -= 1;
    fighter.vx *= 0.86;
    fighter.x += fighter.vx;
    if (!fighter.grounded) {
      fighter.vy += def.gravity;
      fighter.y += fighter.vy;
      if (fighter.y >= GROUND_Y) {
        fighter.y = GROUND_Y;
        fighter.vy = 0;
        fighter.grounded = true;
        fighter.juggleCount = 0;
        fighter.state = 'knockdown';
        fighter.hitReaction = 'knockdown';
        fighter.knockdownFrames = 26;
        fighter.stateFrame = 0;
        spawnParticles(
          state.particles,
          fighter.x,
          GROUND_Y,
          8,
          '#d4d4d8',
          'dust',
          0.9
        );
      }
    } else if (fighter.hitstunFrames <= 0) {
      fighter.state = 'idle';
      fighter.hitReaction = 'none';
      fighter.stateFrame = 0;
      fighter.comboCount = 0;
      fighter.comboDamage = 0;
      fighter.juggleCount = 0;
    }
    fighter.x = Math.max(STAGE_LEFT_BOUND, Math.min(STAGE_RIGHT_BOUND, fighter.x));
    return;
  }

  // Handle Blockstun (Guardstun)
  if (fighter.state === 'blocking') {
    fighter.blockstunFrames -= 1;
    fighter.vx *= 0.84;
    fighter.x += fighter.vx;
    fighter.crouching = input.down;
    fighter.hitReaction = 'guard';
    if (fighter.blockstunFrames <= 0) {
      fighter.state = input.down ? 'crouching' : 'idle';
      fighter.hitReaction = 'none';
      fighter.stateFrame = 0;
    }
    fighter.x = Math.max(STAGE_LEFT_BOUND, Math.min(STAGE_RIGHT_BOUND, fighter.x));
    return;
  }

  // Handle Knockdown & Recovery
  if (fighter.state === 'knockdown') {
    if (!fighter.grounded) {
      fighter.vy += def.gravity;
      fighter.x += fighter.vx;
      fighter.y += fighter.vy;
      if (fighter.y >= GROUND_Y) {
        fighter.y = GROUND_Y;
        fighter.vy = 0;
        fighter.vx *= 0.5;
        fighter.grounded = true;
        fighter.juggleCount = 0;
        fighter.hitReaction = 'knockdown';
        fighter.scaleX = 1.22;
        fighter.scaleY = 0.78;
        spawnParticles(
          state.particles,
          fighter.x,
          GROUND_Y,
          10,
          '#e4e4e7',
          'dust',
          1.1
        );
      }
    } else {
      fighter.vx *= 0.8;
      fighter.x += fighter.vx;
      fighter.knockdownFrames -= 1;
      if (fighter.knockdownFrames <= 0) {
        fighter.state = 'recovering';
        fighter.hitReaction = 'recovery';
        fighter.stateFrame = 0;
        fighter.invulnerableFrames = 14;
        fighter.comboCount = 0;
        fighter.comboDamage = 0;
        fighter.juggleCount = 0;
      }
    }
    fighter.x = Math.max(STAGE_LEFT_BOUND, Math.min(STAGE_RIGHT_BOUND, fighter.x));
    return;
  }

  if (fighter.state === 'recovering') {
    if (fighter.stateFrame >= 14) {
      fighter.state = 'idle';
      fighter.hitReaction = 'none';
      fighter.stateFrame = 0;
    }
    return;
  }

  // Handle Active Attacks / Specials / Super
  if (
    fighter.state === 'attacking' ||
    fighter.state === 'special' ||
    fighter.state === 'super'
  ) {
    const move = fighter.currentAttack ? def.moves[fighter.currentAttack] : null;
    if (!move) {
      fighter.state = 'idle';
      fighter.currentAttack = null;
      return;
    }

    // Check cancel window into another move (supports buffered inputs from hitstop!)
    if (state.roundPhase === 'fighting') {
      const requested = resolveRequestedAttack(fighter, input, true);
      if (requested && canCancelCurrentMove(fighter, requested)) {
        startFighterAttack(state, fighter, requested, true);
        return;
      }
    }

    // Teleport special handling on exact startup completion frame
    if (move.teleportOffset && fighter.stateFrame === move.startup) {
      spawnParticles(
        state.particles,
        fighter.x,
        fighter.y - 60,
        12,
        move.effectColor,
        'energy',
        1.2
      );
      fighter.x = Math.max(
        STAGE_LEFT_BOUND,
        Math.min(
          STAGE_RIGHT_BOUND,
          fighter.x + fighter.facing * move.teleportOffset
        )
      );
      fighter.facing = opponent.x >= fighter.x ? 1 : -1;
      spawnParticles(
        state.particles,
        fighter.x,
        fighter.y - 60,
        12,
        move.effectColor,
        'energy',
        1.2
      );
    }

    // Projectile spawn on exact startup frame
    if (move.spawnsProjectile && fighter.stateFrame === move.startup) {
      state.projectiles.push({
        id: state.frame * 10 + fighter.playerIndex,
        ownerPlayer: fighter.playerIndex,
        characterId: fighter.characterId,
        x: fighter.x + fighter.facing * 52,
        y: fighter.y - 78,
        vx: fighter.facing * 9.2,
        vy: 0,
        radius: 18,
        damage: move.damage,
        chipDamage: move.chipDamage,
        hitstun: move.hitstun,
        blockstun: move.blockstun,
        pushback: move.pushback,
        color: move.effectColor,
        coreColor: '#ffffff',
        active: true,
        lifeFrames: 95,
      });
    }

    // Forward movement during active frames
    if (
      fighter.stateFrame >= move.startup &&
      fighter.stateFrame < move.startup + move.active
    ) {
      fighter.vx = fighter.facing * move.moveVx;
    } else {
      fighter.vx *= 0.75;
    }

    fighter.x += fighter.vx;

    if (!fighter.grounded) {
      fighter.vy += def.gravity;
      fighter.y += fighter.vy;
      if (fighter.y >= GROUND_Y) {
        fighter.y = GROUND_Y;
        fighter.vy = 0;
        fighter.grounded = true;
        fighter.currentAttack = null;
        fighter.chainCount = 0;
        fighter.state = 'idle';
        fighter.stateFrame = 0;
        fighter.scaleX = 1.18;
        fighter.scaleY = 0.82;
        return;
      }
    }

    const totalFrames = move.startup + move.active + move.recovery;
    if (fighter.stateFrame >= totalFrames) {
      fighter.currentAttack = null;
      fighter.chainCount = 0;
      fighter.state = fighter.grounded
        ? input.down
          ? 'crouching'
          : 'idle'
        : 'jumping';
      fighter.stateFrame = 0;
    }

    fighter.x = Math.max(STAGE_LEFT_BOUND, Math.min(STAGE_RIGHT_BOUND, fighter.x));
    return;
  }

  // Only allow initiating moves/walking during 'fighting' phase
  if (state.roundPhase !== 'fighting') {
    fighter.vx = 0;
    fighter.state = 'idle';
    return;
  }

  // Check attack initiation from neutral/movement/jump states
  const requestedAttack = resolveRequestedAttack(fighter, input, false);
  if (requestedAttack) {
    startFighterAttack(state, fighter, requestedAttack, false);
    return;
  }

  // Handle active Dash burst
  if (fighter.dashFrames > 0) {
    fighter.dashFrames -= 1;
    fighter.vx = fighter.dashDir * def.walkSpeedForward * 1.95;
    fighter.x = Math.max(
      STAGE_LEFT_BOUND,
      Math.min(STAGE_RIGHT_BOUND, fighter.x + fighter.vx)
    );
    fighter.state = 'walking';
    if (fighter.dashFrames % 3 === 0) {
      spawnParticles(
        state.particles,
        fighter.x,
        GROUND_Y,
        2,
        def.palette.accent,
        'dust',
        0.55
      );
    }
    return;
  }

  // Jumping physics
  if (!fighter.grounded) {
    fighter.vy += def.gravity;
    if (!input.up && fighter.vy < -6) {
      fighter.vy *= 0.65;
    }
    fighter.x += fighter.vx;
    fighter.y += fighter.vy;
    if (fighter.y >= GROUND_Y) {
      fighter.y = GROUND_Y;
      fighter.vy = 0;
      fighter.vx = 0;
      fighter.grounded = true;
      fighter.state = input.down ? 'crouching' : 'idle';
      fighter.stateFrame = 0;
      fighter.scaleX = 1.2;
      fighter.scaleY = 0.8;
      spawnParticles(
        state.particles,
        fighter.x,
        GROUND_Y,
        6,
        '#d4d4d8',
        'dust',
        0.7
      );
    }
    fighter.x = Math.max(STAGE_LEFT_BOUND, Math.min(STAGE_RIGHT_BOUND, fighter.x));
    return;
  }

  // Initiate Jump (Vertical, Forward, Backward)
  if (input.up) {
    fighter.grounded = false;
    fighter.crouching = false;
    fighter.state = 'jumping';
    fighter.stateFrame = 0;
    fighter.vy = def.jumpVy;
    if (input.right) fighter.vx = def.jumpVx;
    else if (input.left) fighter.vx = -def.jumpVx;
    else fighter.vx = 0;
    fighter.scaleX = 0.85;
    fighter.scaleY = 1.18;
    spawnParticles(
      state.particles,
      fighter.x,
      GROUND_Y,
      5,
      '#a1a1aa',
      'dust',
      0.6
    );
    return;
  }

  // Crouching
  if (input.down) {
    fighter.crouching = true;
    fighter.vx = 0;
    if (fighter.state !== 'crouching') {
      fighter.state = 'crouching';
      fighter.stateFrame = 0;
    }
    return;
  }
  fighter.crouching = false;

  // Check Double-Tap Forward / Backward Dash
  const dashDir = detectDashDirection(fighter, input);
  if (dashDir !== 0) {
    fighter.dashDir = dashDir;
    fighter.dashFrames = 10;
    fighter.state = 'walking';
    fighter.stateFrame = 0;
    if (dashDir === -fighter.facing) {
      fighter.invulnerableFrames = Math.max(fighter.invulnerableFrames, 4);
    }
    spawnParticles(
      state.particles,
      fighter.x,
      GROUND_Y,
      5,
      def.palette.accent,
      'dust',
      0.85
    );
    return;
  }

  // Walking forward / backward
  const moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (moveDir !== 0) {
    const isMovingForward = moveDir === fighter.facing;
    fighter.vx =
      moveDir *
      (isMovingForward ? def.walkSpeedForward : def.walkSpeedBackward);
    fighter.x += fighter.vx;
    fighter.walkPhase += Math.abs(fighter.vx) * 0.085;
    if (fighter.state !== 'walking') {
      fighter.state = 'walking';
      fighter.stateFrame = 0;
    }
  } else {
    fighter.vx = 0;
    if (fighter.state !== 'idle') {
      fighter.state = 'idle';
      fighter.stateFrame = 0;
    }
  }

  fighter.x = Math.max(STAGE_LEFT_BOUND, Math.min(STAGE_RIGHT_BOUND, fighter.x));
}

function applyHitToDefender(
  state: MatchSimulationState,
  attacker: FighterRuntime,
  defender: FighterRuntime,
  defenderInput: InputSnapshot,
  move: AttackFrameData,
  contactPoint?: { x: number; y: number }
): void {
  if (defender.invulnerableFrames > 0) return;

  // Throw rules: cannot grab airborne or stunned opponents, and defender can THROW TECH!
  if (move.hitLevel === 'throw') {
    if (
      !defender.grounded ||
      defender.state === 'hitstun' ||
      defender.state === 'blocking' ||
      defender.state === 'knockdown'
    ) {
      return;
    }
    const defPressedThrow =
      Boolean(defenderInput.grab) ||
      Boolean(defenderInput.justPressed.grab) ||
      (defenderInput.lp && defenderInput.lk) ||
      (defender.currentAttack === 'grab' && defender.stateFrame <= 7);
    if (defPressedThrow) {
      // THROW TECH!
      attacker.attackHasHit = true;
      attacker.state = 'idle';
      attacker.currentAttack = null;
      defender.state = 'idle';
      defender.currentAttack = null;
      attacker.vx = -attacker.facing * 6.5;
      defender.vx = attacker.facing * 6.5;
      state.hitstopFrames = 6;
      const techX = Math.round((attacker.x + defender.x) / 2);
      const techY = defender.y - 82;
      spawnParticles(state.particles, techX, techY, 2, '#38bdf8', 'guard_ring', 1.2);
      spawnParticles(state.particles, techX, techY, 10, '#facc15', 'spark', 1.1);
      state.combatCallout = {
        id: state.frame,
        player: defender.playerIndex,
        text: 'THROW TECH!',
        color: '#38bdf8',
        framesRemaining: 45,
        totalFrames: 45,
      };
      return;
    }
  }

  const blocked = canBlockAttack(defender, defenderInput, move.hitLevel);
  const contactX =
    contactPoint?.x ?? Math.round((attacker.x + defender.x) / 2 + attacker.facing * 20);
  const contactY = contactPoint?.y ?? defender.y - 75;

  if (blocked) {
    attacker.attackHasHit = true;
    attacker.attackHasBeenBlocked = true;

    const chip = move.chipDamage;
    defender.hp = Math.max(1, defender.hp - chip);
    defender.state = 'blocking';
    defender.hitReaction = 'guard';
    defender.stateFrame = 0;
    defender.blockstunFrames = move.blockstun;
    defender.vx = attacker.facing * (move.pushback * 0.24);

    // Corner pushback on block
    const atCorner =
      defender.x <= STAGE_LEFT_BOUND + 15 ||
      defender.x >= STAGE_RIGHT_BOUND - 15;
    if (atCorner) {
      attacker.x -= attacker.facing * (move.pushback * 0.45);
    }

    attacker.meter = Math.min(
      100,
      attacker.meter + Math.round(move.meterGain * 0.45)
    );
    defender.meter = Math.min(
      100,
      defender.meter + Math.round(move.meterGain * 0.35)
    );

    state.hitstopFrames = Math.max(3, Math.round(move.hitstop * 0.65));
    spawnParticles(state.particles, contactX, contactY, 8, '#38bdf8', 'spark', 0.9);
    spawnParticles(
      state.particles,
      contactX,
      contactY,
      1,
      '#38bdf8',
      'guard_ring',
      1
    );

    const remainingAttackerRecovery = Math.max(
      1,
      move.startup + move.active + move.recovery - attacker.stateFrame
    );
    state.lastHitEvent = {
      frame: state.frame,
      attacker: attacker.playerIndex,
      moveId: move.id,
      moveName: move.name,
      damage: chip,
      blocked: true,
      contactX,
      contactY,
      scalingPercent: 100,
      frameAdvantage: move.blockstun - remainingAttackerRecovery,
    };
    return;
  }

  // Detect COUNTER HIT (defender interrupted during startup/active frames)
  // or PUNISH (defender hit during whiff recovery frames)
  let isCounter = false;
  let isPunish = false;
  if (
    (defender.state === 'attacking' ||
      defender.state === 'special' ||
      defender.state === 'super') &&
    defender.currentAttack
  ) {
    const defMove = CHARACTERS[defender.characterId].moves[defender.currentAttack];
    if (defMove) {
      if (defender.stateFrame < defMove.startup + defMove.active) {
        isCounter = true;
      } else {
        isPunish = true;
      }
    }
  }

  attacker.attackHasHit = true;

  const comboCountBefore = defender.comboCount;
  const scalingMult = getComboScalingMultiplier(comboCountBefore + 1);
  const finalDamage = calculateDamage(
    move.damage,
    attacker.characterId,
    defender.characterId,
    comboCountBefore,
    isCounter
  );

  defender.hp = Math.max(0, defender.hp - finalDamage);
  defender.flashFrames = isCounter ? 6 : 4;
  defender.comboCount += 1;
  defender.comboDamage += finalDamage;
  defender.currentAttack = null;

  attacker.maxComboReached = Math.max(
    attacker.maxComboReached,
    defender.comboCount
  );
  attacker.totalDamageDealt += finalDamage;

  const bonusMeter = isPunish ? 6 : isCounter ? 4 : 0;
  attacker.meter = Math.min(100, attacker.meter + move.meterGain + bonusMeter);
  defender.meter = Math.min(
    100,
    defender.meter + Math.max(4, Math.round(move.meterGain * 0.55))
  );

  state.hitstopFrames = isCounter ? move.hitstop + 2 : move.hitstop;
  const shakeGain =
    move.id === 'super'
      ? 0.72
      : move.damage >= 80 || isCounter
        ? 0.42
        : 0.14;
  state.cameraShakeTrauma = Math.min(1, state.cameraShakeTrauma + shakeGain);

  if (isCounter) {
    state.combatCallout = {
      id: state.frame,
      player: attacker.playerIndex,
      text: 'COUNTER HIT!',
      color: '#f43f5e',
      framesRemaining: 48,
      totalFrames: 48,
    };
    spawnParticles(
      state.particles,
      contactX,
      contactY,
      10,
      '#f43f5e',
      'counter_burst',
      1.35
    );
  } else if (isPunish) {
    state.combatCallout = {
      id: state.frame,
      player: attacker.playerIndex,
      text: 'PUNISH!',
      color: '#facc15',
      framesRemaining: 45,
      totalFrames: 45,
    };
  }

  // Character-specific signature hit effects at exact contact point
  spawnCharacterSignatureHitEffects(
    state.particles,
    attacker.characterId,
    contactX,
    contactY,
    move.damage >= 75 || move.id === 'super'
  );

  // Pushback on cornered defender pushes attacker back instead
  const atCorner =
    defender.x <= STAGE_LEFT_BOUND + 15 ||
    defender.x >= STAGE_RIGHT_BOUND - 15;
  if (atCorner) {
    attacker.x -= attacker.facing * (move.pushback * 0.55);
  }

  const wasAirborne = !defender.grounded;

  if (defender.hp <= 0) {
    defender.state = 'defeated';
    defender.hitReaction = 'knockdown';
    defender.stateFrame = 0;
    defender.grounded = false;
    defender.vx = attacker.facing * 8.5;
    defender.vy = -10.5;
    if (move.id === 'super') {
      state.wasSuperFinish = true;
    }
    spawnParticles(
      state.particles,
      contactX,
      contactY,
      26,
      move.effectColor,
      'energy',
      1.7
    );
  } else if (move.causesKnockdown || move.knockbackY < -2 || wasAirborne) {
    if (wasAirborne) {
      defender.juggleCount += 1;
    }
    defender.state = 'knockdown';
    defender.hitReaction = wasAirborne ? 'air_knockdown' : 'knockdown';
    defender.stateFrame = 0;
    defender.grounded = false;
    defender.knockdownFrames = 30;
    defender.vx = attacker.facing * move.knockbackX;
    defender.vy = move.knockbackY < -2 ? move.knockbackY : -7.2;
    spawnParticles(
      state.particles,
      contactX,
      contactY,
      18,
      move.effectColor,
      'spark',
      1.3
    );
    spawnParticles(
      state.particles,
      contactX,
      contactY,
      1,
      move.secondaryColor,
      'hitring',
      1
    );
  } else {
    defender.state = 'hitstun';
    defender.hitReaction = isCounter
      ? 'counter'
      : move.hitLevel === 'low'
        ? 'low'
        : move.damage >= 75
          ? 'heavy'
          : 'light';
    defender.stateFrame = 0;
    defender.hitstunFrames = move.hitstun + (isCounter ? 4 : 0);
    defender.vx = attacker.facing * move.knockbackX;
    spawnParticles(
      state.particles,
      contactX,
      contactY,
      move.damage >= 75 ? 14 : 8,
      move.effectColor,
      'spark',
      move.damage >= 75 ? 1.2 : 0.9
    );
    if (move.damage >= 75) {
      spawnParticles(
        state.particles,
        contactX,
        contactY,
        1,
        move.effectColor,
        'hitring',
        1
      );
    }
  }

  const remainingAttackerRecovery = Math.max(
    1,
    move.startup + move.active + move.recovery - attacker.stateFrame
  );
  state.lastHitEvent = {
    frame: state.frame,
    attacker: attacker.playerIndex,
    moveId: move.id,
    moveName: move.name,
    damage: finalDamage,
    blocked: false,
    isCounter,
    isPunish,
    contactX,
    contactY,
    scalingPercent: Math.round(scalingMult * 100),
    frameAdvantage:
      move.hitstun + (isCounter ? 4 : 0) - remainingAttackerRecovery,
  };
}

function updateProjectiles(
  state: MatchSimulationState,
  p1Input: InputSnapshot,
  p2Input: InputSnapshot
): void {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    if (!proj.active) {
      state.projectiles.splice(i, 1);
      continue;
    }

    proj.x += proj.vx;
    proj.y += proj.vy;
    proj.lifeFrames -= 1;

    if (
      proj.lifeFrames <= 0 ||
      proj.x < STAGE_LEFT_BOUND - 80 ||
      proj.x > STAGE_RIGHT_BOUND + 80
    ) {
      state.projectiles.splice(i, 1);
      continue;
    }

    // Projectile vs Projectile collision
    for (let j = i - 1; j >= 0; j--) {
      const other = state.projectiles[j];
      if (other.active && other.ownerPlayer !== proj.ownerPlayer) {
        const dist = Math.hypot(proj.x - other.x, proj.y - other.y);
        if (dist < proj.radius + other.radius) {
          proj.active = false;
          other.active = false;
          spawnParticles(
            state.particles,
            (proj.x + other.x) / 2,
            proj.y,
            16,
            proj.color,
            'energy',
            1.3
          );
          break;
        }
      }
    }

    if (!proj.active) continue;

    const defender = proj.ownerPlayer === 1 ? state.p2 : state.p1;
    const attacker = proj.ownerPlayer === 1 ? state.p1 : state.p2;
    const defenderInput = proj.ownerPlayer === 1 ? p2Input : p1Input;

    if (defender.invulnerableFrames > 0) continue;

    const projBox: RectBox = {
      x: proj.x - proj.radius,
      y: proj.y - proj.radius,
      width: proj.radius * 2,
      height: proj.radius * 2,
    };

    const hurtboxes = getFighterHurtboxes(defender);
    const hit = hurtboxes.some((hb) => boxesOverlap(projBox, hb));
    if (hit) {
      proj.active = false;
      const contactPt = computeContactPoint(projBox, hurtboxes);
      const syntheticMove: AttackFrameData = {
        id: 'special1',
        name: 'PSI BLAST',
        command: '',
        startup: 0,
        active: 1,
        recovery: 0,
        damage: proj.damage,
        chipDamage: proj.chipDamage,
        hitstun: proj.hitstun,
        blockstun: proj.blockstun,
        pushback: proj.pushback,
        knockbackX: 5.5,
        knockbackY: 0,
        hitstop: 7,
        meterGain: 12,
        hitLevel: 'mid',
        causesKnockdown: false,
        invulnerableEndFrame: 0,
        cancelWindowStart: 0,
        cancelWindowEnd: 0,
        cancelOptions: [],
        hitbox: projBox,
        moveVx: 0,
        moveVy: 0,
        effectColor: proj.color,
        secondaryColor: proj.coreColor,
      };
      applyHitToDefender(
        state,
        attacker,
        defender,
        defenderInput,
        syntheticMove,
        contactPt
      );
      state.projectiles.splice(i, 1);
    }
  }
}

function updateParticles(pool: ParticleRuntime[]): void {
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (!p.active) continue;
    p.life += 1;
    if (p.life >= p.maxLife) {
      p.active = false;
      continue;
    }
    if (p.type === 'hitring' || p.type === 'guard_ring') {
      p.size += 4.2;
      p.alpha = 1 - p.life / p.maxLife;
    } else if (p.type === 'slash_arc') {
      p.size += 2.6;
      p.x += p.vx * 0.4;
      p.y += p.vy * 0.4;
      p.alpha = 1 - p.life / p.maxLife;
    } else {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.type === 'dust' ? 0.08 : 0.25;
      p.alpha = 1 - p.life / p.maxLife;
    }
  }
}

export function stepMatchSimulation(
  state: MatchSimulationState,
  p1Input: InputSnapshot,
  p2Input: InputSnapshot,
  roundsToWin: number,
  training?: TrainingSettings
): void {
  state.frame += 1;

  // Always record player inputs every 60Hz tick — even during Hitstop or Super Freeze!
  recordInputBuffer(state.p1, p1Input, state.frame);
  recordInputBuffer(state.p2, p2Input, state.frame);

  // Always update visual particles, callouts & camera trauma decay
  updateParticles(state.particles);
  state.cameraShakeTrauma = Math.max(0, state.cameraShakeTrauma - 0.055);

  if (state.announcement) {
    state.announcement.framesRemaining -= 1;
    if (state.announcement.framesRemaining <= 0) {
      state.announcement = null;
    }
  }

  if (state.combatCallout) {
    state.combatCallout.framesRemaining -= 1;
    if (state.combatCallout.framesRemaining <= 0) {
      state.combatCallout = null;
    }
  }

  // Super Freeze dramatic pause (inputs are already buffered above)
  if (state.superFreezeFrames > 0) {
    state.superFreezeFrames -= 1;
    return;
  }

  // Hitstop freeze (inputs are buffered above; timer and fighter physics pause)
  if (state.hitstopFrames > 0) {
    state.hitstopFrames -= 1;
    return;
  }

  // Round phase state machine
  if (state.roundPhase === 'intro') {
    state.roundPhaseFrames -= 1;
    if (state.roundPhaseFrames === 35) {
      state.announcement = {
        text: 'FIGHT!',
        framesRemaining: 35,
        totalFrames: 35,
        color: '#ef4444',
      };
    }
    if (state.roundPhaseFrames <= 0) {
      state.roundPhase = 'fighting';
    }
  }

  // Training mode overrides
  if (training) {
    state.roundTimerFrames = ROUND_TIME_SECONDS * FPS;
    if (training.infiniteMeter) {
      state.p1.meter = 100;
      state.p2.meter = 100;
    }
    if (training.infiniteHp) {
      if (state.p1.state === 'idle' || state.p1.state === 'walking') {
        state.p1.hp = Math.min(1000, state.p1.hp + 8);
      }
      if (state.p2.state === 'idle' || state.p2.state === 'walking') {
        state.p2.hp = Math.min(1000, state.p2.hp + 8);
      }
      state.p1.hp = Math.max(150, state.p1.hp);
      state.p2.hp = Math.max(150, state.p2.hp);
    }
  }

  updateFighterFacing(state.p1, state.p2);
  updateSingleFighter(state, state.p1, state.p2, p1Input);
  updateSingleFighter(state, state.p2, state.p1, p2Input);
  enforceFighterSeparation(state.p1, state.p2);

  // Check active melee hitboxes against anatomical hurtboxes
  const p1Hitbox = getActiveHitbox(state.p1);
  const p2Hitbox = getActiveHitbox(state.p2);
  const p1Hurtboxes = getFighterHurtboxes(state.p1);
  const p2Hurtboxes = getFighterHurtboxes(state.p2);

  if (p1Hitbox && state.p1.currentAttack) {
    const hitsP2 = p2Hurtboxes.some((hb) => boxesOverlap(p1Hitbox, hb));
    if (hitsP2) {
      const move = CHARACTERS[state.p1.characterId].moves[state.p1.currentAttack];
      const contactPt = computeContactPoint(p1Hitbox, p2Hurtboxes);
      applyHitToDefender(state, state.p1, state.p2, p2Input, move, contactPt);
    }
  }

  if (p2Hitbox && state.p2.currentAttack) {
    const hitsP1 = p1Hurtboxes.some((hb) => boxesOverlap(p2Hitbox, hb));
    if (hitsP1) {
      const move = CHARACTERS[state.p2.characterId].moves[state.p2.currentAttack];
      const contactPt = computeContactPoint(p2Hitbox, p1Hurtboxes);
      applyHitToDefender(state, state.p2, state.p1, p1Input, move, contactPt);
    }
  }

  updateProjectiles(state, p1Input, p2Input);

  // Update camera to smoothly track midpoint of both fighters within stage bounds
  const midX = (state.p1.x + state.p2.x) / 2;
  const targetCamX = Math.max(
    0,
    Math.min(STAGE_WIDTH - LOGICAL_WIDTH, midX - LOGICAL_WIDTH / 2)
  );
  state.cameraX += (targetCamX - state.cameraX) * 0.16;

  // Check KO / Time Over during fighting
  if (state.roundPhase === 'fighting' && !training) {
    if (state.roundTimerFrames > 0) {
      state.roundTimerFrames -= 1;
    }

    const p1Dead = state.p1.hp <= 0;
    const p2Dead = state.p2.hp <= 0;
    const timeUp = state.roundTimerFrames <= 0;

    if (p1Dead || p2Dead || timeUp) {
      state.roundPhase = 'ko_slowmo';
      state.roundPhaseFrames = 110;

      if (p1Dead && p2Dead) {
        state.roundWinner = 'draw';
      } else if (p2Dead || (timeUp && state.p1.hp > state.p2.hp)) {
        state.roundWinner = 1;
        state.p1RoundsWon += 1;
        state.wasPerfect = state.p1.hp === state.p1.maxHp;
        state.p1.state = 'victory';
        state.p1.stateFrame = 0;
        if (!p2Dead) {
          state.p2.state = 'defeated';
          state.p2.stateFrame = 0;
        }
      } else if (p1Dead || (timeUp && state.p2.hp > state.p1.hp)) {
        state.roundWinner = 2;
        state.p2RoundsWon += 1;
        state.wasPerfect = state.p2.hp === state.p2.maxHp;
        state.p2.state = 'victory';
        state.p2.stateFrame = 0;
        if (!p1Dead) {
          state.p1.state = 'defeated';
          state.p1.stateFrame = 0;
        }
      } else {
        state.roundWinner = 'draw';
      }

      const koLabel = timeUp
        ? 'TIME OVER!'
        : state.wasSuperFinish
          ? 'SUPER FINISH!'
          : 'K.O.!';
      state.announcement = {
        text: koLabel,
        subtext: state.wasPerfect ? 'PERFECT!' : undefined,
        framesRemaining: 90,
        totalFrames: 90,
        color: '#facc15',
      };
    }
  } else if (state.roundPhase === 'ko_slowmo') {
    state.roundPhaseFrames -= 1;
    if (state.roundPhaseFrames === 45 && state.roundWinner) {
      const winnerName =
        state.roundWinner === 'draw'
          ? 'DRAW GAME'
          : state.roundWinner === 1
            ? `${CHARACTERS[state.p1.characterId].shortName} WINS!`
            : `${CHARACTERS[state.p2.characterId].shortName} WINS!`;
      state.announcement = {
        text: winnerName,
        subtext: state.wasPerfect ? 'PERFECT!' : undefined,
        framesRemaining: 55,
        totalFrames: 55,
        color: '#22c55e',
      };
    }
    if (state.roundPhaseFrames <= 0) {
      if (state.p1RoundsWon >= roundsToWin) {
        state.matchWinner = 1;
        state.roundPhase = 'match_over';
      } else if (state.p2RoundsWon >= roundsToWin) {
        state.matchWinner = 2;
        state.roundPhase = 'match_over';
      } else {
        resetForNextRound(state);
      }
    }
  }
}
