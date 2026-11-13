import { CHARACTERS } from './characters';
import {
  GROUND_Y,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  STAGE_LEFT_BOUND,
  STAGE_RIGHT_BOUND,
  STAGE_WIDTH,
} from './rules';
import { STAGE_REGISTRY, stageAssetManager } from './stageData';
import { CharacterId } from './types';

export interface StageRenderOptions {
  showFarLayer?: boolean;
  showMidLayer?: boolean;
  showNearLayer?: boolean;
  showFloorLayer?: boolean;
  showAmbientEffects?: boolean;
  enableParallax?: boolean;
  showFullFrame?: boolean;
  showFloorLine?: boolean;
  showStageBounds?: boolean;
}

const DEFAULT_RENDER_OPTIONS: Required<StageRenderOptions> = {
  showFarLayer: true,
  showMidLayer: true,
  showNearLayer: true,
  showFloorLayer: true,
  showAmbientEffects: true,
  enableParallax: true,
  showFullFrame: false,
  showFloorLine: false,
  showStageBounds: false,
};

export function renderStageBackground(
  ctx: CanvasRenderingContext2D,
  stageId: CharacterId,
  cameraX: number,
  frame: number,
  superFreeze: boolean,
  customOptions?: StageRenderOptions
): void {
  const opts: Required<StageRenderOptions> = {
    ...DEFAULT_RENDER_OPTIONS,
    ...customOptions,
  };
  const stage = CHARACTERS[stageId].stage;
  const loaded = stageAssetManager.getStageAsset(stageId);

  // Base fallback gradient canvas (also visible when specific layers are toggled off in Stage Previewer)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGrad.addColorStop(0, stage.skyTop);
  skyGrad.addColorStop(1, stage.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, GROUND_Y);

  const floorGrad = ctx.createLinearGradient(
    0,
    GROUND_Y - 38,
    0,
    LOGICAL_HEIGHT
  );
  floorGrad.addColorStop(0, stage.floorTop);
  floorGrad.addColorStop(1, stage.floorBottom);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(
    0,
    GROUND_Y - 38,
    LOGICAL_WIDTH,
    LOGICAL_HEIGHT - (GROUND_Y - 38)
  );

  // Camera normalized position: cameraX ranges in [0, STAGE_WIDTH - LOGICAL_WIDTH] = [0, 320]
  const maxCamX = Math.max(1, STAGE_WIDTH - LOGICAL_WIDTH);
  const clampedCamX = Math.max(0, Math.min(maxCamX, cameraX));
  // camNorm in [-1, +1], where 0 is stage center (cameraX = 160)
  const camNorm = opts.enableParallax
    ? (clampedCamX - maxCamX / 2) / (maxCamX / 2)
    : 0;

  // Strictly 16:9 destination dimensions:
  // Full-frame mode shows exact 960x540 (0 overscan); combat camera mode uses 1088x612 (16:9)
  // providing ±64px of horizontal parallax travel without any distortion or empty borders.
  const destW = opts.showFullFrame ? LOGICAL_WIDTH : 1088;
  const destH = opts.showFullFrame ? LOGICAL_HEIGHT : 612;
  const maxTravelX = (destW - LOGICAL_WIDTH) / 2; // 64px in combat mode
  const baseDestY = opts.showFullFrame ? 0 : -28; // aligns illustrated floor horizon with GROUND_Y = 468

  const drawLayerImage = (img: HTMLImageElement, parallaxFactor: number) => {
    const shiftX = -camNorm * maxTravelX * parallaxFactor;
    const destX = (LOGICAL_WIDTH - destW) / 2 + shiftX;
    ctx.drawImage(
      img,
      0,
      0,
      img.naturalWidth || 1920,
      img.naturalHeight || 1080,
      destX,
      baseDestY,
      destW,
      destH
    );
  };

  if (loaded.status === 'ready' && loaded.background) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const allFourLayersActive =
      opts.showFarLayer &&
      opts.showMidLayer &&
      opts.showNearLayer &&
      opts.showFloorLayer;

    // When all 4 layers are enabled, draw the full background underneath at mid-parallax
    // so feathered transitions between parallax layers never expose the dark base gradient.
    if (allFourLayersActive) {
      drawLayerImage(loaded.background, 0.56);
    }

    // CAPA 1: BACKGROUND FAR (0.28x slow parallax)
    if (opts.showFarLayer && loaded.layers.far) {
      drawLayerImage(loaded.layers.far, 0.28);
    }

    // CAPA 2: BACKGROUND MID (0.56x moderate parallax)
    if (opts.showMidLayer && loaded.layers.mid) {
      drawLayerImage(loaded.layers.mid, 0.56);
    }

    // CAPA 3: BACKGROUND NEAR (0.82x near parallax)
    if (opts.showNearLayer && loaded.layers.near) {
      drawLayerImage(loaded.layers.near, 0.82);
    }

    // CAPA 4: FIGHT FLOOR (1.00x camera-locked floor parallax)
    if (opts.showFloorLayer && loaded.layers.floor) {
      drawLayerImage(loaded.layers.floor, 1.0);
    }

    ctx.restore();
  } else {
    // Fallback procedural depth while image decodes
    renderProceduralFallback(ctx, stageId, clampedCamX, frame, opts);
  }

  // Subtle perspective world-locked floor seam ticks so foot movement has 1:1 spatial reference
  if (opts.showFloorLayer) {
    renderWorldFloorPerspective(ctx, stageId, clampedCamX);
  }

  // CAPA 5: AMBIENT EFFECTS (Dynamic lights, fans, TV static, neon pulses, mist & particles)
  if (opts.showAmbientEffects) {
    renderStageAmbientEffects(ctx, stageId, camNorm, maxTravelX, frame);
  }

  // Subtle tonal separation & floor vignette for maximum fighter silhouette readability (Section 17)
  renderFighterReadabilityPass(ctx, stageId);

  // Super Freeze Dramatic Darkening Overlay
  if (superFreeze) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 5, 15, 0.72)';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    ctx.strokeStyle = stage.neonAccent;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
      const y = (i * 37 + frame * 19) % LOGICAL_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(LOGICAL_WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Optional Developer Debug Overlays (Floor Line & Stage Bounds for Stage Previewer)
  if (opts.showFloorLine || opts.showStageBounds) {
    renderStageDebugOverlays(ctx, stageId, clampedCamX, opts);
  }
}

