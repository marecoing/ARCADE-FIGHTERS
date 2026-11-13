import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, CHARACTER_ORDER, getRivalryDialogue } from './characters';
import {
  boxesOverlap,
  calculateDamage,
  canBlockAttack,
  createEmptyInputSnapshot,
  createInitialMatchState,
  detectMotionPattern,
  enforceFighterSeparation,
  getActiveHitbox,
  getFighterHurtboxes,
  resolveRequestedAttack,
  stepMatchSimulation,
} from './rules';
import { computeAiInput } from './ai';

test('All 6 characters exist with exact required names and 1-10 stats', () => {
  assert.equal(CHARACTER_ORDER.length, 6);
  assert.equal(
    CHARACTERS.mostasa.name,
    'MOSTASA "THE MAST TURBADOUR" CORGNALI'
  );
  assert.equal(CHARACTERS.braian.name, 'EL BRAIAN');
  assert.equal(CHARACTERS.rag.name, 'THE LITLLE RAG');
  assert.equal(CHARACTERS.patova.name, 'PATOVA MARCELO');
  assert.equal(CHARACTERS.jenny.name, 'JENNY EL TRAVESAÑO');
  assert.equal(CHARACTERS.alien.name, 'THE ALIEN');

  // Verify exact stat table from prompt section 5
  assert.deepEqual(CHARACTERS.mostasa.stats, {
    strength: 8,
    speed: 6,
    defense: 7,
    reach: 6,
    technique: 8,
  });
  assert.deepEqual(CHARACTERS.patova.stats, {
    strength: 10,
    speed: 3,
    defense: 10,
    reach: 7,
    technique: 5,
  });
  assert.deepEqual(CHARACTERS.rag.stats, {
    strength: 4,
    speed: 10,
    defense: 4,
    reach: 5,
    technique: 9,
  });
});

test('Fighters start with 1000 HP and never pass through each other', () => {
  const state = createInitialMatchState('mostasa', 'patova', true);
  assert.equal(state.p1.hp, 1000);
  assert.equal(state.p2.hp, 1000);

  state.p1.x = 600;
  state.p2.x = 610;
  enforceFighterSeparation(state.p1, state.p2);
  assert.ok(Math.abs(state.p2.x - state.p1.x) >= 62);
});

test('15-frame input buffer recognizes Quarter-Circle Forward and Dragon Punch motions', () => {
  const state = createInitialMatchState('mostasa', 'patova', false);
  const f = state.p1;
  f.inputBuffer = [
    { frame: 1, dir: 'D', lp: false, hp: false, lk: false, hk: false },
    { frame: 4, dir: 'DF', lp: false, hp: false, lk: false, hk: false },
    { frame: 7, dir: 'F', lp: true, hp: false, lk: false, hk: false },
  ];
  assert.equal(detectMotionPattern(f.inputBuffer, ['D', 'DF', 'F']), true);

  const input = createEmptyInputSnapshot();
  input.justPressed.lp = true;
  const move = resolveRequestedAttack(f, input);
  assert.equal(move, 'special1');
});

test('Attacks only deal damage during active frames when hitbox overlaps hurtbox', () => {
  const state = createInitialMatchState('mostasa', 'patova', false);
  state.roundPhase = 'fighting';
  state.roundPhaseFrames = 0;

  // Position far apart: attack should whiff and deal 0 damage
  state.p1.x = 300;
  state.p2.x = 800;

  const p1In = createEmptyInputSnapshot();
  const p2In = createEmptyInputSnapshot();
  p1In.justPressed.hp = true;

  stepMatchSimulation(state, p1In, p2In, 2);
  assert.equal(state.p1.state, 'attacking');
  assert.equal(state.p1.currentAttack, 'hp');

  const empty = createEmptyInputSnapshot();
  for (let i = 0; i < 35; i++) {
    stepMatchSimulation(state, empty, empty, 2);
  }
  assert.equal(state.p2.hp, 1000);

  // Now position close and execute Heavy Punch: should connect and reduce P2 HP
  state.p1.x = 500;
  state.p2.x = 568;
  const hitIn = createEmptyInputSnapshot();
  hitIn.justPressed.hp = true;
  stepMatchSimulation(state, hitIn, empty, 2);

  for (let i = 0; i < 20; i++) {
    stepMatchSimulation(state, empty, empty, 2);
  }
  assert.ok(state.p2.hp < 1000, 'P2 should take damage when hitbox connects');
  assert.ok(state.p1.meter > 0, 'P1 should gain special meter on hit');
});

test('High and low blocking rules work properly', () => {
  const state = createInitialMatchState('mostasa', 'patova', false);
  const defender = state.p2; // facing -1 (left), so holding right is back
  const defIn = createEmptyInputSnapshot();
  defIn.right = true;

  // Standing block blocks high and mid, but NOT low attacks
  assert.equal(canBlockAttack(defender, defIn, 'high'), true);
  assert.equal(canBlockAttack(defender, defIn, 'mid'), true);
  assert.equal(canBlockAttack(defender, defIn, 'low'), false);
  assert.equal(canBlockAttack(defender, defIn, 'throw'), false);

  // Crouch block blocks low attacks
  defIn.down = true;
  assert.equal(canBlockAttack(defender, defIn, 'low'), true);
});

