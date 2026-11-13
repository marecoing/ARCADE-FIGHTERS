import { CHARACTER_ORDER } from './characters';
import { CharacterId, CharacterStats, GameMode } from './types';

export interface PlayerSelection {
  characterId: CharacterId;
  cursorIndex: number;
  confirmed: boolean;
  isCPU: boolean;
}

export interface CharacterSelectState {
  mode: GameMode;
  player1: PlayerSelection;
  player2: PlayerSelection;
  activeSelector: 1 | 2;
}

export interface CharacterTraitBullet {
  title: string;
  description: string;
}

export interface CharacterGridCellBounds {
  characterId: CharacterId;
  row: 0 | 1;
  col: 0 | 1 | 2;
  x: number;
  y: number;
  width: number;
  height: number;
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

export interface CharacterArcadeMetadata {
  id: CharacterId;
  displayName: string;
  subtitle: string;
  gridLabel: string;
  portraitTags: string;
  portraitAsset: string;
  originLabel: string;
  styleLabel: string;
  accentHex: string;
  secondaryHex: string;
  glowRgba: string;
  stats: CharacterStats;
  characteristics: [
    CharacterTraitBullet,
    CharacterTraitBullet,
    CharacterTraitBullet,
  ];
}

export const CHARACTER_SELECT_CANVAS_WIDTH = 1672;
export const CHARACTER_SELECT_CANVAS_HEIGHT = 941;

export const CHARACTER_SELECT_2_0_ASSETS = {
  referenceImage: '/assets/ui/character-select-reference.png',
  cleanBackground: '/assets/ui/character-select-clean-bg.png',
  portraits: {
    mostasa: '/assets/ui/portraits/mostasa.png',
    braian: '/assets/ui/portraits/braian.png',
    rag: '/assets/ui/portraits/rag.png',
    patova: '/assets/ui/portraits/patova.png',
    jenny: '/assets/ui/portraits/jenny.png',
    alien: '/assets/ui/portraits/alien.png',
  } satisfies Record<CharacterId, string>,
} as const;

function toPctBox(x: number, y: number, width: number, height: number) {
  return {
    x,
    y,
    width,
    height,
    leftPct: Number(((x / CHARACTER_SELECT_CANVAS_WIDTH) * 100).toFixed(4)),
    topPct: Number(((y / CHARACTER_SELECT_CANVAS_HEIGHT) * 100).toFixed(4)),
    widthPct: Number(((width / CHARACTER_SELECT_CANVAS_WIDTH) * 100).toFixed(4)),
    heightPct: Number(((height / CHARACTER_SELECT_CANVAS_HEIGHT) * 100).toFixed(4)),
  };
}

export const CHARACTER_SELECT_2_0_LAYOUT = {
  canvasWidth: CHARACTER_SELECT_CANVAS_WIDTH,
  canvasHeight: CHARACTER_SELECT_CANVAS_HEIGHT,
  // Capa C: Personaje ampliado animado a la izquierda + placa de nombre y subtítulo
  previewShowcase: toPctBox(14, 48, 418, 526),
  previewNameplate: toPctBox(10, 566, 424, 98),
  // Capa D (Izquierda inferior): Cuadro metálico de 5 barras de estadísticas (FUERZA..TÉCNICA)
  statsPanelInner: toPctBox(33, 676, 380, 169),
  // Capa D (Derecha): Panel metálico de CARACTERÍSTICAS
  characteristicsPanelInner: toPctBox(1299, 294, 346, 358),
  characteristicsFooterArea: toPctBox(1299, 654, 346, 236),
  // Capa B: Cuadrícula 3x2 de retratos interactivos
  gridCells: [
    {
      characterId: 'mostasa',
      row: 0,
      col: 0,
      ...toPctBox(442, 230, 269, 290),
    },
    {
      characterId: 'braian',
      row: 0,
      col: 1,
      ...toPctBox(717, 230, 269, 290),
    },
    {
      characterId: 'rag',
      row: 0,
      col: 2,
      ...toPctBox(992, 230, 269, 290),
    },
    {
      characterId: 'patova',
      row: 1,
      col: 0,
      ...toPctBox(442, 529, 269, 309),
    },
    {
      characterId: 'jenny',
      row: 1,
      col: 1,
      ...toPctBox(717, 529, 269, 309),
    },
    {
      characterId: 'alien',
      row: 1,
      col: 2,
      ...toPctBox(992, 529, 269, 309),
    },
  ] satisfies CharacterGridCellBounds[],
  // Barra inferior de controles arcade
  bottomConfirmHotspot: toPctBox(380, 888, 635, 48),
  bottomBackHotspot: toPctBox(1030, 888, 300, 48),
} as const;

export const CHARACTER_SELECT_METADATA: Record<
  CharacterId,
  CharacterArcadeMetadata
> = {
  mostasa: {
    id: 'mostasa',
    displayName: 'MOSTASA',
    subtitle: 'THE MAST TURBADOUR',
    gridLabel: 'MOSTASA',
    portraitTags: 'Equilibrado • Fuerza • Técnica',
    portraitAsset: CHARACTER_SELECT_2_0_ASSETS.portraits.mostasa,
    originLabel: 'BUENOS AIRES, ARG',
    styleLabel: 'HEAVY METAL BRAWLER',
    accentHex: '#f59e0b',
    secondaryHex: '#fde047',
    glowRgba: 'rgba(245, 158, 11, 0.65)',
    stats: {
      strength: 8,
      speed: 6,
      defense: 7,
      reach: 6,
      technique: 8,
    },
    characteristics: [
      {
        title: 'Equilibrado',
        description: 'rinde bien en todas las distancias.',
      },
      {
        title: 'Fuerza',
        description: 'golpes potentes con gran impacto.',
      },
      {
        title: 'Técnica',
        description: 'estilo sólido, preciso y confiable.',
      },
    ],
  },
  braian: {
    id: 'braian',
    displayName: 'EL BRAIAN',
    subtitle: 'EL REY DEL CONURBANO',
    gridLabel: 'EL BRAIAN',
    portraitTags: 'Velocidad • Combos • Callejero',
    portraitAsset: CHARACTER_SELECT_2_0_ASSETS.portraits.braian,
    originLabel: 'CONURBANO, ARG',
    styleLabel: 'RUSHDOWN COMBO',
    accentHex: '#38bdf8',
    secondaryHex: '#facc15',
    glowRgba: 'rgba(56, 189, 248, 0.65)',
    stats: {
      strength: 5,
      speed: 10,
      defense: 4,
      reach: 6,
      technique: 8,
    },
    characteristics: [
      {
        title: 'Velocidad',
        description: 'ataques rápidos y presión constante.',
      },
      {
        title: 'Combos',
        description: 'encadena golpes con facilidad.',
      },
      {
        title: 'Agilidad',
        description: 'excelente movilidad en corta distancia.',
      },
    ],
  },
  rag: {
    id: 'rag',
    displayName: 'THE LITLLE RAG',
    subtitle: 'MUÑECO DE TRAPO POSEÍDO',
    gridLabel: 'THE LITLLE RAG',
    portraitTags: 'Ágil • Caótico • Impredecible',
    portraitAsset: CHARACTER_SELECT_2_0_ASSETS.portraits.rag,
    originLabel: 'TALLER TEXTIL',
    styleLabel: 'TRICKSTER RAGDOLL',
    accentHex: '#ef4444',
    secondaryHex: '#a3e635',
    glowRgba: 'rgba(239, 68, 68, 0.65)',
    stats: {
      strength: 4,
      speed: 10,
      defense: 4,
      reach: 5,
      technique: 9,
    },
    characteristics: [
      {
        title: 'Impredecible',
        description: 'movimientos caóticos y difíciles de leer.',
      },
      {
        title: 'Evasión',
        description: 'tamaño reducido y desplazamientos rápidos.',
      },
      {
        title: 'Acrobacia',
        description: 'ataques veloces desde ángulos inesperados.',
      },
    ],
  },
  patova: {
    id: 'patova',
    displayName: 'PATOVA MARCELO',
    subtitle: 'EL PORTERO IMPLACABLE',
    gridLabel: 'PATOVA MARCELO',
    portraitTags: 'Tanque • Agarre • Defensa',
    portraitAsset: CHARACTER_SELECT_2_0_ASSETS.portraits.patova,
    originLabel: 'PUERTO MADERO, ARG',
    styleLabel: 'GRAPPLER TITAN',
    accentHex: '#a855f7',
    secondaryHex: '#e879f9',
    glowRgba: 'rgba(168, 85, 247, 0.65)',
    stats: {
      strength: 10,
      speed: 3,
      defense: 10,
      reach: 7,
      technique: 5,
    },
    characteristics: [
      {
        title: 'Fuerza bruta',
        description: 'daño devastador en cada impacto.',
      },
      {
        title: 'Agarres',
        description: 'especialista en combate cuerpo a cuerpo.',
      },
      {
        title: 'Resistencia',
        description: 'alta defensa y gran presencia física.',
      },
    ],
  },
  jenny: {
    id: 'jenny',
    displayName: 'JENNY EL TRAVESAÑO',
    subtitle: 'LA REINA DE LA NOCHE',
    gridLabel: 'JENNY EL TRAVESAÑO',
    portraitTags: 'Alcance • Patadas • Glamour',
    portraitAsset: CHARACTER_SELECT_2_0_ASSETS.portraits.jenny,
    originLabel: 'AV. CORRIENTES, ARG',
    styleLabel: 'ACROBATIC KICKER',
    accentHex: '#ec4899',
    secondaryHex: '#f472b6',
    glowRgba: 'rgba(236, 72, 153, 0.65)',
    stats: {
      strength: 7,
      speed: 8,
      defense: 6,
      reach: 9,
      technique: 8,
    },
    characteristics: [
      {
        title: 'Alcance',
        description: 'patadas largas para controlar la distancia.',
      },
      {
        title: 'Agilidad',
        description: 'ataques elegantes, rápidos y versátiles.',
      },
      {
        title: 'Precisión',
        description: 'castiga errores con facilidad.',
      },
    ],
  },
  alien: {
    id: 'alien',
    displayName: 'THE ALIEN',
    subtitle: 'INVASOR INTERGALÁCTICO',
    gridLabel: 'THE ALIEN',
    portraitTags: 'Energía • Control • Teleport',
    portraitAsset: CHARACTER_SELECT_2_0_ASSETS.portraits.alien,
    originLabel: 'SECTOR ZETA-9',
    styleLabel: 'PSIONIC ZONER',
    accentHex: '#10b981',
    secondaryHex: '#34d399',
    glowRgba: 'rgba(16, 185, 129, 0.65)',
    stats: {
      strength: 6,
      speed: 7,
      defense: 5,
      reach: 10,
      technique: 9,
    },
    characteristics: [
      {
        title: 'Energía',
        description: 'ataques psíquicos y proyectiles cósmicos.',
      },
      {
        title: 'Control',
        description: 'domina el espacio a media y larga distancia.',
      },
      {
        title: 'Teletransporte',
        description: 'desplazamientos tácticos impredecibles.',
      },
    ],
  },
};

export function createInitialCharacterSelectState(
  mode: GameMode,
  p1Char: CharacterId = 'mostasa',
  p2Char: CharacterId = 'patova'
): CharacterSelectState {
  const p1Idx = Math.max(0, CHARACTER_ORDER.indexOf(p1Char));
  const p2Idx = Math.max(0, CHARACTER_ORDER.indexOf(p2Char));

  return {
    mode,
    player1: {
      characterId: CHARACTER_ORDER[p1Idx],
      cursorIndex: p1Idx,
      confirmed: false,
      isCPU: false,
    },
    player2: {
      characterId: CHARACTER_ORDER[p2Idx],
      cursorIndex: p2Idx,
      confirmed: false,
      isCPU: mode !== 'versus',
    },
    activeSelector: 1,
  };
}

/**
 * Navigates the 3 columns x 2 rows character grid with wrap-around.
 */
export function moveSelectionInGrid(
  current: CharacterId,
  dCol: number,
  dRow: number
): { characterId: CharacterId; cursorIndex: number } {
  const idx = Math.max(0, CHARACTER_ORDER.indexOf(current));
  const col = idx % 3;
  const row = Math.floor(idx / 3);
  const nextCol = (col + dCol + 3) % 3;
  const nextRow = (row + dRow + 2) % 2;
  const nextIndex = nextRow * 3 + nextCol;
  return {
    characterId: CHARACTER_ORDER[nextIndex],
    cursorIndex: nextIndex,
  };
}

/**
 * Moves P1 or P2 cursor if that slot is not currently locked/confirmed.
 */
export function movePlayerCursor(
  state: CharacterSelectState,
  slot: 1 | 2,
  dCol: number,
  dRow: number
): CharacterSelectState {
  if (slot === 1) {
    if (state.player1.confirmed) return state;
    const next = moveSelectionInGrid(state.player1.characterId, dCol, dRow);
    return {
      ...state,
      player1: {
        ...state.player1,
        characterId: next.characterId,
        cursorIndex: next.cursorIndex,
      },
    };
  }

  if (state.player2.confirmed) return state;
  const next = moveSelectionInGrid(state.player2.characterId, dCol, dRow);
  return {
    ...state,
    player2: {
      ...state.player2,
      characterId: next.characterId,
      cursorIndex: next.cursorIndex,
    },
  };
}

/**
 * Directly sets the character for P1 or P2 (e.g., via mouse hover or click).
 */
export function selectCharacterForSlot(
  state: CharacterSelectState,
  slot: 1 | 2,
  characterId: CharacterId
): CharacterSelectState {
  const cursorIndex = Math.max(0, CHARACTER_ORDER.indexOf(characterId));
  if (slot === 1) {
    return {
      ...state,
      player1: {
        ...state.player1,
        characterId,
        cursorIndex,
      },
    };
  }
  return {
    ...state,
    player2: {
      ...state.player2,
      characterId,
      cursorIndex,
    },
  };
}

/**
 * Confirms the selection for a given slot and updates `activeSelector` according to game mode:
 * - In `arcade`: Confirming P1 automatically selects and locks the first CPU challenger.
 * - In `cpu` or `training`: Confirming P1 advances `activeSelector` to 2 so the player can pick the opponent; confirming P2 completes the selection.
 * - In `versus`: P1 and P2 confirm independently.
 */
export function confirmPlayerSlot(
  state: CharacterSelectState,
  slot: 1 | 2
): CharacterSelectState {
  if (slot === 1) {
    if (state.mode === 'arcade') {
      const fallbackOpp =
        state.player2.characterId !== state.player1.characterId
          ? state.player2.characterId
          : CHARACTER_ORDER.find((id) => id !== state.player1.characterId) ||
            'patova';
      const oppIdx = Math.max(0, CHARACTER_ORDER.indexOf(fallbackOpp));
      return {
        ...state,
        player1: {
          ...state.player1,
          confirmed: true,
        },
        player2: {
          ...state.player2,
          characterId: fallbackOpp,
          cursorIndex: oppIdx,
          confirmed: true,
          isCPU: true,
        },
        activeSelector: 2,
      };
    }

    return {
      ...state,
      player1: {
        ...state.player1,
        confirmed: true,
      },
      activeSelector: 2,
    };
  }

  return {
    ...state,
    player2: {
      ...state.player2,
      confirmed: true,
    },
  };
}

/**
 * Cancels/unlocks a player's confirmed character so they can change fighters.
 */
export function cancelPlayerSlot(
  state: CharacterSelectState,
  slot: 1 | 2
): CharacterSelectState {
  if (slot === 2 && state.player2.confirmed) {
    return {
      ...state,
      player2: {
        ...state.player2,
        confirmed: false,
      },
      activeSelector: 2,
    };
  }

  if (slot === 1 && state.player1.confirmed) {
    return {
      ...state,
      player1: {
        ...state.player1,
        confirmed: false,
      },
      player2:
        state.mode === 'arcade'
          ? { ...state.player2, confirmed: false }
          : state.player2,
      activeSelector: 1,
    };
  }

  return state;
}

/**
 * Returns true when both Fighter 1 and Fighter 2 are confirmed and ready to launch VS / Match.
 */
export function isCharacterSelectReady(state: CharacterSelectState): boolean {
  return state.player1.confirmed && state.player2.confirmed;
}
