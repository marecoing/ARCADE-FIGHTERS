import { CHARACTERS } from './characters';
import { HD_ATLAS_MANIFESTS } from './hdAtlasData';
import {
  getActiveHitbox,
  getFighterHurtboxes,
  getFighterPushbox,
  getFighterThrowBox,
  GROUND_Y,
  LOGICAL_WIDTH,
} from './rules';
import { SPRITE_SHEET_CONFIGS } from './spriteData';
import {
  buildLegacyCharacterAnimations,
  FrameData,
  resolveCombatSpriteFrame,
  spriteSheetManager,
} from './spriteEngine';
import { renderStageBackground } from './stages';
import {
  CharacterId,
  FighterRuntime,
  MatchSimulationState,
} from './types';

export interface RenderSpriteOptions {
  scaleMultiplier?: number;
  crouchCompressionY?: number;
  rotationDeg?: number;
  isFlashing?: boolean;
  isSuperAura?: boolean;
  showShadow?: boolean;
  groundY?: number;
  forceLegacyFallback?: boolean;
  debugOverlay?: {
    showCellBounds?: boolean;
    showTightBbox?: boolean;
    showAnchorPoint?: boolean;
  };
}

/**
 * COMBAT ANIMATION SYSTEM 2.0: Pure Sprite Sheet & HD Atlas Frame Renderer
 * Renders the exact pixels of the character's 1536x1024 HD Atlas (`atlas_hd.png`)
 * or preserved 1254x1254 Original Sprite Sheet (`spritesheet.png`) anchored at the
 * foot contact point (screenX, screenY), preserving uniform scale and horizontal flip.
 */
