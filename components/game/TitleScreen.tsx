'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { arcadeAudio } from '@/lib/game/audio';
import {
  clientToNormalizedStageCoords,
  computeContainedStageRect,
  ContainedStageRect,
  hitTestTitleEnterButton,
  TITLE_ENTER_BUTTON,
  UI_ASSETS,
  UI_IMAGE_HEIGHT,
  UI_IMAGE_WIDTH,
} from '@/lib/game/menuOptions';

interface TitleScreenProps {
  onEnterMainMenu: () => void;
}

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  color: string;
}

function createAmbientParticles(count: number): AmbientParticle[] {
  const colors = ['#facc15', '#f43f5e', '#c084fc', '#38bdf8', '#fb923c'];
  const list: AmbientParticle[] = [];
  for (let i = 0; i < count; i++) {
    // Keep particles in perimeter/lower areas so faces and central logo stay crisp
    const side = i % 3;
    const x =
      side === 0
        ? 60 + ((i * 73) % 360)
        : side === 1
          ? 1250 + ((i * 89) % 360)
          : 420 + ((i * 131) % 830);
    const y =
      side === 2
        ? 700 + ((i * 53) % 220)
        : 180 + ((i * 97) % 720);
    list.push({
      x,
      y,
      vx: ((i % 5) - 2) * 0.18,
      vy: -0.25 - (i % 4) * 0.14,
      size: 1.8 + (i % 3) * 1.1,
      alpha: 0.25 + (i % 4) * 0.12,
      phase: i * 0.7,
      color: colors[i % colors.length],
    });
  }
  return list;
}

