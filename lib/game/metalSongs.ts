import { CharacterId } from './types';

export type TrackId =
  | 'menu'
  | 'select'
  | 'mostasa'
  | 'braian'
  | 'rag'
  | 'patova'
  | 'jenny'
  | 'alien'
  | 'victory'
  | 'gameover';

export const ALL_TRACK_IDS: TrackId[] = [
  'menu',
  'select',
  'mostasa',
  'braian',
  'rag',
  'patova',
  'jenny',
  'alien',
  'victory',
  'gameover',
];

export interface RhythmNoteEvent {
  midi: number;
  durationSteps: number;
  palmMute: boolean;
  powerFifth: boolean;
}

export interface LeadNoteEvent {
  midi: number;
  durationSteps: number;
  vibrato: boolean;
  slideFromMidi?: number;
  duty: '12.5' | '25' | '50';
}

export interface BassNoteEvent {
  midi: number;
  durationSteps: number;
  accent: boolean;
}

export interface DrumStepEvent {
  kick?: boolean;
  snare?: boolean;
  hatC?: boolean;
  hatO?: boolean;
  crash?: boolean;
  tom?: 'H' | 'M' | 'L';
}

export interface MetalStepEvent {
  stepIndex: number;
  barIndex: number;
  stepInBar: number; // 0..15
  sectionName: string;
  rhythm: RhythmNoteEvent | null;
  lead: LeadNoteEvent | null;
  harmony: LeadNoteEvent | null;
  bass: BassNoteEvent | null;
  drums: DrumStepEvent;
}

export type RiffStyle =
  | 'gallop'
  | 'thrash_16th'
  | 'syncopated_street'
  | 'heavy_stomp'
  | 'glam_bounce'
  | 'space_arp'
  | 'power_sustained'
  | 'ballad_arp';

export type DrumStyle =
  | 'driving_8th'
  | 'double_bass'
  | 'gallop_lock'
  | 'heavy_halftime'
  | 'speed_thrash'
  | 'ballad_slow';

export interface SectionBlueprint {
  name: string;
  bars: number;
  chordDegrees: number[]; // Scale degree per bar (0-indexed: 0=I, 2=III, 3=IV, 4=V, 5=VI, 6=VII)
  riffStyle: RiffStyle;
  drumStyle: DrumStyle;
  hasTwinHarmony: boolean;
  isSolo?: boolean;
  melodyPattern: (number | null)[]; // 16 steps per bar (or 32 steps over 2 bars), scale degree offset from root (null = rest, -99 = hold)
}

export interface MetalSongDefinition {
  id: TrackId;
  trackNumber: string;
  title: string;
  subtitle: string;
  style: string;
  bpm: number;
  rootMidi: number; // e.g., 40 = E2, 45 = A2, 38 = D2, 47 = B2, 37 = C#2, 42 = F#2
  keySignature: string;
  scaleIntervals: number[];
  loop: boolean;
  totalBars: number;
  totalSteps: number;
  approxDurationSeconds: number;
  sections: SectionBlueprint[];
  steps: MetalStepEvent[];
}

const SCALES = {
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dorianGlam: [0, 2, 3, 5, 7, 9, 10],
};

function degreeToMidi(
  rootMidi: number,
  scale: number[],
  degree: number,
  octaveOffset = 0
): number {
  const len = scale.length;
  const oct = Math.floor(degree / len) + octaveOffset;
  const idx = ((degree % len) + len) % len;
  return rootMidi + oct * 12 + scale[idx];
}

