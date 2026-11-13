import { GROUND_Y, LOGICAL_HEIGHT, STAGE_WIDTH } from './rules';
import { CharacterId } from './types';

export type StageSlug =
  | 'metal_fight_club'
  | 'barrio_bravo'
  | 'rags_nightmare'
  | 'no_entry_club'
  | 'glamour_arena'
  | 'area_51_mothership';

export type StageLayerId = 'far' | 'mid' | 'near' | 'floor';

export interface StageRegistryEntry {
  id: StageSlug;
  characterId: CharacterId;
  ownerCharacterId: string;
  name: string;
  setting: string;
  location: string;
  backgroundUrl: string;
  backgroundLayers: string[];
  layerUrls: Record<StageLayerId, string>;
  musicTrackId: CharacterId;
  musicTitle: string;
  floorY: number;
  worldWidth: number;
  worldHeight: number;
  imageWidth: number;
  imageHeight: number;
  ambientEffects: string[];
}

export const stageCharacterMap = {
  mostasa: 'metal_fight_club',
  el_braian: 'barrio_bravo',
  the_litlle_rag: 'rags_nightmare',
  patova_marcelo: 'no_entry_club',
  jenny_el_travesano: 'glamour_arena',
  the_alien: 'area_51_mothership',
  // Direct lookup by CharacterId
  braian: 'barrio_bravo',
  rag: 'rags_nightmare',
  patova: 'no_entry_club',
  jenny: 'glamour_arena',
  alien: 'area_51_mothership',
} as const;

function createStageEntry(
  characterId: CharacterId,
  ownerCharacterId: string,
  slug: StageSlug,
  name: string,
  setting: string,
  location: string,
  musicTitle: string,
  ambientEffects: string[]
): StageRegistryEntry {
  const basePath = `/assets/stages/${slug}`;
  const layerUrls: Record<StageLayerId, string> = {
    far: `${basePath}/layers/far.png`,
    mid: `${basePath}/layers/mid.png`,
    near: `${basePath}/layers/near.png`,
    floor: `${basePath}/layers/floor.png`,
  };
  return {
    id: slug,
    characterId,
    ownerCharacterId,
    name,
    setting,
    location,
    backgroundUrl: `${basePath}/background.png`,
    backgroundLayers: [
      layerUrls.far,
      layerUrls.mid,
      layerUrls.near,
      layerUrls.floor,
    ],
    layerUrls,
    musicTrackId: characterId,
    musicTitle,
    floorY: GROUND_Y,
    worldWidth: STAGE_WIDTH,
    worldHeight: LOGICAL_HEIGHT,
    imageWidth: 1920,
    imageHeight: 1080,
    ambientEffects,
  };
}

export const STAGE_REGISTRY: Record<CharacterId, StageRegistryEntry> = {
  mostasa: createStageEntry(
    'mostasa',
    'mostasa',
    'metal_fight_club',
    'METAL FIGHT CLUB',
    'Gimnasio de boxeo argentino',
    'Reconquista, Santa Fe, Argentina (1996)',
    'The Mast Turbadour',
    [
      'punching_bags_sway',
      'industrial_fans_spin',
      'fluorescent_tubes_flicker',
      'metal_crowd_cheer',
      'gym_dust_motes',
    ]
  ),
  braian: createStageEntry(
    'braian',
    'el_braian',
    'barrio_bravo',
    'BARRIO BRAVO',
    'Esquina urbana argentina',
    'Barrio Popular Argentino · Noche de Verano 1996',
    'Streets of Fury',
    [
      'kiosco_sign_glow',
      'moto_headlight_pulse',
      'street_trees_breeze',
      'barrio_neighbors_react',
      'windblown_street_papers',
    ]
  ),
  rag: createStageEntry(
    'rag',
    'the_litlle_rag',
    'rags_nightmare',
    "RAG'S NIGHTMARE",
    'Fábrica abandonada de juguetes',
    'Antigua Fábrica de Juguetes · Subsuelo Industrial',
    'Ragged Madness',
    [
      'glowing_doll_eyes',
      'factory_gears_rotate',
      'crt_tv_static_interference',
      'hanging_plush_sway',
      'eerie_green_sparks',
    ]
  ),
  patova: createStageEntry(
    'patova',
    'patova_marcelo',
    'no_entry_club',
    'NO ENTRY CLUB',
    'Entrada de un boliche de los 90',
    'Avenida Nocturna Argentina · Viernes 02:30 AM',
    'No Entry Tonight',
    [
      'neon_marquee_pulse',
      'wet_puddle_reflections',
      'club_queue_sway',
      'entrance_disco_fog',
      'strobe_door_flashes',
    ]
  ),
  jenny: createStageEntry(
    'jenny',
    'jenny_el_travesano',
    'glamour_arena',
    'GLAMOUR ARENA',
    'Escenario nocturno de variedades',
    'Teatro de Revista y Variedades · Av. Corrientes',
    'Glamour of Steel',
    [
      'sweeping_stage_spotlights',
      'mirror_glitter_sparkles',
      'velvet_curtain_shimmer',
      'audience_applause_waves',
      'theatrical_stage_mist',
    ]
  ),
  alien: createStageEntry(
    'alien',
    'the_alien',
    'area_51_mothership',
    'AREA 51: MOTHERSHIP',
    'Interior de nave extraterrestre',
    'Nave Nodriza Zeta · Órbita Terrestre',
    'Cosmic Annihilation',
    [
      'circuit_floor_energy_pulses',
      'hologram_console_scanlines',
      'deep_space_stars_drift',
      'stasis_chamber_bubbles',
      'plasma_conduit_arcs',
    ]
  ),
};