test('Super attack consumes 100% meter and triggers dramatic freeze', () => {
  const state = createInitialMatchState('mostasa', 'patova', false);
  state.roundPhase = 'fighting';
  state.p1.meter = 100;

  const p1In = createEmptyInputSnapshot();
  p1In.justPressed.superBtn = true;
  stepMatchSimulation(state, p1In, createEmptyInputSnapshot(), 2);

  assert.equal(state.p1.state, 'super');
  assert.equal(state.p1.meter, 0);
  assert.ok(state.superFreezeFrames > 0);
  assert.equal(state.superMoveTitle, 'THE MAST TURBADOUM');
});

test('AI Opponent generates valid tactical decisions and rivalry dialogues exist', () => {
  const state = createInitialMatchState('mostasa', 'alien', true);
  state.roundPhase = 'fighting';
  const aiInput = computeAiInput(state, state.p2, state.p1, 'HARD');
  assert.equal(typeof aiInput.left, 'boolean');

  const dialogue = getRivalryDialogue('mostasa', 'patova');
  assert.equal(dialogue.p1Line, '¿Qué mirás, grandote?');
  assert.equal(dialogue.p2Line, 'Con esa pilcha no entrás.');
});

test('All 6 official 1254x1254 PNG sprite sheets exist on disk with 16 extracted frames and Phase 5 heights', async () => {
  const fs = await import('node:fs');
  const { SPRITE_SHEET_CONFIGS } = await import('./spriteData');

  const expectedHeights: Record<string, number> = {
    mostasa: 250,
    braian: 240,
    rag: 165,
    patova: 290,
    jenny: 260,
    alien: 255,
  };

  for (const id of CHARACTER_ORDER) {
    const cfg = SPRITE_SHEET_CONFIGS[id];
    assert.ok(cfg, `Missing sprite config for ${id}`);
    assert.equal(cfg.expectedWidth, 1254);
    assert.equal(cfg.expectedHeight, 1254);
    assert.equal(cfg.referenceHeight540p, expectedHeights[id]);
    assert.equal(cfg.frames.length, 16);

    // Check physical PNG file exists and has 1254x1254 RGBA PNG header
    const diskPath = `public${cfg.assetPath}`;
    assert.equal(fs.existsSync(diskPath), true, `Missing PNG file: ${diskPath}`);
    const buf = fs.readFileSync(diskPath);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    const colorType = buf.readUInt8(25);
    assert.equal(width, 1254);
    assert.equal(height, 1254);
    assert.equal(colorType, 6, 'Sprite sheet must be RGBA with alpha transparency');
  }
});

test('SpriteAnimationController and resolveCombatSpriteFrame synchronize attacks with HD and Legacy frames', async () => {
  const { SpriteAnimationController, resolveCombatSpriteFrame } = await import(
    './spriteEngine'
  );

  // Legacy 4x4 fallback controller preserves exact 0..15 cell indices
  const legacyCtrl = new SpriteAnimationController('mostasa', true);
  assert.equal(legacyCtrl.getAnimationName(), 'idle');
  assert.equal(legacyCtrl.getCurrentFrame().frameIndex, 0);
  legacyCtrl.stepForward();
  assert.equal(legacyCtrl.getCurrentFrame().frameIndex, 1);

  legacyCtrl.setAnimation('lightPunch', true);
  assert.equal(legacyCtrl.getCurrentFrame().frameIndex, 8);
  legacyCtrl.stepForward();
  assert.equal(legacyCtrl.getCurrentFrame().frameIndex, 9);

  // HD 60Hz combat synchronization for startup -> active -> recovery
  const state = createInitialMatchState('mostasa', 'alien', true);
  state.p1.state = 'attacking';
  state.p1.currentAttack = 'hp';
  const hpMove = CHARACTERS.mostasa.moves.hp;

  state.p1.stateFrame = 0; // startup
  const startupFrame = resolveCombatSpriteFrame(state.p1);
  assert.equal(startupFrame.animationName, 'heavyPunch');
  assert.equal(startupFrame.frame.frameIndex, 0);

  state.p1.stateFrame = hpMove.startup; // active impact frame
  const activeFrame = resolveCombatSpriteFrame(state.p1);
  assert.ok(activeFrame.frame.frameIndex >= 1);
  assert.ok(getActiveHitbox(state.p1) !== null, 'Active hitbox must be present on impact frame');

  state.p1.stateFrame = hpMove.startup + hpMove.active + hpMove.recovery - 1; // recovery
  const recovFrame = resolveCombatSpriteFrame(state.p1);
  assert.ok(recovFrame.frame.frameIndex > activeFrame.frame.frameIndex);

  // Verify The Alien uses HD special1 clip for special attacks
  state.p2.state = 'special';
  state.p2.currentAttack = 'special1';
  state.p2.stateFrame = CHARACTERS.alien.moves.special1.startup;
  const alienResolved = resolveCombatSpriteFrame(state.p2);
  assert.equal(alienResolved.animationName, 'special1');
  assert.equal(alienResolved.frame.sourceType, 'HD_ATLAS');

  // Verify The Litlle Rag has smaller hurtboxes than Patova Marcelo
  const ragState = createInitialMatchState('rag', 'patova', true);
  const ragBoxes = getFighterHurtboxes(ragState.p1);
  const patovaBoxes = getFighterHurtboxes(ragState.p2);
  assert.ok(ragBoxes[0].height < patovaBoxes[0].height);
});

