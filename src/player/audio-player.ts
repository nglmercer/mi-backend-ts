// src/audio-player.ts - Versión corregida con node-lame
import fs from 'fs';
import { EventEmitter } from 'events';
import Speaker from 'speaker';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static'; // Importa la ruta al binario de ffmpeg
import ffprobePath from 'ffprobe-static'; // <-- CORRECCIÓN 1: Importar ffprobe-static
import { type IAudioQueue } from './audio-queue.js';

// Establece las rutas para que fluent-ffmpeg sepa dónde encontrarlas
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath) {
  // <-- CORRECCIÓN 2: Establecer la ruta de ffprobe
  ffmpeg.setFfprobePath(ffprobePath.path); 
}
// Interfaz para la información del stream obtenida con ffprobe
interface FfprobeData {
  streams: Array<{
    codec_type: string;
    channels: number;
    sample_rate: string;
    bits_per_sample?: number; // Puede no estar para todos los formatos
  }>;
}


interface AudioFormat {
  channels: number;
  bitDepth: number;
  sampleRate: number;
}

class Player extends EventEmitter {
  private audioQueue: IAudioQueue;

  public isPlaying: boolean = false;
  public isPaused: boolean = false; // La pausa es más compleja con ffmpeg, la manejaremos como 'stop'
  public currentTrack: string | null = null;
  public pausedTime: number = 0;
  // En lugar de decoder y readStream, ahora tendremos un comando de ffmpeg
  private ffmpegCommand: ffmpeg.FfmpegCommand | null = null;
  private speaker: Speaker | null = null;

  private startTime: number = 0;
  private progressInterval: NodeJS.Timeout | null = null;

  constructor(audioQueue: IAudioQueue) {
    super();
    this.audioQueue = audioQueue;
  }

  public async play(filePath?: string): Promise<void> {
    if (this.isPlaying) {
      console.log('[Player] A track is already playing. Stop it first.');
      return;
    }

    const trackToPlay = filePath || this.audioQueue.getNext();
    if (!trackToPlay) {
      this.emit('queue-end');
      return;
    }

    this._cleanup(); // Limpia recursos anteriores

    if (!fs.existsSync(trackToPlay)) {
      console.error(`[Player] Error: File not found at ${trackToPlay}`);
      this.emit('error', new Error(`File not found: ${trackToPlay}`));
      this.play(); // Intenta con el siguiente en la cola
      return;
    }

    this.currentTrack = trackToPlay;
    this.isPlaying = true;
    this.isPaused = false;

    try {
      console.log(`[Player] Probing audio format for: ${this.currentTrack}`);
      
      // 1. Usar ffprobe (incluido en fluent-ffmpeg) para obtener el formato del audio
      const metadata = await this.getAudioMetadata(this.currentTrack);
      
      console.log('[Player] Audio format detected:', metadata);

      // 2. Crear el Speaker con el formato correcto
      this.speaker = new Speaker({
        channels: metadata.channels,
        bitDepth: metadata.bitDepth,
        sampleRate: metadata.sampleRate,
      });

      this.speaker.on('open', () => {
        console.log(`[Player] Speaker opened for: ${this.currentTrack}`);
        this.startTime = Date.now();
        this.emit('start', { track: this.currentTrack });
        this._startProgressTracker();
      });

      this.speaker.on('close', () => {
        console.log(`[Player] Speaker closed.`);
        // El 'close' del speaker a menudo indica el final de la pista
        this._handleTrackEnd();
      });

      // 3. Crear el comando ffmpeg
      console.log(`[Player] Starting playback: ${this.currentTrack}`);
      this.ffmpegCommand = ffmpeg(this.currentTrack)
        // Forzar la salida a PCM de 16-bit, que es lo que espera Speaker
        .toFormat('s16le')
        .audioChannels(metadata.channels)
        .audioFrequency(metadata.sampleRate)
        .on('error', (err) => {
          console.error('[Player] FFmpeg error:', err.message);
          this.emit('error', err);
          this._cleanup();
        })
        // El evento 'end' de ffmpeg también nos sirve para saber que terminó
        .on('end', () => {
            console.log(`[Player] FFmpeg finished processing: ${this.currentTrack}`);
        });

      // 4. Conectar la salida de ffmpeg directamente al speaker
      this.ffmpegCommand.pipe(this.speaker, { end: true });

    } catch (error) {
      console.error('[Player] Error starting playback:', error);
      this.emit('error', error);
      this._cleanup();
    }
  }
  public pause(): void {
    console.warn("[Player] Pause is not fully supported with ffmpeg. Use stop() instead.");
    this.stop();
  }

  public resume(): void {
     return this.pause();
  }
  
  public stop(): void {
    if (!this.isPlaying) return;
    
    console.log('[Player] Stopping playback...');
    this.emit('stop', { track: this.currentTrack });
    this._cleanup();
  }


  public skip(): void {
    console.log('[Player] Skipping track...');
    this.stop();
    setTimeout(() => this.play(), 100); // Pequeña pausa antes del siguiente track
  }
  // Método auxiliar para obtener metadatos del archivo de audio con ffprobe
  private getAudioMetadata(filePath: string): Promise<{ channels: number; sampleRate: number; bitDepth: number; }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data: FfprobeData | any) => {
        if (err) {
          return reject(err);
        }
        const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');
        if (!audioStream) {
          return reject(new Error('No audio stream found in file'));
        }
        resolve({
          channels: audioStream.channels,
          sampleRate: parseInt(audioStream.sample_rate, 10),
          // Speaker generalmente funciona con 16-bit. Si no se especifica, es un valor seguro.
          bitDepth: audioStream.bits_per_sample || 16,
        });
      });
    });
  }
  // Método para obtener información del track actual
  public getCurrentProgress(): number {
    if (!this.isPlaying) return 0;
    if (this.isPaused) return this.pausedTime / 1000;
    return (Date.now() - this.startTime) / 1000;
  }

  // Método para verificar si hay un track cargado
  public hasTrack(): boolean {
    return this.currentTrack !== null;
  }

  private _startProgressTracker(): void {
    this._stopProgressTracker();
    this.progressInterval = setInterval(() => {
      if (this.isPlaying && !this.isPaused) {
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;
        this.emit('progress', { 
          track: this.currentTrack, 
          elapsed: elapsedSeconds 
        });
      }
    }, 1000);
  }

  private _stopProgressTracker(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private _handleTrackEnd(): void {
    const finishedTrack = this.currentTrack;
    
    // Esperar un poco para que termine la reproducción
    setTimeout(() => {
      if (finishedTrack === this.currentTrack) {
        console.log(`[Player] Track finished: ${finishedTrack}`);
        this._cleanup();
        this.emit('end', { track: finishedTrack });
        
        // Auto-play siguiente track si hay cola
        if (this.audioQueue.getNext()){
          setTimeout(() => this.play(), 500);
        }
      }
    }, 300);
  }

  private _cleanup(): void {
    console.log('[Player] Cleaning up resources...');
    
    this._stopProgressTracker();
    
    // Detener el proceso de ffmpeg si está en ejecución
    if (this.ffmpegCommand) {
      this.ffmpegCommand.kill('SIGKILL'); // Usamos SIGKILL para asegurar que se detiene
      this.ffmpegCommand = null;
    }
    
    if (this.speaker) {
      this.speaker.end();
      this.speaker = null;
    }
    
    this.currentTrack = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.startTime = 0;
  }

  // Método para limpiar recursos al destruir la instancia
  public destroy(): void {
    console.log('[Player] Destroying player...');
    this._cleanup();
    this.removeAllListeners();
  }
}

export default Player;