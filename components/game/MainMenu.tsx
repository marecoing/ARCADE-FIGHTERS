'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { arcadeAudio } from '@/lib/game/audio';
import {
  clientToNormalizedStageCoords,
  computeContainedStageRect,
  ContainedStageRect,
  getMenuPanelLeftInnerX,
  getMenuPanelRightInnerX,
  hitTestMainMenuOption,
  MAIN_MENU_OPTIONS,
  MainMenuOptionId,
  UI_ASSETS,
  UI_IMAGE_HEIGHT,
  UI_IMAGE_WIDTH,
} from '@/lib/game/menuOptions';

interface MainMenuProps {
  initialSelectedIndex?: number;
  onSelectOption: (optionId: MainMenuOptionId) => void;
  onBackToTitle: () => void;
}

interface MenuParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  color: string;
}

function createMenuParticles(count: number): MenuParticle[] {
  const colors = ['#c084fc', '#f43f5e', '#facc15', '#38bdf8'];
  const list: MenuParticle[] = [];
  for (let i = 0; i < count; i++) {
    const leftSide = i % 2 === 0;
    list.push({
      x: leftSide ? 50 + ((i * 67) % 340) : 1280 + ((i * 83) % 340),
      y: 160 + ((i * 109) % 740),
      vx: ((i % 3) - 1) * 0.15,
      vy: -0.22 - (i % 4) * 0.12,
      size: 1.6 + (i % 3) * 0.9,
      alpha: 0.22 + (i % 4) * 0.1,
      phase: i * 0.85,
      color: colors[i % colors.length],
    });
  }
  return list;
}