test('All 10 original 8-Bit Heavy Metal compositions exist with exact titles, BPMs, multi-section structures, and 4 virtual instruments', async () => {
  const { ALL_TRACK_IDS, METAL_SOUNDTRACK } = await import('./metalSongs');
  const { arcadeAudio } = await import('./audio');

  assert.equal(ALL_TRACK_IDS.length, 10);

  const expectedTracks: Record<string, { title: string; bpm: number }> = {
    menu: { title: "Metal Warriors '96", bpm: 145 },
    select: { title: 'Choose Your Destiny', bpm: 165 },
    mostasa: { title: 'The Mast Turbadour', bpm: 175 },
    braian: { title: 'Streets of Fury', bpm: 160 },
    rag: { title: 'Ragged Madness', bpm: 190 },
    patova: { title: 'No Entry Tonight', bpm: 130 },
    jenny: { title: 'Glamour of Steel', bpm: 155 },
    alien: { title: 'Cosmic Annihilation', bpm: 170 },
    victory: { title: 'Warriors Never Fall', bpm: 140 },
    gameover: { title: 'The Last Battle', bpm: 85 },
  };

  for (const id of ALL_TRACK_IDS) {
    const song = METAL_SOUNDTRACK[id];
    assert.ok(song, `Missing song definition for ${id}`);
    assert.equal(song.title, expectedTracks[id].title);
    assert.equal(song.bpm, expectedTracks[id].bpm);
    assert.ok(
      song.sections.length >= 2,
      `Song ${id} must have multiple musical sections`
    );
    assert.ok(
      song.totalSteps >= 64 && song.totalSteps % 16 === 0,
      `Song ${id} must have at least 4 bars (64 16th-note steps)`
    );

    let rhythmCount = 0;
    let leadCount = 0;
    let harmonyCount = 0;
    let bassCount = 0;
    let drumCount = 0;

    for (const step of song.steps) {
      if (step.rhythm) rhythmCount++;
      if (step.lead) leadCount++;
      if (step.harmony) harmonyCount++;
      if (step.bass) bassCount++;
      if (step.drums) drumCount++;
    }

    assert.ok(rhythmCount > 0, `Song ${id} must have Rhythm Guitar 8-Bit notes`);
    assert.ok(leadCount > 0, `Song ${id} must have Lead Guitar 8-Bit notes`);
    assert.ok(harmonyCount > 0, `Song ${id} must have Twin Harmony Guitar notes`);
    assert.ok(bassCount > 0, `Song ${id} must have Bass Guitar 8-Bit notes`);
    assert.ok(drumCount > 0, `Song ${id} must have Heavy Metal Drum 8-Bit hits`);
  }

  // Verify arcadeAudio transport & dynamic intensity state transitions
  arcadeAudio.playTrack('mostasa');
  const status1 = arcadeAudio.getPlaybackStatus();
  assert.equal(status1.currentTrackId, 'mostasa');
  assert.equal(status1.title, 'The Mast Turbadour');
  assert.equal(status1.bpm, 175);
  assert.equal(status1.isPlaying, true);

  arcadeAudio.setCriticalHealthMode(true);
  assert.equal(arcadeAudio.getPlaybackStatus().criticalHealthMode, true);

  arcadeAudio.pauseMusic();
  assert.equal(arcadeAudio.getPlaybackStatus().isPaused, true);

  arcadeAudio.resumeMusic();
  assert.equal(arcadeAudio.getPlaybackStatus().isPaused, false);

  arcadeAudio.stopMusic();
  assert.equal(arcadeAudio.getPlaybackStatus().isPlaying, false);
});

test('Official 1672x941 Title Screen and Main Menu PNG assets and slanted parallelogram hitboxes are pixel-aligned', async () => {
  const fs = await import('node:fs');
  const {
    UI_ASSETS,
    UI_IMAGE_WIDTH,
    UI_IMAGE_HEIGHT,
    MAIN_MENU_OPTIONS,
    hitTestTitleEnterButton,
    hitTestMainMenuOption,
    getMenuPanelLeftInnerX,
    getMenuPanelRightInnerX,
  } = await import('./menuOptions');

  assert.equal(UI_IMAGE_WIDTH, 1672);
  assert.equal(UI_IMAGE_HEIGHT, 941);

  for (const relUrl of Object.values(UI_ASSETS)) {
    const diskPath = `public${relUrl}`;
    assert.equal(fs.existsSync(diskPath), true, `Missing UI PNG asset: ${diskPath}`);
    const buf = fs.readFileSync(diskPath);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.equal(width, 1672, `${diskPath} width must be 1672`);
    assert.equal(height, 941, `${diskPath} height must be 941`);
  }

  // Verify exact 8 options in order
  assert.deepEqual(
    MAIN_MENU_OPTIONS.map((o) => o.label),
    [
      'MODO ARCADE',
      'MODO VERSUS',
      'VS CPU',
      'ENTRENAMIENTO',
      'OPCIONES',
      'CÓMO JUGAR',
      'SOUND TEST',
      'SALIR',
    ]
  );

  // Verify Title Screen ENTRAR button hit-test
  assert.equal(hitTestTitleEnterButton(0.495, 0.886), true);
  // Decorative character areas should NOT trigger ENTRAR
  assert.equal(hitTestTitleEnterButton(0.18, 0.45), false);
  assert.equal(hitTestTitleEnterButton(0.85, 0.45), false);

  // Verify Main Menu slanted parallelogram hit-test for all 8 rows
  for (const opt of MAIN_MENU_OPTIONS) {
    const midY = (opt.topY + opt.bottomY) / 2;
    const midX = (getMenuPanelLeftInnerX(midY) + getMenuPanelRightInnerX(midY)) / 2;
    const hitIndex = hitTestMainMenuOption(
      midX / UI_IMAGE_WIDTH,
      midY / UI_IMAGE_HEIGHT
    );
    assert.equal(hitIndex, opt.index, `Row ${opt.label} center must hit index ${opt.index}`);
  }

  // Decorative background fighters on left and right must NOT hit any menu option
  assert.equal(hitTestMainMenuOption(0.15, 0.5), -1);
  assert.equal(hitTestMainMenuOption(0.88, 0.5), -1);
});

