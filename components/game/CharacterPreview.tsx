'use client';

import React, { useEffect, useRef } from 'react';
import { CHARACTER_SELECT_METADATA } from '@/lib/game/characterSelectController';
import { renderSpriteFrame } from '@/lib/game/sprites';
import {
  AnimationName,
  SpriteAnimationController,
  spriteSheetManager,
} from '@/lib/game/spriteEngine';
import { CharacterId } from '@/lib/game/types';

export interface CharacterPreviewProps {
  characterId: CharacterId;
  side: 'p1' | 'p2';
  confirmed: boolean;
  isAltPalette?: boolean;
  isCPU?: boolean;
  showNameplate?: boolean;
}

/**
 * CAPA C: Personaje Ampliado a la Izquierda (CharacterPreview)
 * Renders the currently selected fighter at large scale on the left side of the
 * Character Select 2.0 screen using the official original character appearance
 * (`spritesheet.png` 1254x1254 via `useLegacyFallback = true` / `forceLegacyFallback: true`)
 * so all 6 fighters match the reference illustration and Section 6 character designs.
 */
export function CharacterPreview({
  characterId,
  side,
  confirmed,
  isAltPalette = false,
  showNameplate = false,
}: CharacterPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animControllerRef = useRef<SpriteAnimationController>(
    new SpriteAnimationController(characterId, true)
  );
  const entryBurstUntilRef = useRef<number>(0);
  const lockBurstUntilRef = useRef<number>(0);
  const prevCharRef = useRef<CharacterId>(characterId);
  const prevConfirmedRef = useRef<boolean>(confirmed);

  const meta = CHARACTER_SELECT_METADATA[characterId];
  const facingRight = side === 'p1';

  // Recreate controller and trigger brief entrance pose when switching character
  useEffect(() => {
    const now = performance.now();
    if (prevCharRef.current !== characterId) {
      prevCharRef.current = characterId;
      entryBurstUntilRef.current = now + 380;
      const nextCtrl = new SpriteAnimationController(characterId, true);
      nextCtrl.setAnimation('heavyPunch', true);
      animControllerRef.current = nextCtrl;
    }
  }, [characterId]);

  // Trigger celebratory attack/victory animation when locking character
  useEffect(() => {
    const now = performance.now();
    if (confirmed && !prevConfirmedRef.current) {
      lockBurstUntilRef.current = now + 900;
      animControllerRef.current.setAnimation('victory', true);
    } else if (!confirmed && prevConfirmedRef.current) {
      animControllerRef.current.setAnimation('idle', true);
    }
    prevConfirmedRef.current = confirmed;
  }, [confirmed]);

  useEffect(() => {
    let lastTime = performance.now();
    spriteSheetManager.preloadAll();

    if (
      animControllerRef.current.characterId !== characterId ||
      !animControllerRef.current.isUsingLegacyFallback()
    ) {
      animControllerRef.current = new SpriteAnimationController(
        characterId,
        true
      );
    }

    const renderTick = () => {
      const now = performance.now();
      const dtMs = Math.min(60, Math.max(16, now - lastTime));
      lastTime = now;

      const controller = animControllerRef.current;
      let targetAnim: AnimationName = 'idle';
      if (confirmed) {
        targetAnim = now < lockBurstUntilRef.current ? 'heavyKick' : 'victory';
      } else if (now < entryBurstUntilRef.current) {
        targetAnim = 'heavyPunch';
      } else {
        targetAnim = 'idle';
      }

      if (controller.getAnimationName() !== targetAnim) {
        controller.setAnimation(targetAnim, true);
      }
      controller.update(dtMs);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // 1. Subtle Backlit Character Aura matching the fighter's accent color
          const auraGrad = ctx.createRadialGradient(
            w * 0.5,
            h * 0.52,
            20,
            w * 0.5,
            h * 0.52,
            w * 0.46
          );
          auraGrad.addColorStop(
            0,
            confirmed ? 'rgba(250, 204, 21, 0.36)' : meta.glowRgba
          );
          auraGrad.addColorStop(0.65, 'rgba(30, 27, 75, 0.08)');
          auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = auraGrad;
          ctx.fillRect(0, 0, w, h);

          // 2. Ground shadow and energy ring under fighter's boots
          const groundY = h - 18;
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(w * 0.5, groundY, w * 0.34, 14, 0, 0, Math.PI * 2);
          const podiumGrad = ctx.createRadialGradient(
            w * 0.5,
            groundY,
            4,
            w * 0.5,
            groundY,
            w * 0.34
          );
          podiumGrad.addColorStop(
            0,
            confirmed ? 'rgba(250, 204, 21, 0.65)' : 'rgba(99, 102, 241, 0.48)'
          );
          podiumGrad.addColorStop(0.7, 'rgba(15, 23, 42, 0.45)');
          podiumGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = podiumGrad;
          ctx.fill();
          ctx.restore();

          // 3. Full-Body Animated Fighter Sprite (scaled so head and boots never clip)
          const breathBob = Math.sin(now * 0.0055) * 2.2;
          const pulseScale = confirmed
            ? 1.88 + Math.sin(now * 0.008) * 0.03
            : 1.84;

          renderSpriteFrame(
            ctx,
            characterId,
            controller.getCurrentFrame(),
            w * 0.5,
            groundY + breathBob,
            facingRight,
            isAltPalette,
            {
              scaleMultiplier: pulseScale,
              isFlashing: now < entryBurstUntilRef.current - 250,
              isSuperAura: confirmed,
              showShadow: true,
              groundY,
              forceLegacyFallback: true,
            }
          );

          // 4. Confirmation Shockwave Ring
          if (confirmed && now < lockBurstUntilRef.current) {
            const progress = 1 - (lockBurstUntilRef.current - now) / 900;
            ctx.save();
            ctx.strokeStyle = `rgba(250, 204, 21, ${Math.max(0, 0.9 - progress)})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(
              w * 0.5,
              groundY - 4,
              w * (0.2 + progress * 0.25),
              10 + progress * 14,
              0,
              0,
              Math.PI * 2
            );
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    };

    renderTick();
    const unsub = spriteSheetManager.subscribe(renderTick);
    const intervalId = window.setInterval(renderTick, 40);
    return () => {
      unsub();
      window.clearInterval(intervalId);
    };
  }, [characterId, confirmed, facingRight, isAltPalette, meta.glowRgba]);

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-end pointer-events-none"
      data-testid={`character-preview-${side}`}
      data-character-id={characterId}
    >
      <canvas
        ref={canvasRef}
        width={420}
        height={526}
        className="w-full h-full object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.92)]"
      />
      {showNameplate && (
        <div className="sr-only">
          {meta.displayName} - {meta.subtitle}
        </div>
      )}
    </div>
  );
}

export default CharacterPreview;