export function renderSpriteFrame(
  ctx: CanvasRenderingContext2D,
  characterId: CharacterId,
  frame: FrameData,
  screenX: number,
  screenY: number,
  facingRight: boolean,
  isAltPalette: boolean,
  options: RenderSpriteOptions = {}
): void {
  const asset = spriteSheetManager.getAsset(characterId);
  const cfg = SPRITE_SHEET_CONFIGS[characterId];
  const hdManifest = HD_ATLAS_MANIFESTS[characterId];
  const charDef = CHARACTERS[characterId];

  // Determine whether to render from the primary 1536x1024 HD Atlas or fallback to 1254x1254 spritesheet.png
  const useHd =
    !options.forceLegacyFallback &&
    frame.sourceType === 'HD_ATLAS' &&
    asset.hdStatus === 'ready' &&
    asset.hdImage !== null;

  let activeFrame = frame;
  if (!useHd && frame.sourceType === 'HD_ATLAS') {
    // Automatic graceful fallback to preserved 1254x1254 spritesheet.png if HD atlas is still decoding
    const legacyIdle = buildLegacyCharacterAnimations(characterId).idle;
    activeFrame =
      legacyIdle.frames[frame.frameIndex % legacyIdle.frames.length] ??
      legacyIdle.frames[0];
  }

  const scaleMult = options.scaleMultiplier ?? 1;
  const baseScale = useHd
    ? hdManifest.uniformScale540p
    : cfg.uniformScale540p;
  const scale = baseScale * scaleMult;
  const groundY = options.groundY ?? screenY;

  // Ground contact shadow beneath fighter
  if (options.showShadow !== false) {
    const airHeight = Math.max(0, groundY - screenY);
    const shadowScale = Math.max(0.35, 1 - airHeight / 260);
    const refWidth = useHd ? 96 : cfg.frames[0].bboxWidth;
    const shadowRadiusX = Math.max(
      26,
      Math.round(refWidth * scale * 0.42 * shadowScale)
    );
    const shadowRadiusY = Math.max(6, Math.round(shadowRadiusX * 0.22));

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.beginPath();
    ctx.ellipse(
      screenX,
      groundY + 2,
      shadowRadiusX,
      shadowRadiusY,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  const isDrawableReady = useHd
    ? asset.hdStatus === 'ready' && asset.hdImage !== null
    : asset.status === 'ready' && asset.image !== null;

  if (!isDrawableReady) {
    ctx.save();
    ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
    ctx.strokeStyle =
      asset.status === 'error' && asset.hdStatus === 'error'
        ? '#ef4444'
        : '#facc15';
    ctx.lineWidth = 2;
    ctx.fillRect(screenX - 70, screenY - 120, 140, 50);
    ctx.strokeRect(screenX - 70, screenY - 120, 140, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      asset.status === 'error' && asset.hdStatus === 'error'
        ? `ERROR SPRITE: ${characterId}`
        : `CARGANDO ATLAS HD...`,
      screenX,
      screenY - 92
    );
    ctx.restore();
    return;
  }

  const sourceDrawable: CanvasImageSource = useHd
    ? isAltPalette && asset.hdAltCanvas
      ? asset.hdAltCanvas
      : (asset.hdImage as HTMLImageElement)
    : isAltPalette && asset.altCanvas
      ? asset.altCanvas
      : (asset.image as HTMLImageElement);

  // Uniform destination dimensions preserving 100% original aspect ratio
  const destWidth = activeFrame.sourceWidth * scale;
  const destHeight = activeFrame.sourceHeight * scale;

  // Anchor at foot ground contact point (anchorX horizontally, footY vertically)
  const destX = -(activeFrame.anchorX + activeFrame.offsetX) * scale;
  const destY = -(activeFrame.footY + activeFrame.offsetY) * scale;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Translate to foot anchor and apply horizontal orientation flip
  ctx.translate(screenX, screenY);
  ctx.scale(facingRight ? 1 : -1, 1);

  const rotDeg = options.rotationDeg ?? activeFrame.rotationDeg ?? 0;
  if (rotDeg !== 0) {
    ctx.translate(0, -24 * scaleMult);
    ctx.rotate((rotDeg * Math.PI) / 180);
    ctx.translate(0, 24 * scaleMult);
  }

  // Optional super aura or hit flash filter on the real sprite pixels
  if (options.isFlashing) {
    ctx.filter = 'brightness(2.3) contrast(1.2)';
  } else if (options.isSuperAura) {
    ctx.shadowColor = charDef.palette.aura;
    ctx.shadowBlur = 18;
  }

  ctx.drawImage(
    sourceDrawable,
    activeFrame.sourceX,
    activeFrame.sourceY,
    activeFrame.sourceWidth,
    activeFrame.sourceHeight,
    destX,
    destY,
    destWidth,
    destHeight
  );

  ctx.filter = 'none';
  ctx.shadowBlur = 0;

  // Debug overlays in local sprite space (for ANIMATION LAB)
  if (options.debugOverlay) {
    if (options.debugOverlay.showCellBounds) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(destX, destY, destWidth, destHeight);
      ctx.setLineDash([]);
    }

    if (options.debugOverlay.showTightBbox) {
      const bx = destX + activeFrame.bboxX * scale;
      const by = destY + activeFrame.bboxY * scale;
      const bw = activeFrame.bboxWidth * scale;
      const bh = activeFrame.bboxHeight * scale;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
    }
  }

  ctx.restore();

  // Draw anchor crosshair in world space (unflipped)
  if (options.debugOverlay?.showAnchorPoint) {
    ctx.save();
    ctx.strokeStyle = '#f43f5e';
    ctx.fillStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX - 12, screenY);
    ctx.lineTo(screenX + 12, screenY);
    ctx.moveTo(screenX, screenY - 12);
    ctx.lineTo(screenX, screenY + 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(screenX, screenY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Renders a FighterRuntime in combat using its HD Atlas animations (with automatic fallback).
 */
export function renderFighterSprite(
  ctx: CanvasRenderingContext2D,
  fighter: FighterRuntime,
  cameraX: number,
  globalFrame: number
): void {
  const screenX = fighter.x - cameraX;
  const screenY = fighter.y;
  const resolved = resolveCombatSpriteFrame(fighter);
  const charDef = CHARACTERS[fighter.characterId];

  const isFlashing =
    fighter.flashFrames > 0 && Math.floor(globalFrame / 2) % 2 === 0;
  const isSuperAura =
    fighter.state === 'super' || fighter.state === 'special';

  const crouchOffsetY = resolved.crouchCompressionY < 1 ? 6 : 0;

  // Dash speed afterimage trail when dashing
  if (fighter.dashFrames > 0) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    renderSpriteFrame(
      ctx,
      fighter.characterId,
      resolved.frame,
      screenX - fighter.vx * 2.1,
      screenY + crouchOffsetY,
      fighter.facing === 1,
      fighter.isAltPalette,
      {
        scaleMultiplier: 1,
        rotationDeg: resolved.knockdownTiltDeg,
        showShadow: false,
        groundY: GROUND_Y,
      }
    );
    ctx.restore();
  }

  renderSpriteFrame(
    ctx,
    fighter.characterId,
    resolved.frame,
    screenX,
    screenY + crouchOffsetY,
    fighter.facing === 1,
    fighter.isAltPalette,
    {
      scaleMultiplier: 1,
      rotationDeg: resolved.knockdownTiltDeg,
      isFlashing,
      isSuperAura,
      showShadow: true,
      groundY: GROUND_Y,
    }
  );

  // Subtle impact energy flare at active attack hitbox tip
  if (
    (fighter.state === 'attacking' ||
      fighter.state === 'special' ||
      fighter.state === 'super') &&
    fighter.currentAttack
  ) {
    const activeBox = getActiveHitbox(fighter);
    const move = charDef.moves[fighter.currentAttack];
    if (activeBox && move && fighter.state !== 'attacking') {
      ctx.save();
      const tipX =
        fighter.facing === 1
          ? activeBox.x + activeBox.width - cameraX
          : activeBox.x - cameraX;
      const tipY = activeBox.y + activeBox.height / 2;
      const grad = ctx.createRadialGradient(tipX, tipY, 2, tipX, tipY, 26);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, move.effectColor);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function getComboRankBadge(hits: number): { label: string; color: string } {
  if (hits >= 8) return { label: 'MASTER COMBO!', color: '#f43f5e' };
  if (hits >= 5) return { label: 'ULTRA COMBO!', color: '#a855f7' };
  if (hits >= 4) return { label: 'AWESOME!', color: '#38bdf8' };
  if (hits >= 3) return { label: 'GREAT!', color: '#facc15' };
  return { label: 'GOOD!', color: '#4ade80' };
}

function renderChromeComboOverlay(
  ctx: CanvasRenderingContext2D,
  hits: number,
  damage: number,
  side: 'left' | 'right',
  globalFrame: number,
  lastHitFrame: number
): void {
  if (hits < 2) return;
  const age = Math.max(0, globalFrame - lastHitFrame);
  const popScale = age < 8 ? 1 + (8 - age) * 0.045 : 1;
  const anchorX = side === 'left' ? 38 : LOGICAL_WIDTH - 38;
  const anchorY = 148;
  const badge = getComboRankBadge(hits);

  ctx.save();
  ctx.translate(anchorX, anchorY);
  ctx.scale(popScale, popScale);
  ctx.textAlign = side;

  // Metallic background plate
  const plateW = 248;
  const plateH = 58;
  const plateX = side === 'left' ? -8 : -plateW + 8;
  ctx.fillStyle = 'rgba(9, 9, 11, 0.78)';
  ctx.strokeStyle = side === 'left' ? '#facc15' : '#38bdf8';
  ctx.lineWidth = 2;
  ctx.fillRect(plateX, -38, plateW, plateH);
  ctx.strokeRect(plateX, -38, plateW, plateH);

  // Chrome gradient for big HIT number + label
  const grad = ctx.createLinearGradient(0, -34, 0, 4);
  if (side === 'left') {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.45, '#fde047');
    grad.addColorStop(1, '#ea580c');
  } else {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.45, '#7dd3fc');
    grad.addColorStop(1, '#2563eb');
  }

  ctx.font = 'italic 900 28px sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#09090b';
  const mainText = `${hits} HIT COMBO!`;
  ctx.strokeText(mainText, 0, -6);
  ctx.fillStyle = grad;
  ctx.fillText(mainText, 0, -6);

  // Sub-banner: Rank badge + total damage
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = badge.color;
  const subText = `${badge.label} · ${damage} DMG`;
  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 3;
  ctx.strokeText(subText, 0, 13);
  ctx.fillText(subText, 0, 13);

  ctx.restore();
}

export function renderMatchCanvas(
  ctx: CanvasRenderingContext2D,
  state: MatchSimulationState,
  showHitboxes: boolean,
  enableCameraShake: boolean
): void {
  ctx.save();

  // Apply decaying trauma camera shake
  if (enableCameraShake && state.cameraShakeTrauma > 0.01) {
    const shakeAmt = state.cameraShakeTrauma * state.cameraShakeTrauma * 14;
    const ox = Math.sin(state.frame * 1.9) * shakeAmt;
    const oy = Math.cos(state.frame * 2.3) * shakeAmt;
    ctx.translate(ox, oy);
  }

  // 1. Render Parallax Stage & Floor
  renderStageBackground(
    ctx,
    state.stageId,
    state.cameraX,
    state.frame,
    state.superFreezeFrames > 0
  );

  // 2. Render Fighters using HD Atlas sprites (draw attacking fighter on top)
  const p1Attacking =
    state.p1.state === 'attacking' ||
    state.p1.state === 'special' ||
    state.p1.state === 'super';
  if (p1Attacking) {
    renderFighterSprite(ctx, state.p2, state.cameraX, state.frame);
    renderFighterSprite(ctx, state.p1, state.cameraX, state.frame);
  } else {
    renderFighterSprite(ctx, state.p1, state.cameraX, state.frame);
    renderFighterSprite(ctx, state.p2, state.cameraX, state.frame);
  }

  // 3. Render Projectiles (using extracted HD projectile frames + energy glow)
  for (const proj of state.projectiles) {
    if (!proj.active) continue;
    const px = proj.x - state.cameraX;
    const py = proj.y;
    const ownerCharId = proj.characterId;
    const hdManifest = HD_ATLAS_MANIFESTS[ownerCharId];
    const asset = spriteSheetManager.getAsset(ownerCharId);

    ctx.save();
    // Energy core radial glow behind projectile
    const grad = ctx.createRadialGradient(
      px,
      py,
      2,
      px,
      py,
      proj.radius + 14
    );
    grad.addColorStop(0, proj.coreColor);
    grad.addColorStop(0.55, proj.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, proj.radius + 14, 0, Math.PI * 2);
    ctx.fill();

    // Draw real illustrated HD projectile frame when available (e.g., Mostasa blue fireball, Alien psi orb, Rag shards)
    if (
      hdManifest.projectileFrames.length > 0 &&
      asset.hdStatus === 'ready' &&
      asset.hdImage
    ) {
      const pFrames = hdManifest.projectileFrames;
      const pf = pFrames[Math.floor(state.frame / 3) % pFrames.length];
      const pScale = hdManifest.uniformScale540p * 0.95;
      const dw = pf.width * pScale;
      const dh = pf.height * pScale;
      ctx.translate(px, py);
      ctx.scale(proj.vx >= 0 ? 1 : -1, 1);
      ctx.drawImage(
        asset.hdImage,
        pf.x,
        pf.y,
        pf.width,
        pf.height,
        -dw * 0.5,
        -dh * 0.5,
        dw,
        dh
      );
    }
    ctx.restore();
  }

  // 4. Render Pooled Particles (Sparks, Hit Rings, Guard Rings, Counter Bursts, Slash Arcs)
  for (const p of state.particles) {
    if (!p.active) continue;
    const px = p.x - state.cameraX;
    const py = p.y;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    if (p.type === 'hitring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === 'guard_ring') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(px, py, p.size, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, p.size * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === 'counter_burst') {
      ctx.strokeStyle = p.color;
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 3;
      const spikes = 8;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? p.size : p.size * 0.38;
        const a = (i * Math.PI) / spikes;
        const sx = px + Math.cos(a) * r;
        const sy = py + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (p.type === 'slash_arc') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px, py, p.size, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(px - p.size / 2, py - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }

  // 5. Optional 4-Volume Collision Debug Visualization (Pushbox, Hurtbox, Hitbox, Throw Range)
  if (showHitboxes) {
    ctx.save();
    const drawBoxes = (f: FighterRuntime) => {
      // 1) PUSHBOX (dashed cyan)
      const pushbox = getFighterPushbox(f);
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(pushbox.x - state.cameraX, pushbox.y, pushbox.width, pushbox.height);
      ctx.strokeRect(pushbox.x - state.cameraX, pushbox.y, pushbox.width, pushbox.height);
      ctx.setLineDash([]);

      // 2) HURTBOXES (anatomical torso, head, legs, extended limbs in green)
      const hurtboxes = getFighterHurtboxes(f);
      ctx.strokeStyle = '#22c55e';
      ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
      ctx.lineWidth = 2;
      for (const hb of hurtboxes) {
        ctx.fillRect(hb.x - state.cameraX, hb.y, hb.width, hb.height);
        ctx.strokeRect(hb.x - state.cameraX, hb.y, hb.width, hb.height);
      }

      // 3) THROW BOX (purple when grounded & close or attempting grab)
      if (f.currentAttack === 'grab' || Math.abs(state.p1.x - state.p2.x) <= 105) {
        const throwBox = getFighterThrowBox(f);
        ctx.strokeStyle = '#a855f7';
        ctx.fillStyle = 'rgba(168, 85, 247, 0.14)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(throwBox.x - state.cameraX, throwBox.y, throwBox.width, throwBox.height);
      }

      // 4) ACTIVE HITBOX (red)
      const activeHit = getActiveHitbox(f);
      if (activeHit) {
        ctx.strokeStyle = '#ef4444';
        ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
        ctx.lineWidth = 2.5;
        ctx.fillRect(
          activeHit.x - state.cameraX,
          activeHit.y,
          activeHit.width,
          activeHit.height
        );
        ctx.strokeRect(
          activeHit.x - state.cameraX,
          activeHit.y,
          activeHit.width,
          activeHit.height
        );
      }
    };
    drawBoxes(state.p1);
    drawBoxes(state.p2);

    // Draw contact point crosshair if a hit occurred recently
    if (
      state.lastHitEvent &&
      state.frame - state.lastHitEvent.frame <= 18 &&
      state.lastHitEvent.contactX !== undefined &&
      state.lastHitEvent.contactY !== undefined
    ) {
      const cx = state.lastHitEvent.contactX - state.cameraX;
      const cy = state.lastHitEvent.contactY;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy);
      ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx, cy + 10);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 6. Super Move Dramatic Banner
  if (state.superFreezeFrames > 0 && state.superMoveTitle) {
    ctx.save();
    ctx.fillStyle = 'rgba(234, 179, 8, 0.92)';
    ctx.fillRect(0, 195, LOGICAL_WIDTH, 68);
    ctx.fillStyle = '#09090b';
    ctx.font = '900 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`★ SUPER: ${state.superMoveTitle} ★`, LOGICAL_WIDTH / 2, 241);
    ctx.restore();
  }

  // 7. Chrome Arcade Combo Counter Callout on Canvas
  const lastHitFrame = state.lastHitEvent?.frame ?? state.frame;
  if (state.p2.comboCount >= 2) {
    renderChromeComboOverlay(
      ctx,
      state.p2.comboCount,
      state.p2.comboDamage,
      'left',
      state.frame,
      lastHitFrame
    );
  }
  if (state.p1.comboCount >= 2) {
    renderChromeComboOverlay(
      ctx,
      state.p1.comboCount,
      state.p1.comboDamage,
      'right',
      state.frame,
      lastHitFrame
    );
  }

  // 7b. Dynamic Combat Event Callout Banner (COUNTER HIT!, PUNISH!, THROW TECH!, SUPER CANCEL!)
  if (state.combatCallout && state.combatCallout.framesRemaining > 0) {
    const callout = state.combatCallout;
    const calloutX = callout.player === 1 ? 150 : LOGICAL_WIDTH - 150;
    const calloutY = 198;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'italic 900 22px sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#09090b';
    ctx.fillStyle = callout.color;
    ctx.strokeText(callout.text, calloutX, calloutY);
    ctx.fillText(callout.text, calloutX, calloutY);
    ctx.restore();
  }

  // 8. Center-Screen Arcade Announcements (ROUND 1, FIGHT!, K.O.!, PERFECT!)
  if (state.announcement) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 64px sans-serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#09090b';
    ctx.fillStyle = state.announcement.color;
    ctx.strokeText(state.announcement.text, LOGICAL_WIDTH / 2, 245);
    ctx.fillText(state.announcement.text, LOGICAL_WIDTH / 2, 245);

    if (
      state.announcement.subtext &&
      state.announcement.framesRemaining < 45
    ) {
      ctx.font = '900 42px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.strokeText(state.announcement.subtext, LOGICAL_WIDTH / 2, 300);
      ctx.fillText(state.announcement.subtext, LOGICAL_WIDTH / 2, 300);
    }
    ctx.restore();
  }

  ctx.restore();
}