test('All 6 official 1920x1080 combat stages and 4 parallax RGBA layer PNGs exist on disk and match stageCharacterMap', async () => {
  const fs = await import('node:fs');
  const { STAGE_REGISTRY, stageCharacterMap } = await import('./stageData');

  assert.equal(stageCharacterMap.mostasa, 'metal_fight_club');
  assert.equal(stageCharacterMap.el_braian, 'barrio_bravo');
  assert.equal(stageCharacterMap.the_litlle_rag, 'rags_nightmare');
  assert.equal(stageCharacterMap.patova_marcelo, 'no_entry_club');
  assert.equal(stageCharacterMap.jenny_el_travesano, 'glamour_arena');
  assert.equal(stageCharacterMap.the_alien, 'area_51_mothership');

  const expectedStages: Record<
    string,
    { slug: string; name: string; musicTitle: string }
  > = {
    mostasa: {
      slug: 'metal_fight_club',
      name: 'METAL FIGHT CLUB',
      musicTitle: 'The Mast Turbadour',
    },
    braian: {
      slug: 'barrio_bravo',
      name: 'BARRIO BRAVO',
      musicTitle: 'Streets of Fury',
    },
    rag: {
      slug: 'rags_nightmare',
      name: "RAG'S NIGHTMARE",
      musicTitle: 'Ragged Madness',
    },
    patova: {
      slug: 'no_entry_club',
      name: 'NO ENTRY CLUB',
      musicTitle: 'No Entry Tonight',
    },
    jenny: {
      slug: 'glamour_arena',
      name: 'GLAMOUR ARENA',
      musicTitle: 'Glamour of Steel',
    },
    alien: {
      slug: 'area_51_mothership',
      name: 'AREA 51: MOTHERSHIP',
      musicTitle: 'Cosmic Annihilation',
    },
  };

  for (const id of CHARACTER_ORDER) {
    const reg = STAGE_REGISTRY[id];
    const exp = expectedStages[id];
    assert.ok(reg, `Missing stage registry entry for ${id}`);
    assert.equal(reg.id, exp.slug);
    assert.equal(reg.name, exp.name);
    assert.equal(CHARACTERS[id].stage.name, exp.name);
    assert.equal(reg.musicTitle, exp.musicTitle);
    assert.equal(reg.floorY, 468);
    assert.equal(reg.backgroundLayers.length, 4);
    assert.ok(reg.ambientEffects.length >= 4);

    // Check 1920x1080 background.png + 4 layer PNGs on disk
    const allFiles = [reg.backgroundUrl, ...reg.backgroundLayers];
    for (const relUrl of allFiles) {
      const diskPath = `public${relUrl}`;
      assert.equal(
        fs.existsSync(diskPath),
        true,
        `Missing stage PNG file: ${diskPath}`
      );
      const buf = fs.readFileSync(diskPath);
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      assert.equal(width, 1920, `${diskPath} width must be 1920`);
      assert.equal(height, 1080, `${diskPath} height must be 1080`);
    }
  }
});