function buildSongSteps(
  rootMidi: number,
  scale: number[],
  sections: SectionBlueprint[]
): { steps: MetalStepEvent[]; totalBars: number } {
  const steps: MetalStepEvent[] = [];
  let globalBar = 0;

  for (const sec of sections) {
    for (let b = 0; b < sec.bars; b++) {
      const chordDeg = sec.chordDegrees[b % sec.chordDegrees.length];
      const chordRootRhythm = degreeToMidi(rootMidi, scale, chordDeg, 0);
      const chordRootBass = degreeToMidi(rootMidi, scale, chordDeg, -1);
      const isLastBarOfSection = b === sec.bars - 1;
      const isFirstStepOfSection = b === 0;

      for (let s = 0; s < 16; s++) {
        const stepIdx = steps.length;
        let rhythm: RhythmNoteEvent | null = null;
        let bass: BassNoteEvent | null = null;
        let lead: LeadNoteEvent | null = null;
        let harmony: LeadNoteEvent | null = null;
        const drums: DrumStepEvent = {};

        // 1. RHYTHM GUITAR & BASS PATTERN GENERATION
        if (sec.riffStyle === 'gallop') {
          // Classic Iron Maiden / Helloween E-E-E gallop: 8th (0) + 16th (2) + 16th (3)
          const pos = s % 4;
          if (pos === 0) {
            const isAccent = s === 0 || s === 8;
            rhythm = {
              midi: isAccent
                ? chordRootRhythm
                : degreeToMidi(rootMidi, scale, chordDeg + (s === 12 ? 2 : 0), 0),
              durationSteps: 2,
              palmMute: !isAccent,
              powerFifth: true,
            };
            bass = {
              midi: chordRootBass,
              durationSteps: 2,
              accent: isAccent,
            };
          } else if (pos === 2 || pos === 3) {
            rhythm = {
              midi: chordRootRhythm,
              durationSteps: 1,
              palmMute: true,
              powerFifth: false,
            };
            bass = {
              midi:
                pos === 3 && s === 15
                  ? degreeToMidi(rootMidi, scale, chordDeg + 1, -1)
                  : chordRootBass,
              durationSteps: 1,
              accent: false,
            };
          }
        } else if (sec.riffStyle === 'thrash_16th') {
          // Speed metal 16th-note pedal-point riff
          const isChordHit = s === 0 || s === 6 || s === 12;
          const riffDeg =
            s === 14
              ? chordDeg + 4
              : s === 15
                ? chordDeg + 3
                : isChordHit
                  ? chordDeg + (s === 6 ? 1 : 0)
                  : chordDeg;
          rhythm = {
            midi: degreeToMidi(rootMidi, scale, riffDeg, 0),
            durationSteps: isChordHit ? 2 : 1,
            palmMute: !isChordHit,
            powerFifth: isChordHit,
          };
          if (s % 2 === 0 || s >= 12) {
            bass = {
              midi: degreeToMidi(rootMidi, scale, riffDeg, -1),
              durationSteps: 1,
              accent: isChordHit,
            };
          }
        } else if (sec.riffStyle === 'syncopated_street') {
          // Accept / Megadeth syncopated street metal riff
          const hitSteps = [0, 2, 3, 6, 8, 10, 11, 14];
          if (hitSteps.includes(s)) {
            const accentSteps = [0, 6, 11, 14];
            const isAcc = accentSteps.includes(s);
            const degOffset = s === 6 ? 3 : s === 14 ? 4 : 0;
            rhythm = {
              midi: degreeToMidi(rootMidi, scale, chordDeg + degOffset, 0),
              durationSteps: isAcc ? 2 : 1,
              palmMute: !isAcc,
              powerFifth: isAcc,
            };
            bass = {
              midi: degreeToMidi(rootMidi, scale, chordDeg + degOffset, -1),
              durationSteps: isAcc ? 2 : 1,
              accent: isAcc,
            };
          }
        } else if (sec.riffStyle === 'heavy_stomp') {
          // Crushing Judas Priest / Dio heavy mid-tempo stomp
          if (s === 0 || s === 3 || s === 6 || s === 8 || s === 12 || s === 14) {
            const isHeavySlam = s === 0 || s === 6 || s === 12;
            const degOffset = s === 6 ? 1 : s === 14 ? 4 : 0;
            rhythm = {
              midi: degreeToMidi(rootMidi, scale, chordDeg + degOffset, 0),
              durationSteps: isHeavySlam ? 3 : 2,
              palmMute: !isHeavySlam,
              powerFifth: true,
            };
            bass = {
              midi: degreeToMidi(rootMidi, scale, chordDeg + degOffset, -1),
              durationSteps: isHeavySlam ? 3 : 2,
              accent: isHeavySlam,
            };
          }
        } else if (sec.riffStyle === 'glam_bounce') {
          // 1980s Glam Metal arena riff (pedal root + bright dyad stabs)
          if (s % 2 === 0) {
            const isDyad = s === 4 || s === 10 || s === 14;
            const deg = isDyad ? chordDeg + 2 : chordDeg;
            rhythm = {
              midi: degreeToMidi(rootMidi, scale, deg, 0),
              durationSteps: 2,
              palmMute: !isDyad && s !== 0,
              powerFifth: true,
            };
            bass = {
              midi: degreeToMidi(
                rootMidi,
                scale,
                s === 14 ? chordDeg + 4 : chordDeg,
                -1
              ),
              durationSteps: 2,
              accent: s === 0 || isDyad,
            };
          }
        } else if (sec.riffStyle === 'space_arp') {
          // Exotic futuristic heavy metal arpeggio + low chug
          const arpOffsets = [0, 4, 7, 4, 0, 5, 8, 5, 0, 4, 7, 11, 7, 4, 2, 1];
          const deg = chordDeg + arpOffsets[s];
          rhythm = {
            midi: degreeToMidi(rootMidi, scale, deg, 0),
            durationSteps: 1,
            palmMute: s % 4 === 0,
            powerFifth: s % 4 === 0,
          };
          if (s % 2 === 0) {
            bass = {
              midi: chordRootBass,
              durationSteps: 2,
              accent: s % 8 === 0,
            };
          }
        } else if (sec.riffStyle === 'power_sustained') {
          // Sustained epic chorus power chords + driving 8th-note bass
          if (s === 0 || s === 8) {
            rhythm = {
              midi: chordRootRhythm,
              durationSteps: 8,
              palmMute: false,
              powerFifth: true,
            };
          }
          if (s % 2 === 0) {
            bass = {
              midi:
                s === 14
                  ? degreeToMidi(rootMidi, scale, chordDeg + 4, -1)
                  : chordRootBass,
              durationSteps: 2,
              accent: s % 4 === 0,
            };
          }
        } else if (sec.riffStyle === 'ballad_arp') {
          // Melancholic 8-bit metal power ballad arpeggio
          const balladSteps = [0, 2, 4, 6, 8, 10, 12, 14];
          const balladDegs = [0, 2, 4, 7, 4, 2, 3, 2];
          const idx = balladSteps.indexOf(s);
          if (idx !== -1) {
            rhythm = {
              midi: degreeToMidi(
                rootMidi,
                scale,
                chordDeg + balladDegs[idx],
                0
              ),
              durationSteps: 2,
              palmMute: false,
              powerFifth: idx === 0,
            };
          }
          if (s === 0 || s === 8) {
            bass = {
              midi: chordRootBass,
              durationSteps: 8,
              accent: s === 0,
            };
          }
        }

        // 2. LEAD GUITAR & TWIN HARMONY (3RDS / 6THS)
        const patLen = sec.melodyPattern.length;
        if (patLen > 0) {
          const patIdx = (b * 16 + s) % patLen;
          const melDeg = sec.melodyPattern[patIdx];
          if (melDeg !== null && melDeg !== -99) {
            // Count how many consecutive -99 hold steps follow
            let hold = 1;
            while (
              hold < 16 &&
              sec.melodyPattern[(patIdx + hold) % patLen] === -99
            ) {
              hold++;
            }
            const actualDeg = melDeg + (b % 2 === 1 && sec.isSolo ? 2 : 0);
            const leadMidi = degreeToMidi(rootMidi, scale, actualDeg, 2);
            const prevMidi =
              sec.isSolo && s % 4 === 0
                ? degreeToMidi(rootMidi, scale, actualDeg - 1, 2)
                : undefined;

            lead = {
              midi: leadMidi,
              durationSteps: hold,
              vibrato: hold >= 3 || Boolean(sec.isSolo && s % 4 === 2),
              slideFromMidi: prevMidi,
              duty: sec.isSolo ? '12.5' : '25',
            };

            if (sec.hasTwinHarmony) {
              // Diatonic 3rd above (or 6th below on very high notes)
              const harmDeg = actualDeg >= 10 ? actualDeg - 5 : actualDeg + 2;
              harmony = {
                midi: degreeToMidi(rootMidi, scale, harmDeg, 2),
                durationSteps: hold,
                vibrato: hold >= 3,
                duty: '50',
              };
            }
          }
        }

        // 3. HEAVY METAL DRUM KIT & FILLS
        if (isFirstStepOfSection && s === 0) {
          drums.crash = true;
        }

        if (isLastBarOfSection && s >= 8) {
          // Explosive heavy metal drum fill at the end of every section!
          if (s === 8 || s === 9) {
            drums.snare = true;
            drums.kick = true;
          } else if (s === 10 || s === 11) {
            drums.tom = 'H';
            drums.kick = true;
          } else if (s === 12 || s === 13) {
            drums.tom = 'M';
            drums.kick = true;
          } else if (s === 14) {
            drums.tom = 'L';
            drums.snare = true;
          } else if (s === 15) {
            drums.tom = 'L';
            drums.kick = true;
            drums.crash = true;
          }
        } else if (sec.drumStyle === 'double_bass') {
          // Relentless 16th-note double-bass pedal + snare on 4 & 12
          drums.kick = true;
          if (s === 4 || s === 12) drums.snare = true;
          if (s % 2 === 0) drums.hatO = s % 8 === 0;
          else drums.hatC = true;
        } else if (sec.drumStyle === 'speed_thrash') {
          // Fast D-beat / thrash drum pattern
          if (s % 2 === 0 || s === 3 || s === 11) drums.kick = true;
          if (s === 2 || s === 6 || s === 10 || s === 14) drums.snare = true;
          if (s % 2 === 0) drums.hatC = true;
        } else if (sec.drumStyle === 'gallop_lock') {
          // Kick locked to Iron Maiden guitar gallop
          if (s % 4 === 0 || s % 4 === 2 || s % 4 === 3) drums.kick = true;
          if (s === 4 || s === 12) drums.snare = true;
          if (s % 2 === 0) drums.hatC = true;
        } else if (sec.drumStyle === 'heavy_halftime') {
          // Heavy crushing half-time stomp (snare on beat 3 = step 8)
          if (s === 0 || s === 3 || s === 6 || s === 14) drums.kick = true;
          if (s === 8) drums.snare = true;
          if (s % 4 === 0) drums.hatO = true;
          else if (s % 2 === 0) drums.hatC = true;
        } else if (sec.drumStyle === 'ballad_slow') {
          if (s === 0 || s === 6 || s === 8) drums.kick = true;
          if (s === 4 || s === 12) drums.snare = true;
          if (s % 2 === 0) drums.hatC = true;
        } else {
          // driving_8th
          if (s === 0 || s === 2 || s === 6 || s === 8 || s === 10)
            drums.kick = true;
          if (s === 4 || s === 12) drums.snare = true;
          if (s % 2 === 0) drums.hatC = true;
        }

        steps.push({
          stepIndex: stepIdx,
          barIndex: globalBar,
          stepInBar: s,
          sectionName: sec.name,
          rhythm,
          lead,
          harmony,
          bass,
          drums,
        });
      }
      globalBar++;
    }
  }

  return { steps, totalBars: globalBar };
}

