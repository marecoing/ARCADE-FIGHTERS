import {
  ALL_TRACK_IDS,
  DrumStepEvent,
  LeadNoteEvent,
  METAL_SOUNDTRACK,
  MetalSongDefinition,
  RhythmNoteEvent,
  TrackId,
} from './metalSongs';
import { CharacterId } from './types';

export interface AudioPlaybackStatus {
  currentTrackId: TrackId;
  trackNumber: string;
  title: string;
  subtitle: string;
  style: string;
  keySignature: string;
  bpm: number;
  isPlaying: boolean;
  isPaused: boolean;
  currentStep: number;
  totalSteps: number;
  barIndex: number;
  totalBars: number;
  sectionName: string;
  criticalHealthMode: boolean;
  musicVolume: number;
  sfxVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  chipMode8Bit: 'nes_pure' | 'metal_overdrive';
  dynamicMusicIntensity: boolean;
  channelActivity: {
    rhythm: number;
    lead: number;
    harmony: number;
    bass: number;
    drums: number;
  };
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class ArcadeAudioManager {
  private ctx: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private distortionCurve: Float32Array<ArrayBuffer> | null = null;
  private pulseWaves: Record<'12.5' | '25' | '50', PeriodicWave | null> = {
    '12.5': null,
    '25': null,
    '50': null,
  };

  private schedulerTimer: number | null = null;
  private nextNoteTime = 0;
  private currentTrackId: TrackId = 'menu';
  private currentStepIndex = 0;
  private isPlaying = false;
  private isPaused = false;
  private criticalHealthMode = false;

  public musicVolume = 0.55;
  public sfxVolume = 0.75;
  public musicEnabled = true;
  public sfxEnabled = true;
  public muted = false;
  public chipMode8Bit: 'nes_pure' | 'metal_overdrive' = 'metal_overdrive';
  public dynamicMusicIntensity = true;

  private activeNodes: Set<AudioScheduledSourceNode> = new Set();
  private listeners: Set<() => void> = new Set();
  private channelActivity = {
    rhythm: 0,
    lead: 0,
    harmony: 0,
    bass: 0,
    drums: 0,
  };

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.setupAudioGraph(this.ctx);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private setupAudioGraph(ctx: AudioContext): void {
    // Master Dynamics Compressor to prevent clipping during intense twin-guitar solos
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.15;
    compressor.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.getEffectiveMusicGain();
    this.musicBus.connect(compressor);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.getEffectiveSfxGain();
    this.sfxBus.connect(compressor);

    // Pre-generate 2-second white noise buffer for 8-bit metal drums & SFX
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      // LFSR-inspired stepped noise for authentic 8-bit NES noise texture
      const raw = Math.random() * 2 - 1;
      data[i] = Math.round(raw * 8) / 8;
    }
    this.noiseBuffer = buffer;

    // Pre-generate NES pulse duty cycle PeriodicWaves (12.5%, 25%, 50%)
    this.pulseWaves['12.5'] = this.createPulseWave(ctx, 0.125);
    this.pulseWaves['25'] = this.createPulseWave(ctx, 0.25);
    this.pulseWaves['50'] = this.createPulseWave(ctx, 0.5);

    // Pre-generate subtle digital overdrive transfer curve for rhythm guitar
    const samples = 256;
    const curve = new Float32Array(new ArrayBuffer(samples * 4));
    const k = 14;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    this.distortionCurve = curve;
  }

  private createPulseWave(ctx: AudioContext, duty: number): PeriodicWave {
    const harmonics = 32;
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);
    real[0] = 0;
    imag[0] = 0;
    for (let n = 1; n <= harmonics; n++) {
      real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
      imag[n] = 0;
    }
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  private getEffectiveMusicGain(): number {
    if (this.muted || !this.musicEnabled) return 0;
    return Math.max(0, Math.min(1, this.musicVolume));
  }

  private getEffectiveSfxGain(): number {
    if (this.muted || !this.sfxEnabled) return 0;
    return Math.max(0, Math.min(1, this.sfxVolume));
  }