test('CharacterSelectController 2.0: 1672x941 reference/clean plates, 6 portraits, Section 9 stats, Section 10 characteristics, and 3x2 grid navigation', async () => {
  const fs = await import('node:fs');
  const {
    CHARACTER_SELECT_2_0_ASSETS,
    CHARACTER_SELECT_2_0_LAYOUT,
    CHARACTER_SELECT_METADATA,
    createInitialCharacterSelectState,
    moveSelectionInGrid,
    movePlayerCursor,
    confirmPlayerSlot,
    cancelPlayerSlot,
    isCharacterSelectReady,
  } = await import('./characterSelectController');

  // Verify official 1672x941 reference image and clean background plate exist on disk
  for (const relPath of [
    CHARACTER_SELECT_2_0_ASSETS.referenceImage,
    CHARACTER_SELECT_2_0_ASSETS.cleanBackground,
  ]) {
    const diskPath = `public${relPath}`;
    assert.equal(fs.existsSync(diskPath), true, `Missing ${diskPath}`);
    const buf = fs.readFileSync(diskPath);
    assert.equal(buf.readUInt32BE(16), 1672, `${diskPath} width must be 1672`);
    assert.equal(buf.readUInt32BE(20), 941, `${diskPath} height must be 941`);
  }

  // Verify all 6 extracted portrait cards exist on disk and match grid layout order
  assert.deepEqual(
    CHARACTER_SELECT_2_0_LAYOUT.gridCells.map((c) => c.characterId),
    ['mostasa', 'braian', 'rag', 'patova', 'jenny', 'alien']
  );
  for (const id of CHARACTER_ORDER) {
    const portraitDisk = `public${CHARACTER_SELECT_2_0_ASSETS.portraits[id]}`;
    assert.equal(
      fs.existsSync(portraitDisk),
      true,
      `Missing portrait card ${portraitDisk}`
    );
  }

  // Verify all 6 characters have exact titles, subtitles, Section 9 stats, and 3 Section 10 characteristics
  assert.equal(CHARACTER_SELECT_METADATA.mostasa.subtitle, 'THE MAST TURBADOUR');
  assert.equal(CHARACTER_SELECT_METADATA.braian.subtitle, 'EL REY DEL CONURBANO');
  assert.equal(CHARACTER_SELECT_METADATA.rag.subtitle, 'MUÑECO DE TRAPO POSEÍDO');
  assert.equal(CHARACTER_SELECT_METADATA.patova.subtitle, 'EL PORTERO IMPLACABLE');
  assert.equal(CHARACTER_SELECT_METADATA.jenny.subtitle, 'LA REINA DE LA NOCHE');
  assert.equal(CHARACTER_SELECT_METADATA.alien.subtitle, 'INVASOR INTERGALÁCTICO');

  // Section 9 exact stats check
  assert.deepEqual(CHARACTER_SELECT_METADATA.mostasa.stats, {
    strength: 8,
    speed: 6,
    defense: 7,
    reach: 6,
    technique: 8,
  });
  assert.deepEqual(CHARACTER_SELECT_METADATA.braian.stats, {
    strength: 5,
    speed: 10,
    defense: 4,
    reach: 6,
    technique: 8,
  });
  assert.deepEqual(CHARACTER_SELECT_METADATA.rag.stats, {
    strength: 4,
    speed: 10,
    defense: 4,
    reach: 5,
    technique: 9,
  });
  assert.deepEqual(CHARACTER_SELECT_METADATA.patova.stats, {
    strength: 10,
    speed: 3,
    defense: 10,
    reach: 7,
    technique: 5,
  });
  assert.deepEqual(CHARACTER_SELECT_METADATA.jenny.stats, {
    strength: 7,
    speed: 8,
    defense: 6,
    reach: 9,
    technique: 8,
  });
  assert.deepEqual(CHARACTER_SELECT_METADATA.alien.stats, {
    strength: 6,
    speed: 7,
    defense: 5,
    reach: 10,
    technique: 9,
  });

  // Section 10 exact 3 characteristics per fighter check
  for (const id of CHARACTER_ORDER) {
    assert.equal(
      CHARACTER_SELECT_METADATA[id].characteristics.length,
      3,
      `${id} must have 3 characteristics`
    );
  }
  assert.equal(CHARACTER_SELECT_METADATA.mostasa.characteristics[0].title, 'Equilibrado');
  assert.equal(CHARACTER_SELECT_METADATA.braian.characteristics[0].title, 'Velocidad');
  assert.equal(CHARACTER_SELECT_METADATA.rag.characteristics[0].title, 'Impredecible');
  assert.equal(CHARACTER_SELECT_METADATA.patova.characteristics[0].title, 'Fuerza bruta');
  assert.equal(CHARACTER_SELECT_METADATA.jenny.characteristics[0].title, 'Alcance');
  assert.equal(CHARACTER_SELECT_METADATA.alien.characteristics[0].title, 'Energía');

  // 3x2 grid navigation wrap-around
  // Row 0: mostasa (0), braian (1), rag (2)
  // Row 1: patova (3), jenny (4), alien (5)
  assert.equal(moveSelectionInGrid('mostasa', 1, 0).characterId, 'braian');
  assert.equal(moveSelectionInGrid('mostasa', -1, 0).characterId, 'rag');
  assert.equal(moveSelectionInGrid('mostasa', 0, 1).characterId, 'patova');
  assert.equal(moveSelectionInGrid('jenny', 1, 0).characterId, 'alien');
  assert.equal(moveSelectionInGrid('alien', 1, 0).characterId, 'patova');

  // Arcade mode: confirming P1 automatically locks CPU opponent and readies match
  let arcadeState = createInitialCharacterSelectState('arcade', 'mostasa', 'patova');
  assert.equal(isCharacterSelectReady(arcadeState), false);
  arcadeState = movePlayerCursor(arcadeState, 1, 1, 0); // braian
  assert.equal(arcadeState.player1.characterId, 'braian');
  arcadeState = confirmPlayerSlot(arcadeState, 1);
  assert.equal(arcadeState.player1.confirmed, true);
  assert.equal(arcadeState.player2.confirmed, true);
  assert.equal(isCharacterSelectReady(arcadeState), true);

  // Cancel unlocks P1 in arcade mode
  arcadeState = cancelPlayerSlot(arcadeState, 1);
  assert.equal(arcadeState.player1.confirmed, false);
  assert.equal(isCharacterSelectReady(arcadeState), false);

  // Versus mode: P1 and P2 navigate and confirm independently
  let versusState = createInitialCharacterSelectState('versus', 'mostasa', 'patova');
  assert.equal(versusState.player2.isCPU, false);
  versusState = movePlayerCursor(versusState, 1, 2, 0); // rag
  versusState = movePlayerCursor(versusState, 2, 2, 0); // alien
  assert.equal(versusState.player1.characterId, 'rag');
  assert.equal(versusState.player2.characterId, 'alien');

  versusState = confirmPlayerSlot(versusState, 1);
  assert.equal(versusState.player1.confirmed, true);
  assert.equal(versusState.player2.confirmed, false);
  assert.equal(isCharacterSelectReady(versusState), false);

  // Locked P1 cursor does not move while P2 still moves freely
  versusState = movePlayerCursor(versusState, 1, 1, 0);
  assert.equal(versusState.player1.characterId, 'rag');
  versusState = movePlayerCursor(versusState, 2, -1, 0); // jenny
  assert.equal(versusState.player2.characterId, 'jenny');

  versusState = confirmPlayerSlot(versusState, 2);
  assert.equal(isCharacterSelectReady(versusState), true);
});