export function MainMenu({
  initialSelectedIndex = 0,
  onSelectOption,
  onBackToTitle,
}: MainMenuProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const neutralImgRef = useRef<HTMLImageElement | null>(null);
  const highlightsImgRef = useRef<HTMLImageElement | null>(null);
  const originalImgRef = useRef<HTMLImageElement | null>(null);

  const [selectedIndex, setSelectedIndex] = useState<number>(
    Math.max(0, Math.min(MAIN_MENU_OPTIONS.length - 1, initialSelectedIndex))
  );
  const [isPointerInOption, setIsPointerInOption] = useState<boolean>(false);
  const [assetsReady, setAssetsReady] = useState<boolean>(false);
  const [stageRect, setStageRect] = useState<ContainedStageRect>({
    left: 0,
    top: 0,
    width: UI_IMAGE_WIDTH,
    height: UI_IMAGE_HEIGHT,
  });

  const selectedIndexRef = useRef<number>(selectedIndex);
  const isTransitioningRef = useRef<boolean>(false);
  const confirmFlashStartRef = useRef<number>(0);
  const particlesRef = useRef<MenuParticle[]>(createMenuParticles(28));

  // Sync ref
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  // Load official Main Menu base (neutral) + dynamic 8-row highlight atlas
  useEffect(() => {
    let loadedCount = 0;
    const checkDone = () => {
      loadedCount += 1;
      if (loadedCount >= 3) {
        setAssetsReady(true);
      }
    };

    const neutral = new Image();
    neutral.decoding = 'async';
    neutral.onload = () => {
      neutralImgRef.current = neutral;
      checkDone();
    };
    neutral.src = UI_ASSETS.mainMenuNeutral;

    const highlights = new Image();
    highlights.decoding = 'async';
    highlights.onload = () => {
      highlightsImgRef.current = highlights;
      checkDone();
    };
    highlights.src = UI_ASSETS.mainMenuHighlights;

    const orig = new Image();
    orig.decoding = 'async';
    orig.onload = () => {
      originalImgRef.current = orig;
      checkDone();
    };
    orig.src = UI_ASSETS.mainMenuOriginal;
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

  const changeSelection = useCallback((nextIndex: number, playSound = true) => {
    if (isTransitioningRef.current) return;
    const total = MAIN_MENU_OPTIONS.length;
    const wrapped = ((nextIndex % total) + total) % total;
    if (wrapped !== selectedIndexRef.current) {
      selectedIndexRef.current = wrapped;
      setSelectedIndex(wrapped);
      if (playSound) {
        arcadeAudio.playMenuMove();
      }
    }
  }, []);

  const activateOption = useCallback(
    (indexToActivate: number) => {
      if (isTransitioningRef.current) return;
      const opt = MAIN_MENU_OPTIONS[indexToActivate];
      if (!opt) return;

      isTransitioningRef.current = true;
      confirmFlashStartRef.current = performance.now();

      if (opt.id === 'exit') {
        arcadeAudio.playMenuBack();
        window.setTimeout(() => {
          isTransitioningRef.current = false;
          onBackToTitle();
        }, 240);
        return;
      }

      arcadeAudio.playMenuConfirm();
      window.setTimeout(() => {
        isTransitioningRef.current = false;
        onSelectOption(opt.id);
      }, 240);
    },
    [onBackToTitle, onSelectOption]
  );

  // Keyboard Navigation (ArrowUp, ArrowDown, W, S, Enter, Space, Escape) with controlled key repeat
  useEffect(() => {
    let lastNavTime = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTransitioningRef.current) return;
      const code = e.code;

      if (
        code === 'ArrowUp' ||
        code === 'KeyW' ||
        code === 'ArrowDown' ||
        code === 'KeyS'
      ) {
        e.preventDefault();
        e.stopPropagation();
        const now = performance.now();
        // Prevent rapid involuntaries on key repeat (130ms throttle on held repeat)
        if (e.repeat && now - lastNavTime < 130) {
          return;
        }
        lastNavTime = now;
        const delta = code === 'ArrowUp' || code === 'KeyW' ? -1 : 1;
        changeSelection(selectedIndexRef.current + delta, true);
        return;
      }

      if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') {
        if (e.repeat) return;
        e.preventDefault();
        e.stopPropagation();
        activateOption(selectedIndexRef.current);
        return;
      }

      if (code === 'Escape' || code === 'Backspace') {
        if (e.repeat) return;
        e.preventDefault();
        e.stopPropagation();
        arcadeAudio.playMenuBack();
        onBackToTitle();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    // Gamepad polling (D-pad Up/Down, Left Stick Y with deadzone 0.5, A/START confirm, B back)
    let rafId = 0;
    let lastPadNavTime = 0;
    let prevConfirmPressed = true;
    let prevBackPressed = true;

    const pollGamepad = (now: number) => {
      if (
        !isTransitioningRef.current &&
        typeof navigator !== 'undefined' &&
        navigator.getGamepads
      ) {
        const pads = navigator.getGamepads();
        let navDir = 0;
        let confirmPressed = false;
        let backPressed = false;

        for (const pad of pads) {
          if (!pad) continue;
          const up = pad.buttons[12]?.pressed || (pad.axes[1] ?? 0) < -0.5;
          const down = pad.buttons[13]?.pressed || (pad.axes[1] ?? 0) > 0.5;
          if (up) navDir = -1;
          else if (down) navDir = 1;

          if (pad.buttons[0]?.pressed || pad.buttons[9]?.pressed) {
            confirmPressed = true;
          }
          if (pad.buttons[1]?.pressed) {
            backPressed = true;
          }
        }

        if (navDir !== 0 && now - lastPadNavTime > 175) {
          lastPadNavTime = now;
          changeSelection(selectedIndexRef.current + navDir, true);
        } else if (navDir === 0) {
          lastPadNavTime = 0;
        }

        if (confirmPressed && !prevConfirmPressed) {
          activateOption(selectedIndexRef.current);
        }
        if (backPressed && !prevBackPressed) {
          arcadeAudio.playMenuBack();
          onBackToTitle();
        }
        prevConfirmPressed = confirmPressed;
        prevBackPressed = backPressed;
      }
      rafId = window.requestAnimationFrame(pollGamepad);
    };
    rafId = window.requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.cancelAnimationFrame(rafId);
    };
  }, [activateOption, changeSelection, onBackToTitle]);

  // 60Hz Canvas Renderer: Neutral Base + Dynamic Row Highlight + Neon Pulse & Arrow Glow
  useEffect(() => {
    let rafId = 0;

    const render = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, UI_IMAGE_WIDTH, UI_IMAGE_HEIGHT);

          const neutralImg = neutralImgRef.current;
          const highlightsImg = highlightsImgRef.current;
          const origImg = originalImgRef.current;
          const activeIdx = selectedIndexRef.current;
          const activeOpt = MAIN_MENU_OPTIONS[activeIdx] || MAIN_MENU_OPTIONS[0];

          // 1. Draw the Neutral Main Menu Base (where MODO ARCADE has NO static red highlight)
          if (
            neutralImg &&
            neutralImg.complete &&
            neutralImg.naturalWidth > 0
          ) {
            ctx.drawImage(neutralImg, 0, 0, UI_IMAGE_WIDTH, UI_IMAGE_HEIGHT);
          } else if (origImg && origImg.complete && origImg.naturalWidth > 0) {
            ctx.drawImage(origImg, 0, 0, UI_IMAGE_WIDTH, UI_IMAGE_HEIGHT);
          }

          // 2. Draw Dynamic Highlight Slice for the Currently Selected Option (0..7)
          const sourceHighlightImg =
            activeIdx === 0 && origImg && origImg.complete
              ? origImg
              : highlightsImg;

          if (
            sourceHighlightImg &&
            sourceHighlightImg.complete &&
            sourceHighlightImg.naturalWidth > 0
          ) {
            const topY = activeOpt.topY - 4;
            const bottomY = activeOpt.bottomY + 4;
            const leftTop = getMenuPanelLeftInnerX(topY) - 62;
            const rightTop = getMenuPanelRightInnerX(topY) + 12;
            const leftBot = getMenuPanelLeftInnerX(bottomY) - 62;
            const rightBot = getMenuPanelRightInnerX(bottomY) + 12;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(leftTop, topY);
            ctx.lineTo(rightTop, topY);
            ctx.lineTo(rightBot, bottomY);
            ctx.lineTo(leftBot, bottomY);
            ctx.closePath();
            ctx.clip();

            ctx.drawImage(
              sourceHighlightImg,
              0,
              0,
              UI_IMAGE_WIDTH,
              UI_IMAGE_HEIGHT
            );
            ctx.restore();
          }

          // 3. Animated Neon Pulse & Arrow Glow on the Active Option Parallelogram
          const t = now * 0.001;
          const pulse = 0.5 + 0.5 * Math.sin(t * 5.2);
          const cellTopY = activeOpt.topY;
          const cellBotY = activeOpt.bottomY;
          const cellLeftTop = getMenuPanelLeftInnerX(cellTopY);
          const cellRightTop = getMenuPanelRightInnerX(cellTopY);
          const cellLeftBot = getMenuPanelLeftInnerX(cellBotY);
          const cellRightBot = getMenuPanelRightInnerX(cellBotY);

          ctx.save();
          ctx.globalCompositeOperation = 'screen';

          // Glowing outer border around the selected parallelogram
          ctx.beginPath();
          ctx.moveTo(cellLeftTop, cellTopY);
          ctx.lineTo(cellRightTop, cellTopY);
          ctx.lineTo(cellRightBot, cellBotY);
          ctx.lineTo(cellLeftBot, cellBotY);
          ctx.closePath();

          ctx.shadowColor = '#f97316';
          ctx.shadowBlur = 16 + pulse * 10;
          ctx.strokeStyle = `rgba(254, 240, 138, ${0.28 + pulse * 0.34})`;
          ctx.lineWidth = 2.8;
          ctx.stroke();

          // Subtle moving light sweep inside the selected option bar
          ctx.save();
          ctx.clip();
          const sweepSpan = cellRightTop - cellLeftBot + 240;
          const sweepX = cellLeftBot - 120 + ((t * 360) % sweepSpan);
          const sweepGrad = ctx.createLinearGradient(
            sweepX - 65,
            cellTopY,
            sweepX + 65,
            cellBotY
          );
          sweepGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          sweepGrad.addColorStop(
            0.5,
            `rgba(254, 240, 138, ${0.08 + pulse * 0.1})`
          );
          sweepGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = sweepGrad;
          ctx.fillRect(
            cellLeftBot - 20,
            cellTopY,
            cellRightTop - cellLeftBot + 40,
            cellBotY - cellTopY
          );
          ctx.restore();

          // Subtle pulsing halo on the yellow ">" arrow tip
          const arrowCenterX = (cellLeftTop + cellLeftBot) / 2 - 24;
          const arrowCenterY = (cellTopY + cellBotY) / 2;
          const arrowHalo = ctx.createRadialGradient(
            arrowCenterX,
            arrowCenterY,
            2,
            arrowCenterX,
            arrowCenterY,
            34
          );
          arrowHalo.addColorStop(
            0,
            `rgba(250, 204, 21, ${0.22 + pulse * 0.22})`
          );
          arrowHalo.addColorStop(1, 'rgba(250, 204, 21, 0)');
          ctx.fillStyle = arrowHalo;
          ctx.beginPath();
          ctx.arc(arrowCenterX, arrowCenterY, 34, 0, Math.PI * 2);
          ctx.fill();

          // 4. Ambient Side Particles
          for (const p of particlesRef.current) {
            p.x += p.vx + Math.sin(t * 1.3 + p.phase) * 0.1;
            p.y += p.vy;
            if (p.y < 140) p.y = UI_IMAGE_HEIGHT - 30;
            const pAlpha =
              p.alpha * (0.65 + 0.35 * Math.sin(t * 2.8 + p.phase));
            ctx.globalAlpha = pAlpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }

          // 5. Confirmation Flash on Option Click / Enter
          if (isTransitioningRef.current) {
            const elapsed = now - confirmFlashStartRef.current;
            const p = Math.max(0, Math.min(1, elapsed / 240));
            ctx.globalAlpha = (1 - p) * 0.65;
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.moveTo(cellLeftTop, cellTopY);
            ctx.lineTo(cellRightTop, cellTopY);
            ctx.lineTo(cellRightBot, cellBotY);
            ctx.lineTo(cellLeftBot, cellBotY);
            ctx.closePath();
            ctx.fill();
          }

          ctx.restore();
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
    if (!coords) {
      if (isPointerInOption) setIsPointerInOption(false);
      return;
    }

    const hitIdx = hitTestMainMenuOption(coords.normX, coords.normY);
    if (hitIdx >= 0) {
      if (!isPointerInOption) setIsPointerInOption(true);
      changeSelection(hitIdx, true);
    } else if (isPointerInOption) {
      setIsPointerInOption(false);
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
    if (!coords) return;

    const hitIdx = hitTestMainMenuOption(coords.normX, coords.normY);
    if (hitIdx >= 0) {
      changeSelection(hitIdx, false);
      activateOption(hitIdx);
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="main-menu-screen"
      data-selected-option={MAIN_MENU_OPTIONS[selectedIndex]?.id}
      data-selected-index={selectedIndex}
      onMouseMove={handleMouseMove}
      onClick={handleStageClick}
      className={`relative w-full h-full bg-zinc-950 overflow-hidden select-none ${
        isPointerInOption ? 'cursor-pointer' : 'cursor-default'
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
          data-loaded={assetsReady ? 'true' : 'false'}
          className="w-full h-full block"
        />

        {/* 8 Transparent Interactive Hitboxes Aligned to the Slanted Menu Rows */}
        {MAIN_MENU_OPTIONS.map((opt) => {
          const isSelected = selectedIndex === opt.index;
          return (
            <button
              key={opt.id}
              type="button"
              data-testid={`menu-option-${opt.id}`}
              data-option-index={opt.index}
              data-selected={isSelected ? 'true' : 'false'}
              aria-label={opt.label}
              aria-current={isSelected ? 'true' : undefined}
              onMouseEnter={() => {
                setIsPointerInOption(true);
                changeSelection(opt.index, true);
              }}
              onMouseLeave={() => {
                setIsPointerInOption(false);
              }}
              onClick={(e) => {
                e.stopPropagation();
                changeSelection(opt.index, false);
                activateOption(opt.index);
              }}
              style={{
                position: 'absolute',
                left: `${opt.normLeft * 100}%`,
                top: `${opt.topYNorm * 100}%`,
                width: `${opt.normWidth * 100}%`,
                height: `${(opt.bottomYNorm - opt.topYNorm) * 100}%`,
                transform: 'skewX(-23.5deg)',
                background: 'transparent',
                border: 'none',
                outline: 'none',
              }}
              className="cursor-pointer focus:outline-none"
            >
              <span className="sr-only">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