export function TitleScreen({ onEnterMainMenu }: TitleScreenProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [stageRect, setStageRect] = useState<ContainedStageRect>({
    left: 0,
    top: 0,
    width: UI_IMAGE_WIDTH,
    height: UI_IMAGE_HEIGHT,
  });
  const [isHoveringEnter, setIsHoveringEnter] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  const isHoveringRef = useRef<boolean>(false);
  const isTransitioningRef = useRef<boolean>(false);
  const transitionStartRef = useRef<number>(0);
  const particlesRef = useRef<AmbientParticle[]>(createAmbientParticles(34));

  // Load the official PORTADA illustration (/assets/ui/title-screen.png)
  useEffect(() => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = UI_ASSETS.titleScreen;
  }, []);

  // Maintain responsive 16:9 stage rect
  useEffect(() => {
    const updateSize = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setStageRect(
        computeContainedStageRect(
          rect.width,
          rect.height,
          UI_IMAGE_WIDTH,
          UI_IMAGE_HEIGHT
        )
      );
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const triggerEnterTransition = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    transitionStartRef.current = performance.now();
    setIsTransitioning(true);

    // Play arcade confirmation SFX and ensure Metal Warriors '96 is playing
    arcadeAudio.playMenuConfirm();
    arcadeAudio.playTrack('menu', false);

    window.setTimeout(() => {
      onEnterMainMenu();
    }, 380);
  }, [onEnterMainMenu]);

  // Keyboard (Enter / Space) & Gamepad (START / Button A) activation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTransitioningRef.current) return;
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
        e.preventDefault();
        e.stopPropagation();
        triggerEnterTransition();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Gamepad polling for START (button 9) or primary button (button 0)
    let rafId = 0;
    let prevPressed = true; // Start true so held button from previous screen does not auto-fire
    const pollGamepad = () => {
      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        const pads = navigator.getGamepads();
        let anyPressed = false;
        for (const pad of pads) {
          if (!pad) continue;
          if (pad.buttons[0]?.pressed || pad.buttons[9]?.pressed) {
            anyPressed = true;
            break;
          }
        }
        if (anyPressed && !prevPressed && !isTransitioningRef.current) {
          triggerEnterTransition();
        }
        prevPressed = anyPressed;
      }
      rafId = window.requestAnimationFrame(pollGamepad);
    };
    rafId = window.requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.cancelAnimationFrame(rafId);
    };
  }, [triggerEnterTransition]);

  // 60Hz Canvas Renderer: Official Illustration + Button Pulse + Ambient Sparks + Transition
  useEffect(() => {
    let rafId = 0;

    const render = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, UI_IMAGE_WIDTH, UI_IMAGE_HEIGHT);

          // 1. Draw official Title Screen illustration (1672x941)
          const img = imageRef.current;
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, 0, 0, UI_IMAGE_WIDTH, UI_IMAGE_HEIGHT);
          }

          // 2. Subtle ambient neon particles (never obscuring faces or logo)
          const t = now * 0.001;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          for (const p of particlesRef.current) {
            p.x += p.vx + Math.sin(t * 1.4 + p.phase) * 0.12;
            p.y += p.vy;
            if (p.y < 140) {
              p.y = UI_IMAGE_HEIGHT - 30;
            }
            if (p.x < 20) p.x = UI_IMAGE_WIDTH - 20;
            if (p.x > UI_IMAGE_WIDTH - 20) p.x = 20;

            const pulseAlpha =
              p.alpha * (0.65 + 0.35 * Math.sin(t * 3.2 + p.phase));
            const grad = ctx.createRadialGradient(
              p.x,
              p.y,
              0,
              p.x,
              p.y,
              p.size * 3.5
            );
            grad.addColorStop(0, p.color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = pulseAlpha;
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // 3. Subtle electrical arc shimmer around the logo lightning edges
          const sparkPhase = Math.sin(t * 7.5) * Math.cos(t * 11.3);
          if (sparkPhase > 0.55) {
            ctx.globalAlpha = (sparkPhase - 0.55) * 0.55;
            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            const baseX = sparkPhase > 0.75 ? 495 : 1175;
            const baseY = 470 + Math.sin(t * 19) * 45;
            ctx.moveTo(baseX, baseY);
            ctx.lineTo(baseX + 18, baseY - 14);
            ctx.lineTo(baseX + 6, baseY - 28);
            ctx.lineTo(baseX + 26, baseY - 44);
            ctx.stroke();
          }

          // 4. Dynamic Pulsing & Hover Illumination on the Illustrated ENTRAR Button
          const btnLeft = TITLE_ENTER_BUTTON.pxLeft;
          const btnRight = TITLE_ENTER_BUTTON.pxRight;
          const btnTop = TITLE_ENTER_BUTTON.pxTop;
          const btnBottom = TITLE_ENTER_BUTTON.pxBottom;
          const btnMidY = (btnTop + btnBottom) / 2;
          const chamfer = 28;

          const basePulse = 0.5 + 0.5 * Math.sin(t * 4.2);
          const hovered = isHoveringRef.current;
          const trans = isTransitioningRef.current;

          const traceHexPath = (pad: number) => {
            ctx.beginPath();
            ctx.moveTo(btnLeft + chamfer - pad * 0.4, btnTop - pad);
            ctx.lineTo(btnRight - chamfer + pad * 0.4, btnTop - pad);
            ctx.lineTo(btnRight + pad, btnMidY);
            ctx.lineTo(btnRight - chamfer + pad * 0.4, btnBottom + pad);
            ctx.lineTo(btnLeft + chamfer - pad * 0.4, btnBottom + pad);
            ctx.lineTo(btnLeft - pad, btnMidY);
            ctx.closePath();
          };

          // Soft outer neon halo around the original ENTRAR button
          const glowIntensity = trans
            ? 0.95
            : hovered
              ? 0.62 + basePulse * 0.25
              : 0.22 + basePulse * 0.28;

          ctx.save();
          traceHexPath(4);
          ctx.shadowColor = hovered ? '#fde047' : '#f97316';
          ctx.shadowBlur = hovered ? 32 : 20;
          ctx.strokeStyle = hovered
            ? `rgba(254, 240, 138, ${glowIntensity})`
            : `rgba(251, 146, 60, ${glowIntensity})`;
          ctx.lineWidth = hovered ? 4.5 : 3;
          ctx.stroke();

          // Subtle inner sheen on hover or pulse peak without altering button text legibility
          if (hovered || basePulse > 0.6) {
            traceHexPath(0);
            const sheenX =
              btnLeft + ((t * 420) % (btnRight - btnLeft + 220)) - 110;
            const sheenGrad = ctx.createLinearGradient(
              sheenX - 70,
              btnTop,
              sheenX + 70,
              btnBottom
            );
            sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
            sheenGrad.addColorStop(
              0.5,
              hovered
                ? 'rgba(254, 240, 138, 0.26)'
                : 'rgba(254, 240, 138, 0.12)'
            );
            sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = sheenGrad;
            ctx.fill();
          }
          ctx.restore();
          ctx.restore();

          // 5. Confirmation Flash & Smooth Fade Transition (380ms)
          if (isTransitioningRef.current) {
            const elapsed = now - transitionStartRef.current;
            const progress = Math.max(0, Math.min(1, elapsed / 380));

            // Initial crisp arcade flash (0..110ms) followed by smooth fade into Main Menu
            if (progress < 0.28) {
              const flashAlpha = (1 - progress / 0.28) * 0.55;
              ctx.fillStyle = `rgba(254, 240, 138, ${flashAlpha})`;
              ctx.fillRect(0, 0, UI_IMAGE_WIDTH, UI_IMAGE_HEIGHT);
            }
            const darkFade = Math.pow(progress, 1.35) * 0.92;
            ctx.fillStyle = `rgba(9, 5, 20, ${darkFade})`;
            ctx.fillRect(0, 0, UI_IMAGE_WIDTH, UI_IMAGE_HEIGHT);
          }
        }
      }
      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTransitioningRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const localX = e.clientX - bounds.left;
    const localY = e.clientY - bounds.top;

    const coords = clientToNormalizedStageCoords(localX, localY, stageRect);
    const overEnter = coords
      ? hitTestTitleEnterButton(coords.normX, coords.normY)
      : false;

    if (overEnter !== isHoveringRef.current) {
      isHoveringRef.current = overEnter;
      setIsHoveringEnter(overEnter);
      if (overEnter) {
        arcadeAudio.playMenuMove();
      }
    }
  };

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTransitioningRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const localX = e.clientX - bounds.left;
    const localY = e.clientY - bounds.top;

    const coords = clientToNormalizedStageCoords(localX, localY, stageRect);
    if (coords && hitTestTitleEnterButton(coords.normX, coords.normY)) {
      triggerEnterTransition();
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="title-screen"
      onMouseMove={handleMouseMove}
      onClick={handleStageClick}
      className={`relative w-full h-full bg-zinc-950 overflow-hidden select-none ${
        isHoveringEnter ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      {/* 16:9 Aspect-Ratio Preserving Stage Container */}
      <div
        style={{
          position: 'absolute',
          left: `${stageRect.left}px`,
          top: `${stageRect.top}px`,
          width: `${stageRect.width}px`,
          height: `${stageRect.height}px`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={UI_IMAGE_WIDTH}
          height={UI_IMAGE_HEIGHT}
          data-loaded={imageLoaded ? 'true' : 'false'}
          className="w-full h-full block"
        />

        {/* Transparent Interactive Surface Aligned to the Illustrated ENTRAR Button */}
        <button
          type="button"
          data-testid="title-enter-button"
          data-start="true"
          disabled={isTransitioning}
          aria-label="ENTRAR AL MENÚ PRINCIPAL"
          onMouseEnter={() => {
            if (!isHoveringRef.current && !isTransitioningRef.current) {
              isHoveringRef.current = true;
              setIsHoveringEnter(true);
              arcadeAudio.playMenuMove();
            }
          }}
          onMouseLeave={() => {
            if (isHoveringRef.current) {
              isHoveringRef.current = false;
              setIsHoveringEnter(false);
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            triggerEnterTransition();
          }}
          style={{
            position: 'absolute',
            left: `${TITLE_ENTER_BUTTON.left * 100}%`,
            top: `${TITLE_ENTER_BUTTON.top * 100}%`,
            width: `${TITLE_ENTER_BUTTON.width * 100}%`,
            height: `${TITLE_ENTER_BUTTON.height * 100}%`,
            background: 'transparent',
            border: 'none',
            outline: 'none',
          }}
          className="cursor-pointer focus:outline-none"
        >
          <span className="sr-only">ENTRAR</span>
        </button>
      </div>
    </div>
  );
}