test('Combat Animation System 2.0: 6 HD Atlases (1536x1024), animations.json, preserved 1254x1254 backups, 25 HD clips, and 60Hz state resolution', async () => {
  const fs = await import('node:fs');
  const { HD_ATLAS_MANIFESTS } = await import('./hdAtlasData');
  const {
    ALL_25_HD_ANIMATION_STATES,
    SpriteAnimationController,
    resolveCombatSpriteFrame,
  } = await import('./spriteEngine');

  assert.equal(ALL_25_HD_ANIMATION_STATES.length, 25);

  let totalFramesAcrossAllFighters = 0;

  for (const id of CHARACTER_ORDER) {
    const manifest = HD_ATLAS_MANIFESTS[id];
    assert.ok(manifest, `Missing HD manifest for ${id}`);
    assert.equal(manifest.atlasWidth, 1536);
    assert.equal(manifest.atlasHeight, 1024);
    assert.ok(manifest.totalExtractedFrames >= 80, `${id} should have >=80 HD frames`);
    totalFramesAcrossAllFighters += manifest.totalExtractedFrames;

    // 1. Verify new 1536x1024 atlas_hd.png exists on disk
    const hdDiskPath = `public${manifest.atlasPath}`;
    assert.equal(fs.existsSync(hdDiskPath), true, `Missing HD atlas: ${hdDiskPath}`);
    const hdBuf = fs.readFileSync(hdDiskPath);
    assert.equal(hdBuf.readUInt32BE(16), 1536, `${hdDiskPath} width must be 1536`);
    assert.equal(hdBuf.readUInt32BE(20), 1024, `${hdDiskPath} height must be 1024`);

    // 2. Verify preserved 1254x1254 spritesheet.png backup still exists on disk
    const backupDiskPath = `public${manifest.fallbackSheetPath}`;
    assert.equal(
      fs.existsSync(backupDiskPath),
      true,
      `Original backup spritesheet.png must be preserved: ${backupDiskPath}`
    );
    const backupBuf = fs.readFileSync(backupDiskPath);
    assert.equal(backupBuf.readUInt32BE(16), 1254);
    assert.equal(backupBuf.readUInt32BE(20), 1254);

    // 3. Verify animations.json exists on disk in the same directory
    const jsonDiskPath = hdDiskPath.replace('atlas_hd.png', 'animations.json');
    assert.equal(fs.existsSync(jsonDiskPath), true, `Missing ${jsonDiskPath}`);

    // 4. Verify all 25 animation states exist and have valid non-empty frames
    const hdCtrl = new SpriteAnimationController(id, false);
    const legCtrl = new SpriteAnimationController(id, true);

    for (const st of ALL_25_HD_ANIMATION_STATES) {
      const clip = manifest.clips[st.id];
      assert.ok(clip, `Missing clip ${st.id} for ${id}`);
      assert.ok(clip.frames.length >= 1, `Empty clip ${st.id} for ${id}`);

      hdCtrl.setAnimation(st.id, true);
      const f = hdCtrl.getCurrentFrame();
      assert.equal(f.sourceType, 'HD_ATLAS');
      assert.ok(f.sourceWidth > 10 && f.sourceHeight > 10);
      assert.ok(f.anchorX > 0 && f.footY > 0);
      hdCtrl.stepForward();
      hdCtrl.update(120);

      // Verify legacy fallback controller also supports all 25 states
      legCtrl.setAnimation(st.id, true);
      const lf = legCtrl.getCurrentFrame();
      assert.equal(lf.sourceType, 'LEGACY_FALLBACK');
    }

    // 5. Verify 60Hz resolveCombatSpriteFrame across all FighterRuntime states
    const fighter = createInitialMatchState(id, 'patova', true).p1;
    const statesToTest = [
      'idle',
      'walking',
      'jumping',
      'crouching',
      'blocking',
      'attacking',
      'special',
      'super',
      'hitstun',
      'knockdown',
      'recovering',
      'defeated',
      'victory',
    ] as const;

    for (const fState of statesToTest) {
      fighter.state = fState;
      fighter.hitstunFrames = 18;
      fighter.knockdownFrames = 24;
      fighter.currentAttack =
        fState === 'super'
          ? 'super'
          : fState === 'special'
            ? 'special1'
            : 'hp';
      for (const tVal of [0, 4, 10, 18]) {
        fighter.stateFrame = tVal;
        const resolved = resolveCombatSpriteFrame(fighter);
        assert.equal(resolved.frame.sourceType, 'HD_ATLAS');
        assert.ok(
          !Number.isNaN(resolved.frame.sourceX) &&
            !Number.isNaN(resolved.frame.sourceY) &&
            resolved.frame.sourceWidth > 0 &&
            resolved.frame.sourceHeight > 0
        );
      }
    }
  }

  assert.equal(totalFramesAcrossAllFighters, 547);
  // Verify height hierarchy: Patova Marcelo (1.82x) > Rag (1.32x)
  assert.ok(
    HD_ATLAS_MANIFESTS.patova.uniformScale540p >
      HD_ATLAS_MANIFESTS.rag.uniformScale540p
  );
});