  public setVolumes(
    music: number,
    sfx: number,
    muted: boolean,
    extra?: {
      musicEnabled?: boolean;
      sfxEnabled?: boolean;
      chipMode8Bit?: 'nes_pure' | 'metal_overdrive';
      dynamicMusicIntensity?: boolean;
    }
  ): void {
    this.musicVolume = Math.max(0, Math.min(1, music / 100));
    this.sfxVolume = Math.max(0, Math.min(1, sfx / 100));
    this.muted = muted;
    if (extra) {
      if (typeof extra.musicEnabled === 'boolean') {
        this.musicEnabled = extra.musicEnabled;
      }
      if (typeof extra.sfxEnabled === 'boolean') {
        this.sfxEnabled = extra.sfxEnabled;
      }
      if (extra.chipMode8Bit) {
        this.chipMode8Bit = extra.chipMode8Bit;
      }
      if (typeof extra.dynamicMusicIntensity === 'boolean') {
        this.dynamicMusicIntensity = extra.dynamicMusicIntensity;
      }
    }

    if (this.ctx && this.musicBus) {
      this.musicBus.gain.setTargetAtTime(
        this.getEffectiveMusicGain(),
        this.ctx.currentTime,
        0.02
      );
    }
    if (this.ctx && this.sfxBus) {
      this.sfxBus.gain.setTargetAtTime(
        this.getEffectiveSfxGain(),
        this.ctx.currentTime,
        0.02
      );
    }

    if (this.muted || !this.musicEnabled || this.musicVolume <= 0) {
      // Keep track state but silence output cleanly
    } else if (!this.isPlaying && !this.isPaused) {
      this.playTrack(this.currentTrackId);
    }
    this.notify();
  }

  public setCriticalHealthMode(isCritical: boolean): void {
    const next = Boolean(isCritical && this.dynamicMusicIntensity);
    if (this.criticalHealthMode !== next) {
      this.criticalHealthMode = next;
      this.notify();
    }
  }

  public duckForSuper(durationMs = 650): void {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime;
    const baseGain = this.getEffectiveMusicGain();
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setValueAtTime(baseGain * 0.18, now);
    this.musicBus.gain.linearRampToValueAtTime(
      baseGain,
      now + durationMs / 1000
    );
  }

  // =========================================================================
  // LOOKAHEAD SEQUENCER & TRACK CONTROL
  // =========================================================================

  public playTrack(trackId: TrackId, forceRestart = false): void {
    if (
      this.currentTrackId === trackId &&
      this.isPlaying &&
      !this.isPaused &&
      !forceRestart
    ) {
      return;
    }

    this.stopAllActiveVoices();
    this.currentTrackId = trackId;
    this.currentStepIndex = 0;
    this.isPlaying = true;
    this.isPaused = false;

    const ctx = this.ensureContext();
    if (ctx) {
      this.nextNoteTime = ctx.currentTime + 0.03;
    }

    this.startSchedulerLoop();
    this.notify();
  }

  public startStageMusic(stageId: CharacterId): void {
    this.playTrack(stageId, false);
  }

  public pauseMusic(): void {
    if (!this.isPlaying || this.isPaused) return;
    this.isPaused = true;
    this.stopSchedulerLoop();
    this.stopAllActiveVoices();
    this.channelActivity = {
      rhythm: 0,
      lead: 0,
      harmony: 0,
      bass: 0,
      drums: 0,
    };
    this.notify();
  }

  public resumeMusic(): void {
    if (!this.isPlaying) {
      this.playTrack(this.currentTrackId, true);
      return;
    }
    if (!this.isPaused) return;
    this.isPaused = false;
    const ctx = this.ensureContext();
    if (ctx) {
      this.nextNoteTime = ctx.currentTime + 0.03;
    }
    this.startSchedulerLoop();
    this.notify();
  }

  public stopMusic(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentStepIndex = 0;
    this.stopSchedulerLoop();
    this.stopAllActiveVoices();
    this.channelActivity = {
      rhythm: 0,
      lead: 0,
      harmony: 0,
      bass: 0,
      drums: 0,
    };
    this.notify();
  }

