export const UI_IMAGE_WIDTH = 1672;
export const UI_IMAGE_HEIGHT = 941;
export const UI_ASPECT_RATIO = UI_IMAGE_WIDTH / UI_IMAGE_HEIGHT;

export const UI_ASSETS = {
  titleScreen: '/assets/ui/title-screen.png',
  mainMenuOriginal: '/assets/ui/main-menu.png',
  mainMenuNeutral: '/assets/ui/main-menu-neutral.png',
  mainMenuHighlights: '/assets/ui/main-menu-highlights.png',
} as const;

export interface NormalizedButtonBounds {
  centerX: number; // 0..1
  centerY: number; // 0..1
  width: number; // 0..1
  height: number; // 0..1
  left: number; // 0..1
  top: number; // 0..1
  right: number; // 0..1
  bottom: number; // 0..1
  pxLeft: number;
  pxRight: number;
  pxTop: number;
  pxBottom: number;
}

/**
 * Pixel-verified coordinates of the illustrated ENTRAR button on title-screen.png (1672x941):
 * Red/yellow hexagonal button spans X: 562..1094, Y: 780..888
 * Center X = 49.52%, Center Y = 88.63%, Width = 31.82%, Height = 11.48%
 */
export const TITLE_ENTER_BUTTON: NormalizedButtonBounds = {
  centerX: 0.4952,
  centerY: 0.8863,
  width: 0.3182,
  height: 0.1148,
  left: 562 / UI_IMAGE_WIDTH,
  top: 780 / UI_IMAGE_HEIGHT,
  right: 1094 / UI_IMAGE_WIDTH,
  bottom: 888 / UI_IMAGE_HEIGHT,
  pxLeft: 562,
  pxRight: 1094,
  pxTop: 780,
  pxBottom: 888,
};

export type MainMenuOptionId =
  | 'arcade'
  | 'versus'
  | 'cpu'
  | 'training'
  | 'options'
  | 'howto'
  | 'soundtest'
  | 'exit';

export interface MainMenuOptionDef {
  index: number;
  id: MainMenuOptionId;
  label: string;
  description: string;
  /** Top Y in 1672x941 reference pixels */
  topY: number;
  /** Bottom Y in 1672x941 reference pixels */
  bottomY: number;
  /** Center Y in 1672x941 reference pixels */
  centerY: number;
  /** Normalized Center Y (0..1) */
  centerYNorm: number;
  /** Normalized Top Y (0..1) */
  topYNorm: number;
  /** Normalized Bottom Y (0..1) */
  bottomYNorm: number;
  /** Inner left X of the slanted parallelogram at topY */
  leftTopX: number;
  /** Inner right X of the slanted parallelogram at topY */
  rightTopX: number;
  /** Inner left X of the slanted parallelogram at bottomY */
  leftBottomX: number;
  /** Inner right X of the slanted parallelogram at bottomY */
  rightBottomX: number;
  /** Normalized bounding box for overlay positioning */
  normLeft: number;
  normWidth: number;
}

/**
 * Computes the exact inner left X of the slanted menu panel at a given Y pixel (0..941).
 */
export function getMenuPanelLeftInnerX(yPx: number): number {
  return Math.round(652 - (yPx - 396) * 0.45);
}

/**
 * Computes the exact inner right X of the slanted menu panel at a given Y pixel (0..941).
 */
export function getMenuPanelRightInnerX(yPx: number): number {
  return Math.round(1216 - (yPx - 396) * 0.415);
}

function buildMenuOption(
  index: number,
  id: MainMenuOptionId,
  label: string,
  description: string,
  topY: number,
  bottomY: number
): MainMenuOptionDef {
  const centerY = (topY + bottomY) / 2;
  const leftTopX = getMenuPanelLeftInnerX(topY);
  const rightTopX = getMenuPanelRightInnerX(topY);
  const leftBottomX = getMenuPanelLeftInnerX(bottomY);
  const rightBottomX = getMenuPanelRightInnerX(bottomY);
  const leftMidX = getMenuPanelLeftInnerX(centerY);
  const rightMidX = getMenuPanelRightInnerX(centerY);

  return {
    index,
    id,
    label,
    description,
    topY,
    bottomY,
    centerY,
    centerYNorm: centerY / UI_IMAGE_HEIGHT,
    topYNorm: topY / UI_IMAGE_HEIGHT,
    bottomYNorm: bottomY / UI_IMAGE_HEIGHT,
    leftTopX,
    rightTopX,
    leftBottomX,
    rightBottomX,
    normLeft: leftMidX / UI_IMAGE_WIDTH,
    normWidth: (rightMidX - leftMidX) / UI_IMAGE_WIDTH,
  };
}

/**
 * The 8 official Main Menu options in their exact, non-negotiable order and pixel-verified bounds.
 */
