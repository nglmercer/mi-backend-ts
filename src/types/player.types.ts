import type Speaker from 'speaker';
import type { FfmpegCommand } from 'fluent-ffmpeg';

// Interfaz para el objeto que exporta audio-queue.ts
export interface IAudioQueue {
  add: (filePath: string) => void;
  getNext: () => string | undefined;
  list: () => string[];
  clear: () => void;
}

// Interfaces para los datos de ffprobe
export interface FfprobeStream {
  codec_type: 'audio' | 'video' | string;
  channels: number;
  sample_rate: string;
  bits_per_sample?: number;
}

export interface FfprobeData {
  streams: FfprobeStream[];
}

// Tipos para las opciones de TTS
export type TTSVoice = { name: string, lang?: string, default?: boolean };
export type TTSSpeakOptions = { voiceName?: string };