  private startSchedulerLoop(): void {
    this.stopSchedulerLoop();
    if (typeof window === 'undefined') return;

    const LOOKAHEAD_MS = 25;
    const SCHEDULE_AHEAD_SEC = 0.11;

    const tick = () => {
      if (!this.isPlaying || this.isPaused) return;
      const song: MetalSongDefinition = METAL_SOUNDTRACK[this.currentTrackId];
      if (!song) return;

      const stepDurationSec = 60 / song.bpm / 4; // 16th note duration

      const ctx = this.ensureContext();
      if (!ctx || ctx.state === 'suspended') {
        // Advance step visualization even while waiting for browser gesture unlock
        this.currentStepIndex =
          (this.currentStepIndex + 1) % Math.max(1, song.totalSteps);
        const stepEv = song.steps[this.currentStepIndex];
        if (stepEv) {
          this.channelActivity = {
            rhythm: stepEv.rhythm ? 0.85 : 0.1,
            lead: stepEv.lead ? 0.95 : 0.05,
            harmony: stepEv.harmony ? 0.85 : 0.05,
            bass: stepEv.bass ? 0.9 : 0.1,
            drums:
              stepEv.drums.kick || stepEv.drums.snare || stepEv.drums.crash
                ? 0.95
                : 0.2,
          };
        }
        this.notify();
        return;
      }

      if (this.nextNoteTime < ctx.currentTime - 0.2) {
        this.nextNoteTime = ctx.currentTime + 0.02;
      }

      let advanced = false;
      while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_SEC) {
        const stepEv = song.steps[this.currentStepIndex];
        if (stepEv && this.getEffectiveMusicGain() > 0) {
          this.scheduleStepEvents(ctx, song, stepEv, this.nextNoteTime, stepDurationSec);
        }

        if (stepEv) {
          this.channelActivity = {
            rhythm: stepEv.rhythm
              ? stepEv.rhythm.palmMute
                ? 0.65
                : 0.95
              : Math.max(0, this.channelActivity.rhythm - 0.25),
            lead: stepEv.lead
              ? 1.0
              : Math.max(0, this.channelActivity.lead - 0.2),
            harmony:
              stepEv.harmony || (this.criticalHealthMode && stepEv.lead)
                ? 0.9
                : Math.max(0, this.channelActivity.harmony - 0.2),
            bass: stepEv.bass
              ? 0.9
              : Math.max(0, this.channelActivity.bass - 0.25),
            drums:
              stepEv.drums.kick || stepEv.drums.snare || stepEv.drums.crash
                ? 0.95
                : 0.2,
          };
        }

        this.nextNoteTime += stepDurationSec;
        this.currentStepIndex++;
        if (this.currentStepIndex >= song.totalSteps) {
          this.currentStepIndex = 0;
        }
        advanced = true;
      }

      if (advanced) {
        this.notify();
      }
    };