export const MAIN_MENU_OPTIONS: MainMenuOptionDef[] = [
  buildMenuOption(
    0,
    'arcade',
    'MODO ARCADE',
    'Torneo oficial contra la escalera de rivales de la CPU',
    304,
    362
  ),
  buildMenuOption(
    1,
    'versus',
    'MODO VERSUS',
    'Duelo local para 2 jugadores humanos en el mismo teclado',
    371,
    423
  ),
  buildMenuOption(
    2,
    'cpu',
    'VS CPU',
    'Combate individual directo contra la Inteligencia Artificial',
    430,
    483
  ),
  buildMenuOption(
    3,
    'training',
    'ENTRENAMIENTO',
    'Práctica libre con energía restaurable, combos y hitboxes',
    489,
    543
  ),
  buildMenuOption(
    4,
    'options',
    'OPCIONES',
    'Ajustes de audio 8-bit, dificultad, rounds y pantalla',
    549,
    603
  ),
  buildMenuOption(
    5,
    'howto',
    'CÓMO JUGAR',
    'Manual de controles, movimientos especiales y superataques',
    609,
    663
  ),
  buildMenuOption(
    6,
    'soundtest',
    'SOUND TEST',
    'Reproductor interactivo de la banda sonora Heavy Metal 8-Bit',
    670,
    725
  ),
  buildMenuOption(
    7,
    'exit',
    'SALIR',
    'Regresar a la pantalla de portada oficial',
    731,
    791
  ),
];

export interface ContainedStageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Computes the exact letterboxed/pillarboxed 16:9 stage rectangle inside a viewport container.
 */
export function computeContainedStageRect(
  containerWidth: number,
  containerHeight: number,
  aspectWidth = UI_IMAGE_WIDTH,
  aspectHeight = UI_IMAGE_HEIGHT
): ContainedStageRect {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { left: 0, top: 0, width: aspectWidth, height: aspectHeight };
  }
  const targetRatio = aspectWidth / aspectHeight;
  const containerRatio = containerWidth / containerHeight;

  let width = containerWidth;
  let height = containerHeight;
  if (containerRatio > targetRatio) {
    // Pillarboxed (bars on left and right)
    height = containerHeight;
    width = height * targetRatio;
  } else {
    // Letterboxed (bars on top and bottom)
    width = containerWidth;
    height = width / targetRatio;
  }

  return {
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
    width,
    height,
  };
}

/**
 * Converts client mouse coordinates (clientX, clientY) relative to the rendered stage rect
 * into normalized image coordinates (0..1). Returns null if outside the rendered image.
 */
export function clientToNormalizedStageCoords(
  clientX: number,
  clientY: number,
  stageRect: ContainedStageRect
): { normX: number; normY: number; pxX: number; pxY: number } | null {
  if (stageRect.width <= 0 || stageRect.height <= 0) return null;
  const normX = (clientX - stageRect.left) / stageRect.width;
  const normY = (clientY - stageRect.top) / stageRect.height;
  if (normX < 0 || normX > 1 || normY < 0 || normY > 1) return null;
  return {
    normX,
    normY,
    pxX: normX * UI_IMAGE_WIDTH,
    pxY: normY * UI_IMAGE_HEIGHT,
  };
}

/**
 * Tests whether normalized coordinates (0..1) fall inside the illustrated ENTRAR button on Title Screen.
 */
export function hitTestTitleEnterButton(normX: number, normY: number): boolean {
  const pxX = normX * UI_IMAGE_WIDTH;
  const pxY = normY * UI_IMAGE_HEIGHT;
  if (
    pxX < TITLE_ENTER_BUTTON.pxLeft ||
    pxX > TITLE_ENTER_BUTTON.pxRight ||
    pxY < TITLE_ENTER_BUTTON.pxTop ||
    pxY > TITLE_ENTER_BUTTON.pxBottom
  ) {
    return false;
  }
  // Hexagonal chamfer check on left and right ends (30px chamfer)
  const midY = (TITLE_ENTER_BUTTON.pxTop + TITLE_ENTER_BUTTON.pxBottom) / 2;
  const halfH = (TITLE_ENTER_BUTTON.pxBottom - TITLE_ENTER_BUTTON.pxTop) / 2;
  const dyRatio = Math.abs(pxY - midY) / Math.max(1, halfH);
  const chamfer = dyRatio * 28;
  return (
    pxX >= TITLE_ENTER_BUTTON.pxLeft + chamfer &&
    pxX <= TITLE_ENTER_BUTTON.pxRight - chamfer
  );
}

/**
 * Tests whether normalized coordinates (0..1) fall inside one of the 8 slanted Main Menu option rows.
 * Returns the option index (0..7) or -1 if outside all options (e.g., on characters or background).
 */
export function hitTestMainMenuOption(normX: number, normY: number): number {
  const pxX = normX * UI_IMAGE_WIDTH;
  const pxY = normY * UI_IMAGE_HEIGHT;

  for (const opt of MAIN_MENU_OPTIONS) {
    if (pxY >= opt.topY && pxY <= opt.bottomY) {
      const leftX = getMenuPanelLeftInnerX(pxY) - 18;
      const rightX = getMenuPanelRightInnerX(pxY);
      if (pxX >= leftX && pxX <= rightX) {
        return opt.index;
      }
    }
  }
  return -1;
}