test('Combat System 3.0: 4-Volume Collision System (Pushbox, Anatomical Hurtboxes, Active Hitbox, Throw Range)', async () => {
  const {
    getFighterPushbox,
    getFighterThrowBox,
    getFighterHurtboxes,
    getActiveHitbox,
    computeContactPoint,
  } = await import('./rules');

  const state = createInitialMatchState('mostasa', 'patova', false);
  const p1 = state.p1;
  const p2 = state.p2;

  // 1. Pushbox volume
  const push1 = getFighterPushbox(p1);
  assert.ok(push1.width > 40 && push1.height > 100);

  // 2. Throw range volume
  const throw1 = getFighterThrowBox(p1);
  assert.ok(throw1.width >= 60 && throw1.height >= 100);

  // 3. Anatomical Hurtboxes (standing has torso + head + legs = 3 boxes; attacking adds extended limb = 4 boxes)
  const idleHurtboxes = getFighterHurtboxes(p1);
  assert.equal(idleHurtboxes.length, 3);

  p1.state = 'attacking';
  p1.currentAttack = 'hp';
  p1.stateFrame = CHARACTERS.mostasa.moves.hp.startup; // active frame
  const activeHurtboxes = getFighterHurtboxes(p1);
  assert.equal(
    activeHurtboxes.length,
    4,
    'Attacking fighter must expose an extended limb hurtbox during active/recovery frames'
  );

  // 4. Active Hitbox and Contact Point computation
  const activeHitbox = getActiveHitbox(p1);
  assert.ok(activeHitbox !== null);
  const contact = computeContactPoint(activeHitbox, getFighterHurtboxes(p2));
  assert.ok(!Number.isNaN(contact.x) && !Number.isNaN(contact.y));
});

test('Combat System 3.0: Section 4 Hitstop Table, Section 6 Damage Scaling Table, and Hitstop Input Buffering', async () => {
  const { getComboScalingMultiplier } = await import('./rules');

  // Verify exact Section 4 Hitstop values on base moves
  const moves = CHARACTERS.mostasa.moves;
  assert.equal(moves.lp.hitstop, 4);
  assert.equal(moves.lk.hitstop, 5);
  assert.equal(moves.hp.hitstop, 8);
  assert.equal(moves.hk.hitstop, 9);
  assert.equal(moves.special2.hitstop, 10);
  assert.equal(moves.super.hitstop, 14);

  // Verify exact Section 6 Damage Scaling Table:
  // Hit 1: 100%, Hit 2: 95%, Hit 3: 90%, Hit 4: 80%, Hit 5: 70%, Hit 6: 60%, Hit 7+: 50%
  assert.equal(getComboScalingMultiplier(1), 1.0);
  assert.equal(getComboScalingMultiplier(2), 0.95);
  assert.equal(getComboScalingMultiplier(3), 0.9);
  assert.equal(getComboScalingMultiplier(4), 0.8);
  assert.equal(getComboScalingMultiplier(5), 0.7);
  assert.equal(getComboScalingMultiplier(6), 0.6);
  assert.equal(getComboScalingMultiplier(7), 0.5);
  assert.equal(getComboScalingMultiplier(10), 0.5);

  // Verify calculateDamage scales properly across combo hits and Counter Hits
  const normalHit1 = calculateDamage(100, 'mostasa', 'patova', 0, false);
  const normalHit2 = calculateDamage(100, 'mostasa', 'patova', 1, false);
  const normalHit4 = calculateDamage(100, 'mostasa', 'patova', 3, false);
  const counterHit1 = calculateDamage(100, 'mostasa', 'patova', 0, true);
  assert.ok(normalHit1 > normalHit2);
  assert.ok(normalHit2 > normalHit4);
  assert.ok(counterHit1 > normalHit1, 'Counter Hit must deal 15% bonus damage');

  // Verify inputs pressed during hitstop are buffered and execute on the first frame after hitstop ends
  const state = createInitialMatchState('mostasa', 'patova', false);
  state.roundPhase = 'fighting';
  state.p1.x = 500;
  state.p2.x = 558;

  // P1 lands LP
  const lpIn = createEmptyInputSnapshot();
  lpIn.justPressed.lp = true;
  stepMatchSimulation(state, lpIn, createEmptyInputSnapshot(), 2);

  // Step until LP hits and triggers hitstopFrames > 0
  for (let i = 0; i < 6; i++) {
    if (state.hitstopFrames > 0) break;
    stepMatchSimulation(
      state,
      createEmptyInputSnapshot(),
      createEmptyInputSnapshot(),
      2
    );
  }
  assert.ok(state.hitstopFrames > 0, 'LP impact must trigger hitstopFrames');

  // Press HP DURING hitstop!
  const hpDuringHitstop = createEmptyInputSnapshot();
  hpDuringHitstop.hp = true;
  hpDuringHitstop.justPressed.hp = true;
  stepMatchSimulation(
    state,
    hpDuringHitstop,
    createEmptyInputSnapshot(),
    2
  );

  // Advance remaining hitstop frames with empty inputs: buffered HP should automatically chain!
  for (let i = 0; i < 6; i++) {
    stepMatchSimulation(
      state,
      createEmptyInputSnapshot(),
      createEmptyInputSnapshot(),
      2
    );
  }
  assert.equal(
    state.p1.currentAttack,
    'hp',
    'HP pressed during hitstop must be buffered and chain-cancel LP once hitstop ends'
  );
});