export const STAGE_BY_SLUG: Record<StageSlug, StageRegistryEntry> = {
  metal_fight_club: STAGE_REGISTRY.mostasa,
  barrio_bravo: STAGE_REGISTRY.braian,
  rags_nightmare: STAGE_REGISTRY.rag,
  no_entry_club: STAGE_REGISTRY.patova,
  glamour_arena: STAGE_REGISTRY.jenny,
  area_51_mothership: STAGE_REGISTRY.alien,
};

export interface LoadedStageAssets {
  characterId: CharacterId;
  slug: StageSlug;
  status: 'idle' | 'loading' | 'ready' | 'error';
  background: HTMLImageElement | null;
  layers: Record<StageLayerId, HTMLImageElement | null>;
  errorMessage?: string;
}

class StageAssetManager {
  private assets: Record<CharacterId, LoadedStageAssets>;
  private listeners: Set<() => void> = new Set();
  private preloadStarted = false;

  constructor() {
    this.assets = {
      mostasa: this.createEmpty('mostasa', 'metal_fight_club'),
      braian: this.createEmpty('braian', 'barrio_bravo'),
      rag: this.createEmpty('rag', 'rags_nightmare'),
      patova: this.createEmpty('patova', 'no_entry_club'),
      jenny: this.createEmpty('jenny', 'glamour_arena'),
      alien: this.createEmpty('alien', 'area_51_mothership'),
    };
  }

  private createEmpty(
    characterId: CharacterId,
    slug: StageSlug
  ): LoadedStageAssets {
    return {
      characterId,
      slug,
      status: 'idle',
      background: null,
      layers: {
        far: null,
        mid: null,
        near: null,
        floor: null,
      },
    };
  }

  public preloadAll(): void {
    if (typeof window === 'undefined' || this.preloadStarted) return;
    this.preloadStarted = true;

    const charIds: CharacterId[] = [
      'mostasa',
      'braian',
      'rag',
      'patova',
      'jenny',
      'alien',
    ];

    for (const id of charIds) {
      this.loadStage(id);
    }
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
      img.src = url;
    });
  }

  private async loadStage(characterId: CharacterId): Promise<void> {
    const entry = STAGE_REGISTRY[characterId];
    const state = this.assets[characterId];
    state.status = 'loading';
    this.notify();

    try {
      const [bg, far, mid, near, floor] = await Promise.all([
        this.loadImage(entry.backgroundUrl),
        this.loadImage(entry.layerUrls.far),
        this.loadImage(entry.layerUrls.mid),
        this.loadImage(entry.layerUrls.near),
        this.loadImage(entry.layerUrls.floor),
      ]);

      state.background = bg;
      state.layers.far = far;
      state.layers.mid = mid;
      state.layers.near = near;
      state.layers.floor = floor;
      state.status = 'ready';
      this.notify();
    } catch (err) {
      state.status = 'error';
      state.errorMessage =
        err instanceof Error ? err.message : 'Error cargando escenario';
      this.notify();
    }
  }

  public getStageAsset(characterId: CharacterId): LoadedStageAssets {
    if (typeof window !== 'undefined' && !this.preloadStarted) {
      this.preloadAll();
    }
    return this.assets[characterId];
  }

  public getReadyCount(): number {
    return Object.values(this.assets).filter((a) => a.status === 'ready')
      .length;
  }

  public isAllReady(): boolean {
    return this.getReadyCount() === 6;
  }

  public getErrors(): string[] {
    return Object.values(this.assets)
      .filter((a) => a.status === 'error' && a.errorMessage)
      .map((a) => `${a.slug}: ${a.errorMessage}`);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const stageAssetManager = new StageAssetManager();