/**
 * Renders subtle 1:1 world-space perspective lines on the fight floor so that
 * when fighters walk and cameraX pans, the floor surface tracks 1:1 with their feet.
 */
function renderWorldFloorPerspective(
  ctx: CanvasRenderingContext2D,
  stageId: CharacterId,
  cameraX: number
): void {
  const stage = CHARACTERS[stageId].stage;
  const floorTopY = GROUND_Y - 32;

  ctx.save();
  ctx.strokeStyle = stage.gridColor;
  ctx.globalAlpha = 0.14;
  ctx.lineWidth = 1.5;

  for (let gx = -160; gx <= STAGE_WIDTH + 160; gx += 90) {
    const screenTopX = gx - cameraX;
    const centerOffset = screenTopX - LOGICAL_WIDTH / 2;
    const screenBottomX = LOGICAL_WIDTH / 2 + centerOffset * 1.42;
    ctx.beginPath();
    ctx.moveTo(screenTopX, floorTopY);
    ctx.lineTo(screenBottomX, LOGICAL_HEIGHT);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * CAPA 5: AMBIENT EFFECTS
 * Stage-specific secondary animations, lights, fans, CRT interference, spotlights, mist, and particles.
 */
function renderStageAmbientEffects(
  ctx: CanvasRenderingContext2D,
  stageId: CharacterId,
  camNorm: number,
  maxTravelX: number,
  frame: number
): void {
  const midShiftX = -camNorm * maxTravelX * 0.56;
  const farShiftX = -camNorm * maxTravelX * 0.28;

  ctx.save();

  if (stageId === 'mostasa') {
    // METAL FIGHT CLUB:
    // 1. Fluorescent ceiling tube subtle flicker & warm gym light cones
    const lamps = [
      { x: 265, y: 24, w: 155 },
      { x: 715, y: 24, w: 155 },
      { x: 300, y: 84, w: 120 },
      { x: 660, y: 84, w: 120 },
    ];
    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i];
      const lx = l.x + farShiftX;
      const flicker =
        i === 1 && frame % 73 < 4
          ? 0.25
          : 0.75 + Math.sin(frame * 0.08 + i) * 0.15;
      const grad = ctx.createRadialGradient(
        lx,
        l.y,
        4,
        lx,
        l.y + 90,
        150
      );
      grad.addColorStop(0, `rgba(254, 240, 138, ${0.22 * flicker})`);
      grad.addColorStop(0.5, `rgba(250, 204, 21, ${0.08 * flicker})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lx, l.y + 40, 150, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Pulsing red neon glow around "METAL FIGHT CLUB" center sign
    const signX = LOGICAL_WIDTH / 2 + 12 + farShiftX;
    const signY = 148;
    const neonPulse = 0.65 + Math.sin(frame * 0.14) * 0.35;
    const signGrad = ctx.createRadialGradient(
      signX,
      signY,
      8,
      signX,
      signY,
      90
    );
    signGrad.addColorStop(0, `rgba(239, 68, 68, ${0.28 * neonPulse})`);
    signGrad.addColorStop(0.6, `rgba(249, 115, 22, ${0.12 * neonPulse})`);
    signGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = signGrad;
    ctx.fillRect(signX - 90, signY - 70, 180, 140);

    // 3. Spinning industrial wall fans (left and right of METAL FIGHT CLUB sign)
    const fans = [
      { x: 400 + farShiftX, y: 146, r: 22 },
      { x: 636 + farShiftX, y: 146, r: 22 },
    ];
    for (const fan of fans) {
      ctx.save();
      ctx.translate(fan.x, fan.y);
      ctx.rotate(frame * 0.24);
      ctx.strokeStyle = 'rgba(212, 212, 216, 0.28)';
      ctx.lineWidth = 3;
      for (let b = 0; b < 4; b++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(fan.r, 0);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Illuminated gym dust motes floating in the warm light
    for (let d = 0; d < 22; d++) {
      const dx =
        ((d * 97 + frame * (0.35 + (d % 3) * 0.12)) % (LOGICAL_WIDTH + 60)) -
        30;
      const dy = 70 + ((d * 53 + Math.sin(frame * 0.04 + d) * 18) % 360);
      const alpha = 0.25 + Math.sin(frame * 0.07 + d * 1.7) * 0.18;
      ctx.fillStyle = `rgba(254, 240, 138, ${Math.max(0.05, alpha)})`;
      ctx.fillRect(dx, dy, 2.5, 2.5);
    }
  } else if (stageId === 'braian') {
    // BARRIO BRAVO:
    // 1. Warm orange sodium streetlamp halo & slight moth/dust shimmer
    const lampX = 538 + farShiftX;
    const lampY = 82;
    const lampPulse = 0.82 + Math.sin(frame * 0.09) * 0.18;
    const lampGrad = ctx.createRadialGradient(
      lampX,
      lampY,
      6,
      lampX,
      lampY + 60,
      170
    );
    lampGrad.addColorStop(0, `rgba(251, 146, 60, ${0.34 * lampPulse})`);
    lampGrad.addColorStop(0.55, `rgba(245, 158, 11, ${0.14 * lampPulse})`);
    lampGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lampGrad;
    ctx.beginPath();
    ctx.arc(lampX, lampY + 45, 170, 0, Math.PI * 2);
    ctx.fill();

    // 2. Kiosco Barrio Bravo warm bulb string & OPEN sign neon pulse
    const kioscoX = 760 + midShiftX;
    const kioscoY = 195;
    const openBlink = frame % 50 < 42 ? 0.85 : 0.25;
    ctx.fillStyle = `rgba(34, 197, 94, ${0.22 * openBlink})`;
    ctx.beginPath();
    ctx.arc(688 + midShiftX, 230, 26, 0, Math.PI * 2);
    ctx.fill();

    for (let b = 0; b < 6; b++) {
      const bx = kioscoX - 88 + b * 36;
      const glow = 0.65 + Math.sin(frame * 0.12 + b) * 0.35;
      ctx.fillStyle = `rgba(254, 240, 138, ${0.38 * glow})`;
      ctx.beginPath();
      ctx.arc(bx, kioscoY, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Parked motorcycle headlight/indicator blink
    if (frame % 40 < 20) {
      const motoLightX = 278 + midShiftX;
      const motoLightY = 334;
      const mGrad = ctx.createRadialGradient(
        motoLightX,
        motoLightY,
        2,
        motoLightX,
        motoLightY,
        28
      );
      mGrad.addColorStop(0, 'rgba(250, 204, 21, 0.75)');
      mGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mGrad;
      ctx.beginPath();
      ctx.arc(motoLightX, motoLightY, 28, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Windblown street papers & summer night fireflies/sparks drifting across asphalt
    for (let p = 0; p < 8; p++) {
      const px = ((p * 173 + frame * 1.6) % (LOGICAL_WIDTH + 120)) - 60;
      const py =
        GROUND_Y - 18 + Math.sin(frame * 0.11 + p * 2.1) * 10 + (p % 3) * 12;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.sin(frame * 0.08 + p) * 0.5);
      ctx.fillStyle = 'rgba(226, 232, 240, 0.32)';
      ctx.fillRect(-6, -3, 12, 5);
      ctx.restore();
    }
  } else if (stageId === 'rag') {
    // RAG'S NIGHTMARE:
    // 1. Eerie glowing red/amber button eyes on the giant background doll & crate dolls
    const eyePulse = 0.55 + Math.sin(frame * 0.11) * 0.45;
    const giantEyeX = 518 + farShiftX;
    const giantEyeY = 92;
    const eyeGrad = ctx.createRadialGradient(
      giantEyeX,
      giantEyeY,
      2,
      giantEyeX,
      giantEyeY,
      36
    );
    eyeGrad.addColorStop(0, `rgba(239, 68, 68, ${0.65 * eyePulse})`);
    eyeGrad.addColorStop(0.5, `rgba(220, 38, 38, ${0.25 * eyePulse})`);
    eyeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.arc(giantEyeX, giantEyeY, 36, 0, Math.PI * 2);
    ctx.fill();

    // 2. CRT TV screens static interference flicker on the right workbenches
    const crts = [
      { x: 552 + midShiftX, y: 298, w: 28, h: 20 },
      { x: 792 + midShiftX, y: 256, w: 34, h: 26 },
      { x: 792 + midShiftX, y: 306, w: 34, h: 28 },
      { x: 878 + midShiftX, y: 252, w: 46, h: 30 },
    ];
    for (let c = 0; c < crts.length; c++) {
      const tv = crts[c];
      const glitch = (frame + c * 11) % 7 < 3;
      ctx.fillStyle = glitch
        ? 'rgba(163, 230, 53, 0.22)'
        : 'rgba(56, 189, 248, 0.16)';
      ctx.fillRect(tv.x, tv.y, tv.w, tv.h);
      // Scanline bar
      const scanY = tv.y + ((frame * 2 + c * 9) % tv.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(tv.x, scanY, tv.w, 2);
    }

    // 3. Red furnace glow on left conveyor & toxic green glow on right machinery
    const redGlow = ctx.createRadialGradient(
      260 + midShiftX,
      280,
      10,
      260 + midShiftX,
      280,
      140
    );
    redGlow.addColorStop(
      0,
      `rgba(239, 68, 68, ${0.18 + Math.sin(frame * 0.09) * 0.08})`
    );
    redGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = redGlow;
    ctx.beginPath();
    ctx.arc(260 + midShiftX, 280, 140, 0, Math.PI * 2);
    ctx.fill();

    // 4. Floating eerie green & violet factory spores / dust
    for (let s = 0; s < 20; s++) {
      const sx = ((s * 89 + frame * 0.3) % (LOGICAL_WIDTH + 40)) - 20;
      const sy = 80 + ((s * 67 - frame * 0.45 + 4000) % 370);
      ctx.fillStyle =
        s % 2 === 0
          ? 'rgba(163, 230, 53, 0.35)'
          : 'rgba(244, 63, 94, 0.28)';
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (stageId === 'patova') {
    // NO ENTRY CLUB:
    // 1. Pulsing pink & cyan neon marquee glow ("NO ENTRY CLUB")
    const pulse = 0.7 + Math.sin(frame * 0.16) * 0.3;
    const marqueeX = 650 + farShiftX;
    const marqueeY = 95;
    const mGrad = ctx.createRadialGradient(
      marqueeX,
      marqueeY,
      15,
      marqueeX,
      marqueeY,
      210
    );
    mGrad.addColorStop(0, `rgba(236, 72, 153, ${0.26 * pulse})`);
    mGrad.addColorStop(0.5, `rgba(56, 189, 248, ${0.14 * pulse})`);
    mGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.arc(marqueeX, marqueeY, 210, 0, Math.PI * 2);
    ctx.fill();

    // 2. Club entrance strobe beam & drifting disco smoke plumes
    const doorX = 795 + midShiftX;
    const doorY = 290;
    const strobe = frame % 32 < 4 ? 0.42 : 0.14;
    const doorGrad = ctx.createRadialGradient(
      doorX,
      doorY,
      8,
      doorX,
      doorY,
      145
    );
    doorGrad.addColorStop(0, `rgba(192, 132, 252, ${strobe})`);
    doorGrad.addColorStop(0.6, `rgba(56, 189, 248, ${strobe * 0.5})`);
    doorGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = doorGrad;
    ctx.beginPath();
    ctx.arc(doorX, doorY, 145, 0, Math.PI * 2);
    ctx.fill();

    // Drifting smoke puffs out of the open club doors
    for (let f = 0; f < 6; f++) {
      const cycle = (frame * 0.6 + f * 35) % 180;
      const fx = doorX - 30 + (cycle / 180) * 110;
      const fy = 335 - Math.sin((cycle / 180) * Math.PI) * 28;
      const fAlpha = Math.sin((cycle / 180) * Math.PI) * 0.16;
      const puffGrad = ctx.createRadialGradient(fx, fy, 4, fx, fy, 46);
      puffGrad.addColorStop(0, `rgba(226, 232, 240, ${fAlpha})`);
      puffGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = puffGrad;
      ctx.beginPath();
      ctx.arc(fx, fy, 46, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Shimmering neon reflections on wet sidewalk puddles
    const puddles = [
      { x: 250, y: 486, w: 120 },
      { x: 540, y: 472, w: 150 },
      { x: 690, y: 506, w: 140 },
    ];
    for (let i = 0; i < puddles.length; i++) {
      const p = puddles[i];
      const shimmer = Math.sin(frame * 0.14 + i * 2) * 8;
      ctx.strokeStyle =
        i % 2 === 0
          ? 'rgba(236, 72, 153, 0.28)'
          : 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + shimmer, p.y);
      ctx.lineTo(p.x + p.w + shimmer, p.y);
      ctx.stroke();
    }
  } else if (stageId === 'jenny') {
    // GLAMOUR ARENA:
    // 1. Sweeping theatrical concert spotlights from overhead rig
    for (let s = 0; s < 3; s++) {
      const anchorX = 270 + s * 210 + farShiftX;
      const sway = Math.sin(frame * 0.045 + s * 2.1) * 110;
      const beamGrad = ctx.createLinearGradient(anchorX, 20, anchorX + sway, GROUND_Y);
      if (s === 1) {
        beamGrad.addColorStop(0, 'rgba(244, 114, 182, 0.22)');
        beamGrad.addColorStop(1, 'rgba(244, 114, 182, 0.02)');
      } else {
        beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
        beamGrad.addColorStop(1, 'rgba(192, 132, 252, 0.02)');
      }
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(anchorX - 14, 20);
      ctx.lineTo(anchorX + 14, 20);
      ctx.lineTo(anchorX + sway + 85, GROUND_Y);
      ctx.lineTo(anchorX + sway - 85, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Twinkling glam stars & dressing mirror bulbs
    for (let st = 0; st < 18; st++) {
      const sx = 180 + ((st * 67) % 600) + farShiftX;
      const sy = 40 + ((st * 43) % 240);
      const twinkle = Math.max(0, Math.sin(frame * 0.15 + st * 1.9));
      if (twinkle > 0.4) {
        ctx.strokeStyle = `rgba(253, 244, 255, ${(twinkle - 0.4) * 0.9})`;
        ctx.lineWidth = 1.5;
        const r = 4 + twinkle * 5;
        ctx.beginPath();
        ctx.moveTo(sx - r, sy);
        ctx.lineTo(sx + r, sy);
        ctx.moveTo(sx, sy - r);
        ctx.lineTo(sx, sy + r);
        ctx.stroke();
      }
    }
  } else if (stageId === 'alien') {
    // AREA 51: MOTHERSHIP:
    // 1. Travelling neon-green & cyan energy pulses along the deck circuit lines
    const pulseProgress = (frame % 90) / 90;
    const pulseY = GROUND_Y - 40 + pulseProgress * 110;
    const lineGrad = ctx.createLinearGradient(0, pulseY - 12, 0, pulseY + 12);
    lineGrad.addColorStop(0, 'rgba(16, 185, 129, 0)');
    lineGrad.addColorStop(0.5, 'rgba(52, 211, 153, 0.32)');
    lineGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(0, pulseY - 12, LOGICAL_WIDTH, 24);

    // 2. Rising bio-bubbles inside the green alien stasis tubes
    const tubesX = [56 + midShiftX, 260 + midShiftX, 686 + midShiftX];
    for (let t = 0; t < tubesX.length; t++) {
      const tx = tubesX[t];
      for (let b = 0; b < 5; b++) {
        const by = 310 - (((frame * 0.9 + b * 28 + t * 17) % 110));
        const bx = tx + Math.sin(frame * 0.08 + b) * 8;
        ctx.fillStyle = 'rgba(167, 243, 208, 0.45)';
        ctx.beginPath();
        ctx.arc(bx, by, 2.5 + (b % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Holographic star-chart scanline shimmer in the center bridge console
    const holoX = 445 + midShiftX;
    const holoY = 242;
    const scanOffset = (frame * 1.5) % 46;
    ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
    ctx.fillRect(holoX, holoY + scanOffset, 72, 3);
  }

  ctx.restore();
}

/**
 * Ensures optimal silhouette separation between the background and the 2D fighter sprites (Section 17).
 */
function renderFighterReadabilityPass(
  ctx: CanvasRenderingContext2D,
  stageId: CharacterId
): void {
  const stage = CHARACTERS[stageId].stage;
  ctx.save();

  // Subtle floor horizon rim light + ground shadow gradient so feet and legs read clearly
  const floorRim = ctx.createLinearGradient(0, GROUND_Y - 56, 0, LOGICAL_HEIGHT);
  floorRim.addColorStop(0, 'rgba(0, 0, 0, 0.18)');
  floorRim.addColorStop(0.35, 'rgba(0, 0, 0, 0.04)');
  floorRim.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
  ctx.fillStyle = floorRim;
  ctx.fillRect(0, GROUND_Y - 56, LOGICAL_WIDTH, LOGICAL_HEIGHT - (GROUND_Y - 56));

  // Subtle top HUD vignette so health bars and timer always have high contrast
  const topVignette = ctx.createLinearGradient(0, 0, 0, 96);
  topVignette.addColorStop(0, 'rgba(5, 5, 12, 0.42)');
  topVignette.addColorStop(1, 'rgba(5, 5, 12, 0)');
  ctx.fillStyle = topVignette;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, 96);

  // Subtle floor contact line accent
  ctx.strokeStyle = stage.neonAccent;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 2);
  ctx.lineTo(LOGICAL_WIDTH, GROUND_Y + 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders developer debug overlays for the Stage Previewer tool (Section 20):
 * - Floor line (GROUND_Y = 468)
 * - World bounds (STAGE_LEFT_BOUND = 110, STAGE_RIGHT_BOUND = 1170)
 */
function renderStageDebugOverlays(
  ctx: CanvasRenderingContext2D,
  stageId: CharacterId,
  cameraX: number,
  opts: Required<StageRenderOptions>
): void {
  const reg = STAGE_REGISTRY[stageId];
  ctx.save();

  if (opts.showFloorLine) {
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(LOGICAL_WIDTH, GROUND_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(9, 9, 11, 0.88)';
    ctx.fillRect(14, GROUND_Y - 26, 290, 20);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1;
    ctx.strokeRect(14, GROUND_Y - 26, 290, 20);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(
      `FLOOR LINE · Y = ${reg.floorY}px (${Math.round((reg.floorY / LOGICAL_HEIGHT) * 100)}% H)`,
      22,
      GROUND_Y - 12
    );
  }

  if (opts.showStageBounds) {
    const leftScreenX = STAGE_LEFT_BOUND - cameraX;
    const rightScreenX = STAGE_RIGHT_BOUND - cameraX;
    const centerScreenX = STAGE_WIDTH / 2 - cameraX;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    // Left stage boundary
    ctx.beginPath();
    ctx.moveTo(leftScreenX, 40);
    ctx.lineTo(leftScreenX, LOGICAL_HEIGHT);
    ctx.stroke();

    // Right stage boundary
    ctx.beginPath();
    ctx.moveTo(rightScreenX, 40);
    ctx.lineTo(rightScreenX, LOGICAL_HEIGHT);
    ctx.stroke();

    // Stage center axis
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)';
    ctx.beginPath();
    ctx.moveTo(centerScreenX, 60);
    ctx.lineTo(centerScreenX, LOGICAL_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    if (leftScreenX >= 4 && leftScreenX <= LOGICAL_WIDTH - 120) {
      ctx.fillText(`LEFT BOUND (${STAGE_LEFT_BOUND}px)`, leftScreenX + 6, 75);
    }
    if (rightScreenX >= 120 && rightScreenX <= LOGICAL_WIDTH - 4) {
      ctx.fillText(
        `RIGHT BOUND (${STAGE_RIGHT_BOUND}px)`,
        rightScreenX - 155,
        75
      );
    }
  }

  ctx.restore();
}

/**
 * Fallback procedural renderer used only while the 1920x1080 PNG stage assets are decoding
 * or when individual layers are isolated.
 */
function renderProceduralFallback(
  ctx: CanvasRenderingContext2D,
  stageId: CharacterId,
  cameraX: number,
  frame: number,
  opts: Required<StageRenderOptions>
): void {
  const stage = CHARACTERS[stageId].stage;
  if (opts.showFarLayer) {
    ctx.save();
    ctx.translate(-cameraX * 0.28, 0);
    ctx.fillStyle = stage.skyBottom;
    ctx.fillRect(0, 40, 1280, 220);
    ctx.restore();
  }
  if (opts.showMidLayer) {
    ctx.save();
    ctx.translate(-cameraX * 0.56, 0);
    ctx.strokeStyle = stage.neonAccent;
    ctx.lineWidth = 2;
    ctx.strokeRect(80, 100, 1120, 320);
    ctx.fillStyle = stage.neonAccent;
    ctx.font = 'bold 20px monospace';
    ctx.fillText(
      `${stage.name} · CARGANDO ESCENARIO 1920x1080...`,
      120,
      240 + Math.sin(frame * 0.1) * 4
    );
    ctx.restore();
  }
}