test('Combat System 3.0: Overhead vs Low Blocking, COUNTER HIT!, PUNISH!, THROW TECH!, and Double-Tap Dash', async () => {
  const { detectDashDirection } = await import('./rules');

  // 1. High/Low/Overhead guard rules
  const state = createInitialMatchState('mostasa', 'patova', false);
  const defender = state.p2; // facing -1, so right = hold back
  const crouchBlock = createEmptyInputSnapshot();
  crouchBlock.right = true;
  crouchBlock.down = true;

  // Jumping overhead ('high') beats crouch block!
  assert.equal(
    canBlockAttack(defender, crouchBlock, 'high'),
    false,
    'Jumping overhead (high) must hit crouching blockers'
  );
  // Standing mid attack is blocked by both standing and crouching guard
  assert.equal(canBlockAttack(defender, crouchBlock, 'mid'), true);

  // 2. Double-Tap Dash recognition (F, N, F) and Backdash (B, N, B)
  const p1 = state.p1; // facing +1 (right)
  p1.inputBuffer = [
    { frame: 1, dir: 'F', lp: false, hp: false, lk: false, hk: false },
    { frame: 3, dir: 'N', lp: false, hp: false, lk: false, hk: false },
    { frame: 5, dir: 'F', lp: false, hp: false, lk: false, hk: false },
  ];
  const fwdTap = createEmptyInputSnapshot();
  fwdTap.right = true;
  fwdTap.justPressed.right = true;
  assert.equal(detectDashDirection(p1, fwdTap), 1);

  p1.inputBuffer = [
    { frame: 1, dir: 'B', lp: false, hp: false, lk: false, hk: false },
    { frame: 3, dir: 'N', lp: false, hp: false, lk: false, hk: false },
    { frame: 5, dir: 'B', lp: false, hp: false, lk: false, hk: false },
  ];
  const backTap = createEmptyInputSnapshot();
  backTap.left = true;
  backTap.justPressed.left = true;
  assert.equal(detectDashDirection(p1, backTap), -1);

  // 3. COUNTER HIT! when interrupting opponent's attack startup
  const chState = createInitialMatchState('mostasa', 'patova', false);
  chState.roundPhase = 'fighting';
  chState.p1.x = 500;
  chState.p2.x = 560;
  // Put P2 in startup of a slow heavy attack
  chState.p2.state = 'attacking';
  chState.p2.currentAttack = 'hk';
  chState.p2.stateFrame = 1;
  // Put P1 on active frame of LP
  chState.p1.state = 'attacking';
  chState.p1.currentAttack = 'lp';
  chState.p1.stateFrame = CHARACTERS.mostasa.moves.lp.startup - 1;

  stepMatchSimulation(
    chState,
    createEmptyInputSnapshot(),
    createEmptyInputSnapshot(),
    2
  );
  assert.equal(chState.lastHitEvent?.isCounter, true);
  assert.equal(chState.combatCallout?.text, 'COUNTER HIT!');
  assert.equal(chState.p2.hitReaction, 'counter');

  // 4. PUNISH! when hitting opponent during whiff recovery frames
  const punState = createInitialMatchState('mostasa', 'patova', false);
  punState.roundPhase = 'fighting';
  punState.p1.x = 500;
  punState.p2.x = 560;
  punState.p2.state = 'attacking';
  punState.p2.currentAttack = 'hp';
  punState.p2.stateFrame =
    CHARACTERS.patova.moves.hp.startup + CHARACTERS.patova.moves.hp.active + 2; // in recovery
  punState.p1.state = 'attacking';
  punState.p1.currentAttack = 'lp';
  punState.p1.stateFrame = CHARACTERS.mostasa.moves.lp.startup - 1;

  stepMatchSimulation(
    punState,
    createEmptyInputSnapshot(),
    createEmptyInputSnapshot(),
    2
  );
  assert.equal(punState.lastHitEvent?.isPunish, true);
  assert.equal(punState.combatCallout?.text, 'PUNISH!');

  // 5. THROW TECH! when both players input throw/LP+LK in close range
  const techState = createInitialMatchState('mostasa', 'patova', false);
  techState.roundPhase = 'fighting';
  techState.p1.x = 500;
  techState.p2.x = 555;
  techState.p1.state = 'attacking';
  techState.p1.currentAttack = 'grab';
  techState.p1.stateFrame = CHARACTERS.mostasa.moves.grab.startup - 1;

  const p2TechInput = createEmptyInputSnapshot();
  p2TechInput.grab = true;
  p2TechInput.justPressed.grab = true;

  stepMatchSimulation(techState, createEmptyInputSnapshot(), p2TechInput, 2);
  assert.equal(techState.combatCallout?.text, 'THROW TECH!');
  assert.equal(techState.p2.hp, 1000, 'Throw Tech must negate throw damage');
});