function createSong(
  id: TrackId,
  trackNumber: string,
  title: string,
  subtitle: string,
  style: string,
  bpm: number,
  rootMidi: number,
  keySignature: string,
  scale: number[],
  loop: boolean,
  sections: SectionBlueprint[]
): MetalSongDefinition {
  const { steps, totalBars } = buildSongSteps(rootMidi, scale, sections);
  const stepSec = 60 / bpm / 4;
  return {
    id,
    trackNumber,
    title,
    subtitle,
    style,
    bpm,
    rootMidi,
    keySignature,
    scaleIntervals: scale,
    loop,
    totalBars,
    totalSteps: steps.length,
    approxDurationSeconds: Math.round(steps.length * stepSec),
    sections,
    steps,
  };
}

export const METAL_SOUNDTRACK: Record<TrackId, MetalSongDefinition> = {
  // 01. MAIN MENU: Metal Warriors '96 (145 BPM - Epic Heavy Metal in E Minor)
  menu: createSong(
    'menu',
    '01',
    "Metal Warriors '96",
    'Menú Principal',
    'Heavy metal épico',
    145,
    40, // E2
    'Mi menor / Armónica menor',
    SCALES.harmonicMinor,
    true,
    [
      {
        name: 'INTRO — TWIN GUITAR FANFARE',
        bars: 4,
        chordDegrees: [0, 5, 6, 0],
        riffStyle: 'power_sustained',
        drumStyle: 'driving_8th',
        hasTwinHarmony: true,
        melodyPattern: [
          0, -99, 2, 4, 7, -99, 6, -99, 4, -99, 2, 0, 6, -99, -99, null,
          5, -99, 7, 9, 11, -99, 9, -99, 7, -99, -99, -99, -99, -99, null, null,
        ],
      },
      {
        name: 'VERSE — IRON GALLOP RIFF',
        bars: 8,
        chordDegrees: [0, 0, 5, 6, 0, 0, 3, 4],
        riffStyle: 'gallop',
        drumStyle: 'gallop_lock',
        hasTwinHarmony: false,
        melodyPattern: [
          7, -99, -99, 6, 4, -99, 2, -99, 0, -99, -99, null, null, null, 2, 4,
          5, -99, 4, 2, 6, -99, 4, 6, 7, -99, -99, -99, null, null, null, null,
        ],
      },
      {
        name: 'CHORUS — METAL WARRIORS ANTHEM',
        bars: 8,
        chordDegrees: [5, 6, 0, 0, 5, 6, 4, 0],
        riffStyle: 'gallop',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          7, -99, 9, -99, 11, -99, 9, 7, 6, -99, 7, -99, 4, -99, -99, null,
          5, -99, 7, -99, 9, -99, 7, 5, 6, -99, 9, -99, 7, -99, -99, null,
        ],
      },
      {
        name: 'SOLO — NEOCLASSICAL 8-BIT SHRED',
        bars: 8,
        chordDegrees: [0, 5, 3, 4, 0, 5, 6, 4],
        riffStyle: 'thrash_16th',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        isSolo: true,
        melodyPattern: [
          7, 9, 11, 9, 7, 11, 9, 7, 6, 7, 9, 7, 6, 4, 6, 7,
          9, 11, 12, 11, 9, 12, 11, 9, 11, 12, 14, 12, 11, 9, 7, 6,
        ],
      },
      {
        name: 'OUTRO — TOURNAMENT CLIMAX',
        bars: 4,
        chordDegrees: [5, 6, 4, 0],
        riffStyle: 'heavy_stomp',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          7, -99, 6, -99, 4, -99, 2, -99, 0, -99, -99, -99, 7, -99, -99, null,
        ],
      },
    ]
  ),

  // 02. CHARACTER SELECT: Choose Your Destiny (165 BPM - Speed Metal 8-Bit in A Minor)
  select: createSong(
    'select',
    '02',
    'Choose Your Destiny',
    'Selección de Personajes',
    'Speed metal 8-bit',
    165,
    45, // A2
    'La menor / Armónica menor',
    SCALES.harmonicMinor,
    true,
    [
      {
        name: 'SPEED INTRO — CHALLENGERS READY',
        bars: 4,
        chordDegrees: [0, 6, 5, 4],
        riffStyle: 'thrash_16th',
        drumStyle: 'speed_thrash',
        hasTwinHarmony: true,
        melodyPattern: [
          4, 7, 9, 7, 4, 7, 9, 11, 9, 7, 6, 7, 4, -99, -99, null,
        ],
      },
      {
        name: 'MAIN HOOK — CHOOSE YOUR DESTINY',
        bars: 8,
        chordDegrees: [0, 0, 2, 3, 0, 5, 6, 4],
        riffStyle: 'gallop',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          7, -99, 7, 9, 11, -99, 9, 7, 6, -99, 7, 6, 4, -99, 2, -99,
          4, 6, 7, 9, 11, -99, 12, 11, 9, -99, 7, -99, -99, -99, null, null,
        ],
      },
      {
        name: 'BRIDGE — TWIN ARPEGGIO OVERDRIVE',
        bars: 4,
        chordDegrees: [5, 3, 6, 4],
        riffStyle: 'space_arp',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        isSolo: true,
        melodyPattern: [
          0, 4, 7, 4, 2, 6, 9, 6, 4, 7, 11, 7, 6, 9, 13, 9,
        ],
      },
    ]
  ),

  // 03. MOSTASA: The Mast Turbadour (175 BPM - Melodic Power Metal in E Harmonic Minor)
  mostasa: createSong(
    'mostasa',
    '03',
    'The Mast Turbadour',
    'Mostasa "The Mast Turbadour" Corgnali',
    'Power metal melódico',
    175,
    40, // E2
    'Mi menor armónica (Power Metal)',
    SCALES.harmonicMinor,
    true,
    [
      {
        name: 'INTRO — RECONQUISTA THUNDER',
        bars: 4,
        chordDegrees: [0, 5, 6, 4],
        riffStyle: 'gallop',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          7, 6, 4, 7, 9, 7, 6, 9, 11, 9, 7, 11, 14, -99, -99, null,
        ],
      },
      {
        name: 'VERSE — GALLOP OF THE LITORAL',
        bars: 8,
        chordDegrees: [0, 0, 5, 5, 3, 3, 6, 4],
        riffStyle: 'gallop',
        drumStyle: 'gallop_lock',
        hasTwinHarmony: false,
        melodyPattern: [
          4, -99, 7, -99, 6, 4, 2, -99, 4, -99, 9, -99, 7, -99, -99, null,
          5, -99, 9, -99, 7, 5, 4, -99, 6, 7, 9, 6, 4, -99, -99, null,
        ],
      },
      {
        name: 'PRE-CHORUS — TWIN AXE ASCENT',
        bars: 4,
        chordDegrees: [3, 4, 5, 6],
        riffStyle: 'thrash_16th',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          3, -99, 5, 7, 4, -99, 6, 8, 5, -99, 7, 9, 6, 8, 11, 13,
        ],
      },
      {
        name: 'CHORUS — THE MAST TURBADOUR ANTHEM',
        bars: 8,
        chordDegrees: [0, 5, 2, 6, 0, 5, 4, 0],
        riffStyle: 'gallop',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          11, -99, 9, 7, 11, -99, 14, -99, 12, -99, 11, 9, 7, -99, -99, null,
          9, -99, 7, 6, 7, -99, 11, -99, 9, 7, 6, 9, 7, -99, -99, null,
        ],
      },
      {
        name: 'SOLO — MALMSTEEN ARPEGGIO FURY',
        bars: 8,
        chordDegrees: [0, 4, 5, 4, 3, 0, 6, 4],
        riffStyle: 'thrash_16th',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        isSolo: true,
        melodyPattern: [
          14, 11, 9, 7, 14, 11, 9, 7, 13, 11, 9, 6, 13, 11, 9, 6,
          7, 9, 11, 12, 14, 12, 11, 9, 11, 14, 16, 14, 13, 14, -99, null,
        ],
      },
      {
        name: 'OUTRO — HEAVY METAL TRIUMPH',
        bars: 4,
        chordDegrees: [5, 3, 4, 0],
        riffStyle: 'heavy_stomp',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          7, -99, 9, -99, 11, -99, 13, -99, 14, -99, -99, -99, -99, -99, null, null,
        ],
      },
    ]
  ),

  // 04. EL BRAIAN: Streets of Fury (160 BPM - Street Heavy Metal in D Minor / Phrygian)
  braian: createSong(
    'braian',
    '04',
    'Streets of Fury',
    'El Braian · Esquina del Barrio',
    'Heavy metal callejero',
    160,
    38, // D2
    'Re menor / Frigio callejero',
    SCALES.phrygian,
    true,
    [
      {
        name: 'INTRO — CONURBANO RIFF ATTACK',
        bars: 4,
        chordDegrees: [0, 1, 0, 6],
        riffStyle: 'syncopated_street',
        drumStyle: 'driving_8th',
        hasTwinHarmony: false,
        melodyPattern: [
          0, null, 1, 0, null, 3, 2, 1, 0, null, 4, 3, 1, -99, null, null,
        ],
      },
      {
        name: 'VERSE — SYNCOPATED ASPHALT',
        bars: 8,
        chordDegrees: [0, 0, 1, 0, 0, 0, 5, 6],
        riffStyle: 'syncopated_street',
        drumStyle: 'speed_thrash',
        hasTwinHarmony: false,
        melodyPattern: [
          4, -99, 3, 1, 0, -99, null, 0, 6, -99, 4, 3, 4, -99, null, null,
          4, -99, 7, -99, 6, 4, 3, 1, 0, -99, 1, -99, 0, -99, null, null,
        ],
      },
      {
        name: 'CHORUS — STREETS OF FURY',
        bars: 8,
        chordDegrees: [0, 5, 1, 6, 0, 5, 3, 4],
        riffStyle: 'gallop',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          7, -99, 7, 8, 7, -99, 4, -99, 6, -99, 6, 7, 4, -99, -99, null,
          7, -99, 10, -99, 8, 7, 6, 4, 7, -99, -99, -99, null, null, null, null,
        ],
      },
      {
        name: 'SOLO — MEGADETH STREET SHRED',
        bars: 8,
        chordDegrees: [0, 1, 0, 1, 5, 6, 3, 4],
        riffStyle: 'thrash_16th',
        drumStyle: 'speed_thrash',
        hasTwinHarmony: true,
        isSolo: true,
        melodyPattern: [
          7, 8, 7, 4, 7, 8, 10, 8, 7, 4, 6, 4, 3, 4, 3, 1,
          4, 6, 7, 8, 10, 11, 10, 8, 14, -99, 11, 10, 7, -99, -99, null,
        ],
      },
      {
        name: 'OUTRO — BARRIO BREAKDOWN',
        bars: 4,
        chordDegrees: [0, 1, 3, 0],
        riffStyle: 'heavy_stomp',
        drumStyle: 'heavy_halftime',
        hasTwinHarmony: true,
        melodyPattern: [
          7, null, 7, 8, 7, null, 4, -99, 0, -99, -99, -99, null, null, null, null,
        ],
      },
    ]
  ),

  // 05. THE LITLLE RAG: Ragged Madness (190 BPM - Frantic Speed Metal in B Minor)
  rag: createSong(
    'rag',
    '05',
    'Ragged Madness',
    'The Litlle Rag · Depósito Arcade',
    'Speed metal frenético',
    190,
    47, // B2
    'Si menor armónica (Speed Metal)',
    SCALES.harmonicMinor,
    true,
    [
      {
        name: 'INTRO — WHIRLWIND ARPEGGIO',
        bars: 4,
        chordDegrees: [0, 6, 5, 4],
        riffStyle: 'thrash_16th',
        drumStyle: 'speed_thrash',
        hasTwinHarmony: true,
        melodyPattern: [
          7, 11, 14, 11, 7, 11, 14, 11, 6, 9, 13, 9, 6, 9, 13, 9,
        ],
      },
      {
        name: 'VERSE — PUNK SPEED FRENZY',
        bars: 8,
        chordDegrees: [0, 0, 3, 4, 0, 0, 5, 4],
        riffStyle: 'thrash_16th',
        drumStyle: 'speed_thrash',
        hasTwinHarmony: false,
        melodyPattern: [
          7, 7, 9, 7, 11, 7, 9, 7, 6, 6, 7, 6, 4, -99, 2, -99,
          7, 7, 9, 11, 14, 11, 9, 7, 13, -99, 11, 9, 7, -99, null, null,
        ],
      },
      {
        name: 'CHORUS — RAGGED MADNESS',
        bars: 8,
        chordDegrees: [5, 6, 0, 4, 5, 3, 4, 0],
        riffStyle: 'gallop',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          12, -99, 11, 9, 14, -99, 11, -99, 13, -99, 11, 9, 7, -99, -99, null,
          12, 11, 9, 11, 14, -99, 16, -99, 14, -99, -99, -99, null, null, null, null,
        ],
      },
      {
        name: 'SOLO — HYPERCHIP ARPEGGIO BLITZ',
        bars: 8,
        chordDegrees: [0, 5, 3, 4, 0, 6, 5, 4],
        riffStyle: 'space_arp',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        isSolo: true,
        melodyPattern: [
          7, 11, 14, 16, 14, 11, 7, 11, 9, 12, 16, 14, 12, 9, 7, 6,
          7, 9, 11, 13, 14, 16, 18, 16, 14, 13, 11, 9, 14, -99, -99, null,
        ],
      },
      {
        name: 'OUTRO — STITCHED CHAOS',
        bars: 4,
        chordDegrees: [0, 4, 6, 0],
        riffStyle: 'thrash_16th',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          14, 13, 11, 9, 7, 6, 4, 2, 0, -99, 7, -99, 14, -99, -99, null,
        ],
      },
    ]
  ),

  // 06. PATOVA MARCELO: No Entry Tonight (130 BPM - Crushing Heavy Metal in C# Minor)
  patova: createSong(
    'patova',
    '06',
    'No Entry Tonight',
    'Patova Marcelo · Entrada del Boliche',
    'Heavy metal pesado',
    130,
    37, // C#2
    'Do# menor / Frigio Dominante',
    SCALES.phrygianDominant,
    true,
    [
      {
        name: 'INTRO — IRON ROPE STOMP',
        bars: 4,
        chordDegrees: [0, 0, 1, 0],
        riffStyle: 'heavy_stomp',
        drumStyle: 'heavy_halftime',
        hasTwinHarmony: false,
        melodyPattern: [
          0, -99, -99, 1, 0, -99, 4, -99, 3, -99, 1, -99, 0, -99, null, null,
        ],
      },
      {
        name: 'VERSE — 135 KG OF GRANITE',
        bars: 8,
        chordDegrees: [0, 0, 1, 0, 0, 5, 3, 4],
        riffStyle: 'heavy_stomp',
        drumStyle: 'driving_8th',
        hasTwinHarmony: false,
        melodyPattern: [
          4, -99, -99, 3, 2, -99, 1, -99, 0, -99, -99, null, null, null, 1, 2,
          4, -99, 7, -99, 5, -99, 4, 2, 4, -99, -99, -99, null, null, null, null,
        ],
      },
      {
        name: 'CHORUS — NO ENTRY TONIGHT',
        bars: 8,
        chordDegrees: [0, 5, 3, 4, 0, 5, 1, 0],
        riffStyle: 'heavy_stomp',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          7, -99, -99, 5, 4, -99, -99, 2, 3, -99, 4, -99, 2, -99, -99, null,
          7, -99, 8, -99, 7, -99, 4, -99, 7, -99, -99, -99, null, null, null, null,
        ],
      },
      {
        name: 'SOLO — PRIEST-STYLE TWIN CRUSHER',
        bars: 8,
        chordDegrees: [0, 1, 0, 1, 5, 3, 4, 0],
        riffStyle: 'gallop',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        isSolo: true,
        melodyPattern: [
          4, 5, 7, 5, 4, 2, 4, 5, 7, 8, 10, 8, 7, 5, 4, 2,
          7, -99, 11, -99, 10, 8, 7, 5, 7, -99, -99, -99, null, null, null, null,
        ],
      },
    ]
  ),

  // 07. JENNY EL TRAVESAÑO: Glamour of Steel (155 BPM - 80s Glam Metal in A Dorian/Minor)
  jenny: createSong(
    'jenny',
    '07',
    'Glamour of Steel',
    'Jenny El Travesaño · Teatro de Variedades',
    'Glam metal ochentoso',
    155,
    45, // A2
    'La menor / Dórico Glam Ochentoso',
    SCALES.dorianGlam,
    true,
    [
      {
        name: 'INTRO — NEON SPOTLIGHT HOOK',
        bars: 4,
        chordDegrees: [0, 5, 2, 4],
        riffStyle: 'glam_bounce',
        drumStyle: 'driving_8th',
        hasTwinHarmony: true,
        melodyPattern: [
          7, -99, 9, 7, 6, -99, 4, -99, 7, 9, 11, -99, 9, -99, -99, null,
        ],
      },
      {
        name: 'VERSE — QUEEN OF THE RING',
        bars: 8,
        chordDegrees: [0, 0, 2, 3, 0, 0, 5, 4],
        riffStyle: 'glam_bounce',
        drumStyle: 'driving_8th',
        hasTwinHarmony: false,
        melodyPattern: [
          4, -99, 6, 7, 9, -99, 7, 4, 6, -99, 4, 2, 4, -99, null, null,
          4, 6, 7, 9, 11, -99, 9, 7, 9, -99, -99, -99, null, null, null, null,
        ],
      },
      {
        name: 'CHORUS — GLAMOUR OF STEEL',
        bars: 8,
        chordDegrees: [2, 6, 0, 5, 2, 3, 4, 0],
        riffStyle: 'gallop',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          9, -99, 11, -99, 12, -99, 11, 9, 7, -99, 9, 7, 6, -99, -99, null,
          9, 11, 12, 14, 11, -99, 9, 7, 7, -99, -99, -99, null, null, null, null,
        ],
      },
      {
        name: 'SOLO — VIRTUOSO ARENA SHRED',
        bars: 8,
        chordDegrees: [0, 2, 3, 4, 0, 5, 6, 4],
        riffStyle: 'thrash_16th',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        isSolo: true,
        melodyPattern: [
          7, 9, 11, 9, 11, 12, 14, 12, 11, 9, 7, 9, 11, -99, 7, -99,
          9, 11, 12, 14, 16, 14, 12, 11, 14, -99, -99, -99, null, null, null, null,
        ],
      },
    ]
  ),

  // 08. THE ALIEN: Cosmic Annihilation (170 BPM - Space Heavy Metal in F# Phrygian Dominant)
  alien: createSong(
    'alien',
    '08',
    'Cosmic Annihilation',
    'The Alien · Sector Zeta-96',
    'Metal espacial',
    170,
    42, // F#2
    'Fa# Frigio Dominante / Armónica menor',
    SCALES.phrygianDominant,
    true,
    [
      {
        name: 'INTRO — ZETA-96 TELEPATHIC SIGNAL',
        bars: 4,
        chordDegrees: [0, 1, 3, 4],
        riffStyle: 'space_arp',
        drumStyle: 'speed_thrash',
        hasTwinHarmony: true,
        melodyPattern: [
          0, 4, 7, 8, 7, 4, 1, 4, 6, 9, 11, 9, 7, -99, -99, null,
        ],
      },
      {
        name: 'VERSE — GRAVITY WELL RIFF',
        bars: 8,
        chordDegrees: [0, 1, 0, 4, 0, 1, 5, 4],
        riffStyle: 'gallop',
        drumStyle: 'double_bass',
        hasTwinHarmony: false,
        melodyPattern: [
          7, -99, 8, 7, 6, -99, 4, -99, 3, 4, 6, 3, 4, -99, -99, null,
          7, 8, 10, 8, 7, 6, 4, 6, 7, -99, -99, -99, null, null, null, null,
        ],
      },
      {
        name: 'CHORUS — COSMIC ANNIHILATION',
        bars: 8,
        chordDegrees: [5, 6, 0, 1, 5, 3, 4, 0],
        riffStyle: 'space_arp',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          11, -99, 10, 8, 7, -99, 11, -99, 12, 11, 10, 8, 7, -99, -99, null,
          8, 10, 11, 14, 11, -99, 10, 8, 7, -99, -99, -99, null, null, null, null,
        ],
      },
      {
        name: 'SOLO — EXTRATERRESTRIAL LASER SHRED',
        bars: 8,
        chordDegrees: [0, 1, 5, 4, 0, 1, 3, 4],
        riffStyle: 'thrash_16th',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        isSolo: true,
        melodyPattern: [
          7, 10, 11, 14, 11, 10, 7, 10, 8, 11, 12, 15, 12, 11, 8, 11,
          14, 15, 14, 11, 10, 11, 10, 8, 7, -99, 14, -99, -99, -99, null, null,
        ],
      },
    ]
  ),

  // 09. VICTORY: Warriors Never Fall (140 BPM - Triumphant Heavy Metal Anthem)
  victory: createSong(
    'victory',
    '09',
    'Warriors Never Fall',
    'Pantalla de Victoria / Campeón',
    'Himno triunfal',
    140,
    40, // E2
    'Mi menor / Sol Mayor Heroico',
    SCALES.dorianGlam,
    true,
    [
      {
        name: 'FANFARE — CHAMPION OF THE RING',
        bars: 8,
        chordDegrees: [0, 5, 2, 4, 0, 5, 6, 0],
        riffStyle: 'power_sustained',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          4, -99, 7, -99, 9, -99, 11, -99, 12, -99, 11, 9, 11, -99, -99, null,
          9, -99, 11, 12, 14, -99, 11, -99, 7, -99, -99, -99, null, null, null, null,
        ],
      },
      {
        name: 'CHORUS — WARRIORS NEVER FALL',
        bars: 8,
        chordDegrees: [2, 6, 5, 4, 2, 3, 4, 0],
        riffStyle: 'gallop',
        drumStyle: 'double_bass',
        hasTwinHarmony: true,
        melodyPattern: [
          11, -99, 11, 12, 14, -99, 11, -99, 9, -99, 9, 11, 12, -99, 9, -99,
          7, 9, 11, 12, 14, -99, 16, -99, 14, -99, -99, -99, null, null, null, null,
        ],
      },
    ]
  ),

  // 10. GAME OVER: The Last Battle (85 BPM - Melancholic 8-Bit Power Ballad in D Minor)
  gameover: createSong(
    'gameover',
    '10',
    'The Last Battle',
    'Fin de Partida / Continuar',
    'Heavy metal melancólico',
    85,
    38, // D2
    'Re menor (Balada Heavy 8-Bit)',
    SCALES.harmonicMinor,
    true,
    [
      {
        name: 'ELEGY — FALLEN FIGHTER ARPEGGIO',
        bars: 8,
        chordDegrees: [0, 5, 2, 6, 0, 3, 6, 4],
        riffStyle: 'ballad_arp',
        drumStyle: 'ballad_slow',
        hasTwinHarmony: true,
        melodyPattern: [
          7, -99, -99, 6, 4, -99, -99, 2, 5, -99, 4, 2, 3, -99, -99, null,
          4, -99, 7, -99, 6, -99, 4, 3, 4, -99, -99, -99, null, null, null, null,
        ],
      },
      {
        name: 'SOLO — WEEPING 8-BIT LEAD',
        bars: 8,
        chordDegrees: [0, 5, 3, 4, 5, 3, 4, 0],
        riffStyle: 'power_sustained',
        drumStyle: 'ballad_slow',
        hasTwinHarmony: true,
        isSolo: true,
        melodyPattern: [
          7, -99, 9, 11, 12, -99, 11, 9, 7, -99, 6, -99, 7, -99, -99, null,
          9, 11, 12, 14, 11, -99, 9, 7, 7, -99, -99, -99, null, null, null, null,
        ],
      },
    ]
  ),
};

export function getStageTrackId(stageId: CharacterId): TrackId {
  return stageId;
}