    tick();
    this.schedulerTimer = window.setInterval(tick, LOOKAHEAD_MS);
  }

  private stopSchedulerLoop(): void {
    if (this.schedulerTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private stopAllActiveVoices(): void {
    this.activeNodes.forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // Ignore already stopped
      }
    });
    this.activeNodes.clear();
  }

  private registerSource(node: AudioScheduledSourceNode): void {
    this.activeNodes.add(node);
    node.onended = () => {
      this.activeNodes.delete(node);
    };
  }

  // =========================================================================
  // 4 VIRTUAL 8-BIT HEAVY METAL INSTRUMENTS
  // =========================================================================

  private scheduleStepEvents(
    ctx: AudioContext,
    song: MetalSongDefinition,
    stepEv: MetalSongDefinition['steps'][number],
    time: number,
    stepDur: number
  ): void {
    if (!this.musicBus) return;

    // 1. 8-Bit Rhythm Guitar (Palm-Muted Chugs & Power Chords)
    if (stepEv.rhythm) {
      this.scheduleRhythmGuitar(ctx, stepEv.rhythm, time, stepDur);
    }

    // 2. 8-Bit Lead Guitar (with Vibrato & Pitch Slides)
    if (stepEv.lead) {
      this.scheduleLeadGuitar(ctx, stepEv.lead, time, stepDur, 0.14);
    }

    // 3. 8-Bit Twin Harmony Guitar (2nd Voice in 3rds/6ths + Critical HP Overdrive)
    if (stepEv.harmony) {
      this.scheduleLeadGuitar(ctx, stepEv.harmony, time, stepDur, 0.1);
    } else if (this.criticalHealthMode && stepEv.lead) {
      // Dynamic Intensity Layer (< 20% HP): Add harmonized twin-lead voice +5 semitones
      this.scheduleLeadGuitar(
        ctx,
        {
          ...stepEv.lead,
          midi: stepEv.lead.midi + 4,
          duty: '50',
        },
        time,
        stepDur,
        0.09
      );
    }

    // 4. 8-Bit Electric Bass (Triangle + Sub-Pulse Gallop)
    if (stepEv.bass) {
      this.scheduleBassGuitar(
        ctx,
        stepEv.bass.midi,
        stepEv.bass.durationSteps * stepDur,
        stepEv.bass.accent,
        time
      );
    }

    // 5. 8-Bit Heavy Metal Drum Kit (with double-bass boost in Critical HP mode)
    const drums: DrumStepEvent = this.criticalHealthMode
      ? { ...stepEv.drums, kick: true }
      : stepEv.drums;
    this.scheduleDrumKit(ctx, drums, time);
  }

  private scheduleRhythmGuitar(
    ctx: AudioContext,
    ev: RhythmNoteEvent,
    time: number,
    stepDur: number
  ): void {
    if (!this.musicBus) return;
    const rootFreq = midiToFreq(ev.midi);
    const fifthFreq = midiToFreq(ev.midi + 7);
    const rawDur = ev.durationSteps * stepDur;
    const dur = ev.palmMute ? Math.min(rawDur * 0.62, 0.095) : rawDur * 0.92;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(ev.palmMute ? 1150 : 2800, time);
    filter.Q.value = ev.palmMute ? 2.2 : 1.1;

    const env = ctx.createGain();
    const peakGain = ev.palmMute ? 0.11 : 0.13;
    env.gain.setValueAtTime(0.001, time);
    env.gain.linearRampToValueAtTime(peakGain, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);

    if (this.chipMode8Bit === 'metal_overdrive' && this.distortionCurve) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.distortionCurve;
      shaper.oversample = 'none';
      filter.connect(shaper);
      shaper.connect(env);
    } else {
      filter.connect(env);
    }
    env.connect(this.musicBus);

    // Root Pulse Oscillator
    const osc1 = ctx.createOscillator();
    if (this.pulseWaves['25']) {
      osc1.setPeriodicWave(this.pulseWaves['25']);
    } else {
      osc1.type = 'square';
    }
    osc1.frequency.setValueAtTime(rootFreq, time);
    osc1.connect(filter);
    osc1.start(time);
    osc1.stop(time + dur + 0.01);
    this.registerSource(osc1);

    // Power Chord 5th Oscillator
    if (ev.powerFifth && (!ev.palmMute || this.chipMode8Bit === 'metal_overdrive')) {
      const osc2 = ctx.createOscillator();
      if (this.pulseWaves['50']) {
        osc2.setPeriodicWave(this.pulseWaves['50']);
      } else {
        osc2.type = 'square';
      }
      osc2.frequency.setValueAtTime(fifthFreq, time);
      const fifthGain = ctx.createGain();
      fifthGain.gain.value = 0.65;
      osc2.connect(fifthGain);
      fifthGain.connect(filter);
      osc2.start(time);
      osc2.stop(time + dur + 0.01);
      this.registerSource(osc2);
    }
  }

  private scheduleLeadGuitar(
    ctx: AudioContext,
    ev: LeadNoteEvent,
    time: number,
    stepDur: number,
    peakGain: number
  ): void {
    if (!this.musicBus) return;
    const targetFreq = midiToFreq(ev.midi);
    const dur = Math.max(0.05, ev.durationSteps * stepDur * 0.95);

    const osc = ctx.createOscillator();
    const wave = this.pulseWaves[ev.duty];
    if (wave) {
      osc.setPeriodicWave(wave);
    } else {
      osc.type = 'square';
    }

    if (ev.slideFromMidi) {
      const startFreq = midiToFreq(ev.slideFromMidi);
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(targetFreq, time + Math.min(0.045, dur * 0.4));
    } else {
      osc.frequency.setValueAtTime(targetFreq, time);
    }

    // Expressive 8-bit Lead Vibrato LFO
    if (ev.vibrato && dur > 0.14) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 6.2; // 6.2 Hz classic metal vibrato
      lfoGain.gain.setValueAtTime(0, time);
      lfoGain.gain.linearRampToValueAtTime(targetFreq * 0.012, time + 0.08);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(time);
      lfo.stop(time + dur + 0.01);
      this.registerSource(lfo);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 4200;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, time);
    env.gain.linearRampToValueAtTime(peakGain, time + 0.006);
    env.gain.setValueAtTime(peakGain * 0.85, time + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.musicBus);

    osc.start(time);
    osc.stop(time + dur + 0.01);
    this.registerSource(osc);
  }

  private scheduleBassGuitar(
    ctx: AudioContext,
    midi: number,
    dur: number,
    accent: boolean,
    time: number
  ): void {
    if (!this.musicBus) return;
    const freq = midiToFreq(midi);
    const actualDur = Math.max(0.04, dur * 0.88);

    // Primary NES Triangle Bass Oscillator
    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    tri.frequency.setValueAtTime(freq, time);

    const env = ctx.createGain();
    const peak = accent ? 0.24 : 0.19;
    env.gain.setValueAtTime(0.001, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, time + actualDur);

    tri.connect(env);
    env.connect(this.musicBus);
    tri.start(time);
    tri.stop(time + actualDur + 0.01);
    this.registerSource(tri);

    // Subtle pick-attack pulse layer on accented bass notes
    if (accent && this.chipMode8Bit === 'metal_overdrive') {
      const pick = ctx.createOscillator();
      pick.type = 'square';
      pick.frequency.setValueAtTime(freq * 2, time);
      const pickEnv = ctx.createGain();
      pickEnv.gain.setValueAtTime(0.045, time);
      pickEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
      pick.connect(pickEnv);
      pickEnv.connect(this.musicBus);
      pick.start(time);
      pick.stop(time + 0.04);
      this.registerSource(pick);
    }
  }

  private scheduleDrumKit(
    ctx: AudioContext,
    drums: DrumStepEvent,
    time: number
  ): void {
    if (!this.musicBus) return;

    // 1. Kick / Double-Bass Drum
    if (drums.kick) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(155, time);
      osc.frequency.exponentialRampToValueAtTime(38, time + 0.085);

      env.gain.setValueAtTime(0.28, time);
      env.gain.exponentialRampToValueAtTime(0.001, time + 0.095);

      osc.connect(env);
      env.connect(this.musicBus);
      osc.start(time);
      osc.stop(time + 0.1);
      this.registerSource(osc);
    }

    // 2. Heavy Metal Snare Drum (Noise + Tonal Body)
    if (drums.snare) {
      const bodyOsc = ctx.createOscillator();
      const bodyEnv = ctx.createGain();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(220, time);
      bodyOsc.frequency.exponentialRampToValueAtTime(110, time + 0.08);
      bodyEnv.gain.setValueAtTime(0.18, time);
      bodyEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
      bodyOsc.connect(bodyEnv);
      bodyEnv.connect(this.musicBus);
      bodyOsc.start(time);
      bodyOsc.stop(time + 0.1);
      this.registerSource(bodyOsc);

      if (this.noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1850;
        filter.Q.value = 0.9;
        const nEnv = ctx.createGain();
        nEnv.gain.setValueAtTime(0.2, time);
        nEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
        noise.connect(filter);
        filter.connect(nEnv);
        nEnv.connect(this.musicBus);
        noise.start(time, 0, 0.15);
        this.registerSource(noise);
      }
    }

    // 3. Hi-Hat Closed / Open
    if ((drums.hatC || drums.hatO) && this.noiseBuffer) {
      const isOpen = Boolean(drums.hatO);
      const dur = isOpen ? 0.13 : 0.035;
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7200;
      const env = ctx.createGain();
      env.gain.setValueAtTime(isOpen ? 0.09 : 0.06, time);
      env.gain.exponentialRampToValueAtTime(0.001, time + dur);
      noise.connect(filter);
      filter.connect(env);
      env.connect(this.musicBus);
      noise.start(time, 0, dur + 0.01);
      this.registerSource(noise);
    }

    // 4. Crash Cymbal
    if (drums.crash && this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 4200;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.14, time);
      env.gain.exponentialRampToValueAtTime(0.001, time + 0.48);
      noise.connect(filter);
      filter.connect(env);
      env.connect(this.musicBus);
      noise.start(time, 0, 0.5);
      this.registerSource(noise);
    }

    // 5. Tuned Toms (High / Mid / Low Fill Toms)
    if (drums.tom) {
      const startFreq =
        drums.tom === 'H' ? 260 : drums.tom === 'M' ? 195 : 140;
      const endFreq = startFreq * 0.48;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.11);
      env.gain.setValueAtTime(0.16, time);
      env.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      osc.connect(env);
      env.connect(this.musicBus);
      osc.start(time);
      osc.stop(time + 0.13);
      this.registerSource(osc);
    }
  }

  // =========================================================================
  // COMBAT & UI SOUND EFFECTS (Independent SFX Bus)
  // =========================================================================

  public playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gainVal: number
  ): void {
    if (this.getEffectiveSfxGain() <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFreq),
      now + duration
    );

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxBus);

    osc.start(now);
    osc.stop(now + duration);
  }

  public playNoise(duration: number, filterFreq: number, gainVal: number): void {
    if (this.getEffectiveSfxGain() <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus || !this.noiseBuffer) return;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);

    noise.start(now, 0, Math.min(1.9, duration));
  }

  public playMenuMove(): void {
    this.playTone(520, 680, 0.055, 'square', 0.16);
  }

  public playMenuConfirm(): void {
    this.playTone(440, 880, 0.14, 'sawtooth', 0.22);
    setTimeout(() => this.playTone(660, 1320, 0.18, 'square', 0.2), 55);
  }

  public playMenuBack(): void {
    this.playTone(587.3, 293.7, 0.14, 'square', 0.18);
    setTimeout(() => this.playTone(293.7, 196.0, 0.16, 'triangle', 0.18), 45);
  }

  public playSwing(heavy = false): void {
    this.playNoise(heavy ? 0.14 : 0.08, heavy ? 600 : 950, 0.18);
  }

  public playHit(heavy: boolean, blocked: boolean): void {
    if (blocked) {
      this.playTone(900, 320, 0.09, 'triangle', 0.26);
      this.playNoise(0.07, 1800, 0.2);
      return;
    }
    if (heavy) {
      this.playTone(180, 38, 0.22, 'sawtooth', 0.38);
      this.playNoise(0.18, 520, 0.35);
    } else {
      this.playTone(260, 65, 0.12, 'square', 0.28);
      this.playNoise(0.1, 880, 0.24);
    }
  }

  public playSpecial(): void {
    this.playTone(300, 960, 0.24, 'sawtooth', 0.26);
    this.playNoise(0.18, 1200, 0.2);
  }

  public playSuperFlash(): void {
    this.duckForSuper(700);
    this.playTone(220, 1480, 0.42, 'sawtooth', 0.35);
    setTimeout(() => this.playTone(880, 1760, 0.32, 'square', 0.3), 90);
    this.playNoise(0.35, 1600, 0.25);
  }

  public playKO(): void {
    // Explosive 8-bit metal power chord + crash KO stinger
    this.playTone(164.8, 82.4, 0.65, 'sawtooth', 0.42);
    this.playTone(246.9, 123.5, 0.65, 'square', 0.32);
    this.playNoise(0.55, 380, 0.42);
  }

  public announce(phrase: string): void {
    if (this.getEffectiveSfxGain() <= 0) return;
    if (phrase.includes('ROUND')) {
      this.playTone(330, 440, 0.15, 'square', 0.22);
    } else if (phrase.includes('FIGHT')) {
      this.playTone(440, 880, 0.25, 'sawtooth', 0.3);
    } else if (phrase.includes('K.O.') || phrase.includes('SUPER')) {
      this.playKO();
    } else if (phrase.includes('WIN') || phrase.includes('PERFECT')) {
      this.playTone(523, 784, 0.2, 'square', 0.24);
      setTimeout(() => this.playTone(659, 1046, 0.3, 'square', 0.25), 140);
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(phrase);
        utter.lang = 'en-US';
        utter.pitch = 0.78;
        utter.rate = 1.08;
        utter.volume = Math.min(1, this.sfxVolume * 0.85);
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore if speech synthesis is blocked
      }
    }
  }

  // =========================================================================
  // TELEMETRY & SUBSCRIPTION FOR SOUND TEST & UI
  // =========================================================================

  public getPlaybackStatus(): AudioPlaybackStatus {
    const song = METAL_SOUNDTRACK[this.currentTrackId] || METAL_SOUNDTRACK.menu;
    const stepEv = song.steps[this.currentStepIndex] || song.steps[0];
    return {
      currentTrackId: song.id,
      trackNumber: song.trackNumber,
      title: song.title,
      subtitle: song.subtitle,
      style: song.style,
      keySignature: song.keySignature,
      bpm: song.bpm,
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentStep: this.currentStepIndex,
      totalSteps: song.totalSteps,
      barIndex: stepEv ? stepEv.barIndex : 0,
      totalBars: song.totalBars,
      sectionName: stepEv ? stepEv.sectionName : song.sections[0].name,
      criticalHealthMode: this.criticalHealthMode,
      musicVolume: Math.round(this.musicVolume * 100),
      sfxVolume: Math.round(this.sfxVolume * 100),
      musicEnabled: this.musicEnabled,
      sfxEnabled: this.sfxEnabled,
      chipMode8Bit: this.chipMode8Bit,
      dynamicMusicIntensity: this.dynamicMusicIntensity,
      channelActivity: { ...this.channelActivity },
    };
  }

  public getAllTracks(): MetalSongDefinition[] {
    return ALL_TRACK_IDS.map((id) => METAL_SOUNDTRACK[id]);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const arcadeAudio = new ArcadeAudioManager();
