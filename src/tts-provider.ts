import { writeFile } from 'node:fs/promises';
import { streamElementsVoices } from './constants/voices.js';
import type { TTSVoice, TTSSpeakOptions } from './types/player.types.js';

// --- Interfaces de Configuración ---
interface TTSConfig {
  [key: string]: any;
}

interface StreamElementsConfig extends TTSConfig {
  defaultVoice: string;
}

// --- Clases ---
class TTSProvider {
    protected cfg: TTSConfig;

    constructor(cfg: TTSConfig = {}) {
        this.cfg = cfg;
    }
    isAvailable(): boolean { return false; }
    getVoices(): TTSVoice[] { return []; }
    async generateAudioFile(text: string, filePath: string, opts: TTSSpeakOptions = {}): Promise<void> {
        throw new Error(`'generateAudioFile' not implemented in ${this.constructor.name}`);
    }
}

const defaultSeCfg: StreamElementsConfig = {
    defaultVoice: "Brian",
};

export class StreamElementsProvider extends TTSProvider {
    protected cfg: StreamElementsConfig;
    private readonly endpoint: string = "https://api.streamelements.com/kappa/v2/speech";

    constructor(cfg: Partial<StreamElementsConfig> = {}) {
        super({ ...defaultSeCfg, ...cfg });
        this.cfg = { ...defaultSeCfg, ...cfg };
        console.log(`StreamElementsProvider initialized with cfg:`, this.cfg);
    }

    isAvailable(): boolean {
        return true;
    }

    getVoices(): TTSVoice[] {
        return streamElementsVoices.map(name => ({ name }));
    }

    private _getFinalOpts(opts: TTSSpeakOptions = {}): Required<TTSSpeakOptions> {
        return {
            voiceName: opts.voiceName ?? this.cfg.defaultVoice,
        };
    }

    async generateAudioFile(text: string, filePath: string, opts: TTSSpeakOptions = {}): Promise<void> {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return Promise.reject(new Error("El texto no puede estar vacío"));
        }

        const finalOpts = this._getFinalOpts(opts);
        const params = new URLSearchParams({ voice: finalOpts.voiceName, text: text.trim() });
        const reqUrl = `${this.endpoint}?${params.toString()}`;

        console.log(`[TTS] Solicitando audio a StreamElements para: "${text}" con voz: ${finalOpts.voiceName}`);

        try {
            const resp = await fetch(reqUrl);
            if (!resp.ok) {
                throw new Error(`Error en la API de StreamElements: ${resp.status} ${resp.statusText}`);
            }

            const audioArrayBuffer = await resp.arrayBuffer();
            const audioBuffer = Buffer.from(audioArrayBuffer);

            await writeFile(filePath, audioBuffer);
            console.log(`[TTS] Archivo de audio guardado en: ${filePath}`);
        } catch (err) {
            const error = err as Error;
            console.error("[TTS] Error generando el archivo de audio:", error.message);
            throw error;
        }
    }
}