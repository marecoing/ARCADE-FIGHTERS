'use client';

import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Flame,
  Music,
  Cpu,
  Radio,
  X,
} from 'lucide-react';
import {
  AudioPlaybackStatus,
  arcadeAudio,
} from '@/lib/game/audio';
import {
  ALL_TRACK_IDS,
  METAL_SOUNDTRACK,
  TrackId,
} from '@/lib/game/metalSongs';
import { GameOptions } from '@/lib/game/types';

interface SoundTestModalProps {
  options: GameOptions;
  onUpdateOptions: (updater: (prev: GameOptions) => GameOptions) => void;
  onClose: () => void;
}

export function SoundTestModal({
  options,
  onUpdateOptions,
  onClose,
}: SoundTestModalProps) {
  const [status, setStatus] = useState<AudioPlaybackStatus>(() =>
    arcadeAudio.getPlaybackStatus()
  );

  useEffect(() => {
    const sync = () => {
      setStatus(arcadeAudio.getPlaybackStatus());
    };
    sync();
    const unsub = arcadeAudio.subscribe(sync);
    return () => unsub();
  }, []);

  const tracks = ALL_TRACK_IDS.map((id) => METAL_SOUNDTRACK[id]);
  const currentIdx = ALL_TRACK_IDS.indexOf(status.currentTrackId);

  const handleSelectTrack = (id: TrackId) => {
    arcadeAudio.playTrack(id, true);
  };

  const handlePrevTrack = () => {
    const prevIdx =
      (currentIdx - 1 + ALL_TRACK_IDS.length) % ALL_TRACK_IDS.length;
    arcadeAudio.playTrack(ALL_TRACK_IDS[prevIdx], true);
  };

  const handleNextTrack = () => {
    const nextIdx = (currentIdx + 1) % ALL_TRACK_IDS.length;
    arcadeAudio.playTrack(ALL_TRACK_IDS[nextIdx], true);
  };

  const handlePlayResume = () => {
    if (status.isPlaying && !status.isPaused) {
      arcadeAudio.playTrack(status.currentTrackId, true);
    } else {
      arcadeAudio.resumeMusic();
    }
  };

  return (
    <div
      data-testid="sound-test-modal"
      className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-3 md:p-5"
    >
      <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto bg-zinc-950 border-2 border-amber-400 p-4 md:p-5 space-y-3.5">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl md:text-2xl font-arcade font-bold text-amber-400 tracking-wider">
                SOUND TEST · 1980s 8-BIT HEAVY METAL SOUNDTRACK
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Sintetizador Chiptune en tiempo real (Web Audio API Lookahead
              Sequencer) · Guitarras Gemelas, Bajo Galopante y Doble Bombo.
            </p>
          </div>

          <button
            type="button"
            data-testid="close-sound-test"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-arcade font-bold text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
            CERRAR SOUND TEST
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: 10-Track Jukebox Selector */}
          <div className="lg:col-span-5 bg-zinc-900/90 border border-zinc-800 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono-num text-amber-400 font-bold pb-1 border-b border-zinc-800">
              <span>SELECCIONAR PISTA (10 TEMAS ORIGINALES)</span>
              <span>BPM</span>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {tracks.map((t) => {
                const isSelected = status.currentTrackId === t.id;
                const isActivePlaying =
                  isSelected && status.isPlaying && !status.isPaused;
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`soundtest-track-${t.id}`}
                    onClick={() => handleSelectTrack(t.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400/15 border-amber-400 text-white'
                        : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-xs font-bold text-amber-400">
                          #{t.trackNumber}
                        </span>
                        <span className="font-arcade font-bold text-sm truncate">
                          {t.title}
                        </span>
                        {isActivePlaying && (
                          <span className="px-1.5 py-0.5 text-[10px] font-mono-num font-bold bg-emerald-400 text-zinc-950">
                            ON AIR
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {t.subtitle} · <span className="text-sky-300">{t.style}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono-num">
                      <span className="text-xs font-bold text-amber-300">
                        {t.bpm} BPM
                      </span>
                      <span className="block text-[10px] text-zinc-500">
                        {t.totalBars} compases
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live Deck Controls, Telemetry & 5-Channel Chiptune Mixer */}
          <div className="lg:col-span-7 space-y-3.5">
            {/* Active Track Display Panel */}
            <div className="bg-zinc-900 border-2 border-amber-400/80 p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-mono-num font-bold bg-amber-400 text-zinc-950">
                      TRACK #{status.trackNumber}
                    </span>
                    <span
                      data-testid="soundtest-playback-badge"
                      className={`px-2 py-0.5 text-xs font-mono-num font-bold ${
                        status.isPlaying && !status.isPaused
                          ? 'bg-emerald-400 text-zinc-950'
                          : status.isPaused
                            ? 'bg-amber-300 text-zinc-950'
                            : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {status.isPlaying && !status.isPaused
                        ? '● REPRODUCIENDO'
                        : status.isPaused
                          ? '❚❚ EN PAUSA'
                          : '■ DETENIDO'}
                    </span>
                  </div>
                  <h3
                    data-testid="soundtest-active-title"
                    className="text-2xl font-arcade font-bold text-white mt-1"
                  >
                    {status.title}
                  </h3>
                  <p className="text-xs text-zinc-300">
                    {status.subtitle} ·{' '}
                    <strong className="text-amber-300">{status.style}</strong> ·{' '}
                    Tonalidad: {status.keySignature}
                  </p>
                </div>

                <div className="text-right font-mono-num bg-zinc-950 border border-zinc-800 px-3 py-2">
                  <div
                    data-testid="soundtest-active-bpm"
                    className="text-xl font-bold text-amber-400"
                  >
                    {status.bpm} BPM
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Compás {status.barIndex + 1}/{status.totalBars} · Paso{' '}
                    {status.currentStep + 1}/{status.totalSteps}
                  </div>
                </div>
              </div>

              {/* Active Musical Section & Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono-num">
                  <span className="text-sky-300 font-bold">
                    SECCIÓN ACTIVA: {status.sectionName}
                  </span>
                  <span className="text-zinc-400">
                    {Math.round(
                      (status.currentStep / Math.max(1, status.totalSteps)) *
                        100
                    )}
                    % del ciclo
                  </span>
                </div>
                <div className="w-full h-2.5 bg-zinc-950 border border-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-75"
                    style={{
                      width: `${(status.currentStep / Math.max(1, status.totalSteps)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Transport Deck Buttons (Prev, Play, Pause, Stop, Next) */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  data-testid="soundtest-prev"
                  onClick={handlePrevTrack}
                  className="flex items-center gap-1 px-3 py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-xs font-arcade font-bold text-zinc-200 cursor-pointer"
                >
                  <SkipBack className="w-4 h-4" />
                  ANTERIOR
                </button>

                <button
                  type="button"
                  data-testid="soundtest-play"
                  onClick={handlePlayResume}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-xs font-arcade font-bold cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  REPRODUCIR
                </button>

                <button
                  type="button"
                  data-testid="soundtest-pause"
                  onClick={() => arcadeAudio.pauseMusic()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-arcade font-bold cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                  PAUSAR
                </button>

                <button
                  type="button"
                  data-testid="soundtest-stop"
                  onClick={() => arcadeAudio.stopMusic()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-arcade font-bold cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                  DETENER
                </button>

                <button
                  type="button"
                  data-testid="soundtest-next"
                  onClick={handleNextTrack}
                  className="flex items-center gap-1 px-3 py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-xs font-arcade font-bold text-zinc-200 cursor-pointer"
                >
                  SIGUIENTE
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 5-Channel Virtual 8-Bit Heavy Metal Instrument VU Meters */}
            <div className="bg-zinc-900 border border-zinc-800 p-3.5 space-y-2">
              <div className="text-xs font-mono-num text-amber-400 font-bold">
                CANALES DEL SINTETIZADOR HEAVY METAL 8-BIT EN VIVO:
              </div>
              {(
                [
                  [
                    '1. GUITARRA RÍTMICA 8-BIT (Pulse 25% + Quinta + Palm Mute)',
                    status.channelActivity.rhythm,
                    'bg-amber-400',
                  ],
                  [
                    '2. GUITARRA SOLISTA 8-BIT (Lead Pulse + Vibrato LFO + Bends)',
                    status.channelActivity.lead,
                    'bg-rose-400',
                  ],
                  [
                    '3. GUITARRA GEMELA ARMONIZADA (3ras / 6tas Estilo Maiden)',
                    status.channelActivity.harmony,
                    'bg-sky-400',
                  ],
                  [
                    '4. BAJO ELÉCTRICO 8-BIT (Triangle Wave + Galope Metálico)',
                    status.channelActivity.bass,
                    'bg-emerald-400',
                  ],
                  [
                    '5. BATERÍA HEAVY METAL (Doble Bombo + Redoblante + Toms)',
                    status.channelActivity.drums,
                    'bg-purple-400',
                  ],
                ] as const
              ).map(([label, val, colorClass]) => (
                <div key={label} className="space-y-0.5">
                  <div className="flex justify-between text-[11px] font-mono-num text-zinc-300">
                    <span>{label}</span>
                    <span>{Math.round(val * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-950 overflow-hidden">
                    <div
                      className={`h-full ${colorClass} transition-all duration-75`}
                      style={{ width: `${Math.round(val * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Real-Time Audio & Synthesizer Controls */}
            <div className="bg-zinc-900 border border-zinc-800 p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-mono-num">
                  <span className="text-zinc-300 flex items-center gap-1.5">
                    {options.musicEnabled ? (
                      <Volume2 className="w-4 h-4 text-amber-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    )}
                    Volumen Música: {options.musicVolume}%
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateOptions((prev) => ({
                        ...prev,
                        musicEnabled: !prev.musicEnabled,
                      }))
                    }
                    className={`px-2 py-0.5 text-[10px] font-arcade font-bold border cursor-pointer ${
                      options.musicEnabled
                        ? 'bg-emerald-400 text-zinc-950 border-emerald-200'
                        : 'bg-rose-950 text-rose-200 border-rose-500'
                    }`}
                  >
                    {options.musicEnabled ? 'MÚSICA ON' : 'MÚSICA OFF'}
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={options.musicVolume}
                  onChange={(e) =>
                    onUpdateOptions((prev) => ({
                      ...prev,
                      musicVolume: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-sky-400" />
                    Modo Timbre 8-Bit:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateOptions((prev) => ({
                        ...prev,
                        chipMode8Bit:
                          prev.chipMode8Bit === 'metal_overdrive'
                            ? 'nes_pure'
                            : 'metal_overdrive',
                      }))
                    }
                    className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-800 border border-sky-400/60 text-sky-300 font-arcade font-bold text-[11px] cursor-pointer"
                  >
                    {options.chipMode8Bit === 'metal_overdrive'
                      ? '8-BIT METAL OVERDRIVE'
                      : 'NES PURO 8-BIT'}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    Prueba Vida Crítica (&lt;20% HP):
                  </span>
                  <button
                    type="button"
                    data-testid="toggle-critical-intensity"
                    onClick={() =>
                      arcadeAudio.setCriticalHealthMode(
                        !status.criticalHealthMode
                      )
                    }
                    className={`px-2.5 py-1 font-arcade font-bold text-[11px] border cursor-pointer ${
                      status.criticalHealthMode
                        ? 'bg-rose-500 text-white border-rose-300'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-700'
                    }`}
                  >
                    {status.criticalHealthMode
                      ? 'INTENSIDAD CRÍTICA ACTIVA'
                      : 'INTENSIDAD NORMAL'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
