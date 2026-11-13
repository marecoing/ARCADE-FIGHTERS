'use client';

import React, { useEffect, useRef } from 'react';
import { CHARACTERS } from '@/lib/game/characters';
import { SPRITE_SHEET_CONFIGS } from '@/lib/game/spriteData';
import {
  SpriteAnimationController,
  spriteSheetManager,
} from '@/lib/game/spriteEngine';
import { renderSpriteFrame } from '@/lib/game/sprites';
import { CharacterId, FighterState } from '@/lib/game/types';

interface PortraitProps {
  characterId: CharacterId;
  isAlt?: boolean;
  size?: 'sm' | 'md' | 'lg';
  flipHorizontal?: boolean;
  className?: string;
}

/**
 * Renders the character's portrait directly from the real illustrated 1254x1254 PNG sprite sheet
 * (cropped around Frame 0's face and upper shoulders).
 */
export function CharacterPortrait({
  characterId,
  isAlt = false,
  size = 'md',
  flipHorizontal = false,
  className = '',
}: PortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const def = CHARACTERS[characterId];
  const cfg = SPRITE_SHEET_CONFIGS[characterId];
  const pal = isAlt ? def.altPalette : def.palette;

  const sizeClass =
    size === 'sm'
      ? 'w-12 h-12'
      : size === 'lg'
        ? 'w-28 h-28'
        : 'w-20 h-20';

  useEffect(() => {
    spriteSheetManager.preloadAll();

    const drawPortrait = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Subtle arcade backdrop gradient behind transparent PNG portrait
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, pal.primaryDark);
      grad.addColorStop(1, '#09090b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Diagonal speed stripe
      ctx.fillStyle = pal.accent;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(-10, h * 0.8);
      ctx.lineTo(w + 10, h * 0.2);
      ctx.lineTo(w + 10, h * 0.38);
      ctx.lineTo(-10, h * 0.98);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      const asset = spriteSheetManager.getAsset(characterId);
      if (asset.status === 'ready' && asset.image) {
        const source: CanvasImageSource =
          isAlt && asset.altCanvas ? asset.altCanvas : asset.image;
        const crop = cfg.portraitCrop;

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (flipHorizontal) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(
          source,
          crop.sourceX,
          crop.sourceY,
          crop.sourceWidth,
          crop.sourceHeight,
          0,
          4,
          w,
          h - 4
        );
        ctx.restore();
      }
    };

    drawPortrait();
    const unsub = spriteSheetManager.subscribe(drawPortrait);
    return () => unsub();
  }, [characterId, isAlt, flipHorizontal, cfg, pal]);

  return (
    <div
      className={`relative overflow-hidden border-2 border-amber-400/80 bg-zinc-900 shrink-0 ${sizeClass} ${className}`}
    >
      <canvas
        ref={canvasRef}
        width={128}
        height={128}
        aria-label={def.shortName}
        className="w-full h-full block object-cover"
      />
    </div>
  );
}

interface PreviewCanvasProps {
  characterId: CharacterId;
  isAlt?: boolean;
  poseState?: FighterState;
  facing?: 1 | -1;
}

/**
 * Live animated preview canvas using SpriteAnimationController and the real 1254x1254 PNG sprite sheet.
 */
export function FighterPreviewCanvas({
  characterId,
  isAlt = false,
  poseState = 'idle',
  facing = 1,
}: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    spriteSheetManager.preloadAll();
    const controller = new SpriteAnimationController(characterId);
    controller.setAnimation(poseState === 'victory' ? 'victory' : 'idle', true);
    controller.setFacingRight(facing === 1);

    const render = () => {
      controller.update(45);
      const frame = controller.getCurrentFrame();

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Ground reference line
          const groundY = 204;
          ctx.save();
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(20, groundY);
          ctx.lineTo(canvas.width - 20, groundY);
          ctx.stroke();
          ctx.restore();

          renderSpriteFrame(
            ctx,
            characterId,
            frame,
            canvas.width / 2,
            groundY,
            facing === 1,
            isAlt,
            {
              scaleMultiplier: 0.66,
              showShadow: true,
              groundY,
            }
          );
        }
      }
    };

    render();
    const unsub = spriteSheetManager.subscribe(render);
    const timerId = window.setInterval(render, 45);
    return () => {
      unsub();
      window.clearInterval(timerId);
    };
  }, [characterId, isAlt, poseState, facing]);

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={220}
      className="w-40 h-40 object-contain pointer-events-none"
    />
  );
}
