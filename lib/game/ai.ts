import { CHARACTERS } from './characters';
import { createEmptyInputSnapshot } from './rules';
import {
  DifficultyLevel,
  FighterRuntime,
  InputSnapshot,
  MatchSimulationState,
  TrainingSettings,
} from './types';

export function computeAiInput(
  state: MatchSimulationState,
  aiFighter: FighterRuntime,
  humanFighter: FighterRuntime,
  difficulty: DifficultyLevel,
  training?: TrainingSettings
): InputSnapshot {
  const input = createEmptyInputSnapshot();

  if (state.roundPhase !== 'fighting') {
    return input;
  }

  // Handle Training Mode Dummy behaviors
  if (training && training.dummyBehavior !== 'cpu') {
    if (training.dummyBehavior === 'crouch') {
      input.down = true;
    } else if (training.dummyBehavior === 'jump') {
      if (aiFighter.grounded) {
        input.up = true;
        input.justPressed.up = true;
      }
    } else if (training.dummyBehavior === 'block_all') {
      // Hold back: block high against jumping overheads, block low against crouching/low attacks
      if (aiFighter.facing === 1) input.left = true;
      else input.right = true;
      if (
        humanFighter.grounded &&
        (humanFighter.crouching ||
          humanFighter.currentAttack === 'clk' ||
          humanFighter.currentAttack === 'chk')
      ) {
        input.down = true;
      }
    }
    return input;
  }

  const dx = humanFighter.x - aiFighter.x;
  const dist = Math.abs(dx);
  const forwardKey = aiFighter.facing === 1 ? 'right' : 'left';
  const backwardKey = aiFighter.facing === 1 ? 'left' : 'right';

  // Difficulty parameters
  const reactionWindow =
    difficulty === 'EASY' ? 42 : difficulty === 'NORMAL' ? 24 : 11;
  const blockProbability =
    difficulty === 'EASY' ? 0.25 : difficulty === 'NORMAL' ? 0.6 : 0.86;
  const specialProbability =
    difficulty === 'EASY' ? 0.16 : difficulty === 'NORMAL' ? 0.36 : 0.65;

  // Deterministic pseudo-random value per frame (0..1)
  const hash =
    Math.imul(state.frame + 101, 1103515245) + aiFighter.playerIndex * 12345;
  const rng = ((hash >>> 16) & 0x7fff) / 32768;

  // Opening footsies window (first 2.2 seconds of active fighting)
  const elapsedFightFrames = 99 * 60 - state.roundTimerFrames;
  const isOpeningFootsies = elapsedFightFrames < 130;

  // Detect whether opponent is in vulnerable recovery frames (Whiff Punish opportunity!)
  const humanChar = CHARACTERS[humanFighter.characterId];
  const humanMove = humanFighter.currentAttack
    ? humanChar.moves[humanFighter.currentAttack]
    : null;
  const opponentInRecovery =
    humanMove !== null &&
    (humanFighter.state === 'attacking' ||
      humanFighter.state === 'special' ||
      humanFighter.state === 'super') &&
    humanFighter.stateFrame >= humanMove.startup + humanMove.active;

  const opponentInActiveOrStartup =
    humanMove !== null &&
    (humanFighter.state === 'attacking' ||
      humanFighter.state === 'special' ||
      humanFighter.state === 'super') &&
    humanFighter.stateFrame < humanMove.startup + humanMove.active;

  // 1. Active Combo Continuation (Chain Combo / Special Cancel / Super Cancel)
  if (
    (aiFighter.state === 'attacking' || aiFighter.state === 'special') &&
    aiFighter.attackHasHit &&
    difficulty !== 'EASY'
  ) {
    // Super Cancel on HARD when meter is full!
    if (
      aiFighter.state === 'special' &&
      aiFighter.meter >= 100 &&
      difficulty === 'HARD' &&
      rng < 0.65
    ) {
      input.justPressed.superBtn = true;
      aiFighter.aiCooldown = reactionWindow + 20;
      return input;
    }

    // Normal -> Special or Heavy Chain Cancel
    if (aiFighter.state === 'attacking') {
      const curMove = aiFighter.currentAttack;
      if (curMove === 'lp' || curMove === 'lk' || curMove === 'clp' || curMove === 'clk') {
        if (rng < 0.5) {
          input.justPressed.hp = true;
        } else {
          input.justPressed.hk = true;
        }
        aiFighter.aiCooldown = 8;
        return input;
      }
      if (
        (curMove === 'hp' || curMove === 'hk' || curMove === 'chp') &&
        rng < specialProbability
      ) {
        if (aiFighter.meter >= 100 && rng < 0.45) {
          input.justPressed.superBtn = true;
        } else {
          input.justPressed.special1 = true;
        }
        aiFighter.aiCooldown = reactionWindow + 18;
        return input;
      }
    }
  }

  // 2. Whiff Punishment: If opponent missed an attack and is in recovery frames within range, punish immediately!
  if (
    opponentInRecovery &&
    dist <= 145 &&
    aiFighter.grounded &&
    difficulty !== 'EASY' &&
    rng < (difficulty === 'HARD' ? 0.9 : 0.55)
  ) {
    if (aiFighter.meter >= 100 && dist <= 135) {
      input.justPressed.superBtn = true;
    } else if (dist <= 95) {
      input.justPressed.hp = true;
    } else {
      input.justPressed.special2 = true;
    }
    aiFighter.aiCooldown = 10;
    return input;
  }

  // 3. Defensive Reaction to incoming projectiles or active attacks
  const incomingProjectile = state.projectiles.find(
    (p) =>
      p.active &&
      p.ownerPlayer !== aiFighter.playerIndex &&
      Math.abs(p.x - aiFighter.x) < 170
  );

  if (incomingProjectile) {
    if (rng < blockProbability && aiFighter.grounded) {
      if (aiFighter.characterId === 'alien' && aiFighter.aiCooldown <= 0) {
        input.justPressed.special2 = true; // Teleport!
        aiFighter.aiCooldown = reactionWindow + 24;
        return input;
      }
      if (rng < 0.45) {
        input.up = true;
        input.justPressed.up = true;
        input[forwardKey] = true;
        return input;
      }
      input[backwardKey] = true;
      return input;
    }
  }

  if (opponentInActiveOrStartup && dist < 145) {
    if (rng < blockProbability) {
      input[backwardKey] = true;
      // Stand-block against jumping overheads; crouch-block against grounded low attacks
      if (
        humanFighter.grounded &&
        (humanFighter.crouching ||
          humanFighter.currentAttack === 'clk' ||
          humanFighter.currentAttack === 'chk')
      ) {
        input.down = true;
      }
      return input;
    }
  }

  // 4. Anti-air reaction if opponent jumps in close
  if (
    !humanFighter.grounded &&
    dist < 135 &&
    aiFighter.grounded &&
    aiFighter.aiCooldown <= 0 &&
    rng < specialProbability
  ) {
    if (aiFighter.characterId === 'mostasa') {
      input.justPressed.special2 = true; // Turbado Uppercut
    } else {
      input.down = true;
      input.justPressed.hp = true; // Crouching anti-air uppercut
    }
    aiFighter.aiCooldown = reactionWindow + 20;
    return input;
  }

  // 5. Update AI Tactical Plan periodically
  if (aiFighter.aiPlanTimer <= 0) {
    aiFighter.aiPlanTimer = reactionWindow + 22;
    const charId = aiFighter.characterId;

    if (isOpeningFootsies) {
      aiFighter.aiCurrentPlan =
        dist > 230 ? 'approach' : dist < 170 ? 'retreat' : 'zone';
    } else if (charId === 'alien') {
      aiFighter.aiCurrentPlan = dist < 180 ? 'retreat' : 'zone';
    } else if (charId === 'patova') {
      aiFighter.aiCurrentPlan =
        dist > 110 ? 'approach' : rng < 0.3 ? 'retreat' : 'pressure';
    } else if (charId === 'braian' || charId === 'rag') {
      aiFighter.aiCurrentPlan = dist > 115 ? 'approach' : 'pressure';
    } else if (charId === 'jenny') {
      aiFighter.aiCurrentPlan =
        dist > 155 ? 'approach' : dist < 85 ? 'retreat' : 'pressure';
    } else {
      aiFighter.aiCurrentPlan = dist > 125 ? 'approach' : 'pressure';
    }
  } else {
    aiFighter.aiPlanTimer -= 1;
  }

  if (aiFighter.aiCooldown > 0) {
    aiFighter.aiCooldown -= 1;
  }

  // Execute movement according to plan
  if (aiFighter.aiCurrentPlan === 'approach') {
    if (dist > 95) {
      input[forwardKey] = true;
      if (
        !isOpeningFootsies &&
        (aiFighter.characterId === 'braian' || aiFighter.characterId === 'rag') &&
        dist > 160 &&
        dist < 240 &&
        state.frame % 60 === 0
      ) {
        input.up = true;
        input.justPressed.up = true;
      }
    }
  } else if (aiFighter.aiCurrentPlan === 'retreat') {
    if (dist < 240) {
      input[backwardKey] = true;
    }
  } else if (aiFighter.aiCurrentPlan === 'zone') {
    if (dist < 200) {
      input[backwardKey] = true;
    } else if (dist > 310) {
      input[forwardKey] = true;
    }
  }

  // Execute offensive starters when cooldown allows
  if (aiFighter.aiCooldown <= 0 && !isOpeningFootsies) {
    // 1. Super Attack if meter is full and within range!
    if (aiFighter.meter >= 100 && dist < 165 && rng < specialProbability) {
      input.justPressed.superBtn = true;
      aiFighter.aiCooldown = reactionWindow + 35;
      return input;
    }

    // 2. Character-specific Special Moves at optimal distances
    if (aiFighter.characterId === 'alien' && dist > 180) {
      if (rng < specialProbability) {
        input.justPressed.special1 = true; // Psi Blast projectile
        aiFighter.aiCooldown = reactionWindow + 36;
        return input;
      }
    }

    if (aiFighter.characterId === 'patova') {
      if (dist < 90 && rng < specialProbability) {
        input.justPressed.special1 = true; // Control de Acceso command grab
        aiFighter.aiCooldown = reactionWindow + 34;
        return input;
      }
      if (dist >= 145 && dist < 220 && rng < specialProbability * 0.7) {
        input.justPressed.special2 = true; // Portazo shoulder charge
        aiFighter.aiCooldown = reactionWindow + 40;
        return input;
      }
    }

    if (
      (aiFighter.characterId === 'braian' ||
        aiFighter.characterId === 'rag' ||
        aiFighter.characterId === 'jenny' ||
        aiFighter.characterId === 'mostasa') &&
      dist >= 115 &&
      dist <= 190 &&
      rng < specialProbability * 0.8
    ) {
      if (rng < 0.35) input.justPressed.special1 = true;
      else if (rng < 0.7) input.justPressed.special2 = true;
      else input.justPressed.special3 = true;
      aiFighter.aiCooldown = reactionWindow + 34;
      return input;
    }

    // 3. Close-range normals & throws
    if (dist <= 118) {
      if (dist <= 78 && rng < 0.22 && humanFighter.grounded) {
        input.justPressed.grab = true;
        aiFighter.aiCooldown = reactionWindow + 20;
        return input;
      }

      const roll = (state.frame * 7) % 6;
      if (roll === 0) {
        input.justPressed.lp = true;
      } else if (roll === 1) {
        input.justPressed.lk = true;
      } else if (roll === 2) {
        input.down = true;
        input.justPressed.lk = true;
      } else if (roll === 3) {
        input.justPressed.hp = true;
      } else if (roll === 4) {
        input.justPressed.hk = true;
      } else {
        input.down = true;
        input.justPressed.hk = true; // Sweep
      }
      aiFighter.aiCooldown = reactionWindow + 16;
    }
  }

  return input;
}

