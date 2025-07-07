import { mkdir } from 'node:fs/promises';
import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { join } from 'node:path';
import { node } from '@elysiajs/node'
import { AudioQueue } from './player/audio-queue.js';
import Player from './player/audio-player.js';
import { StreamElementsProvider } from './tts-provider.js';
import { streamElementsVoices } from './constants/voices.js';

// --- Constantes y Configuración Inicial ---
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const OUTPUT_DIR = join(process.cwd(), 'audio_outputs');

// --- Inicialización de Módulos ---
const player = new Player(AudioQueue);
const ttsProvider = new StreamElementsProvider();

// --- Manejo de Eventos del Reproductor (con tipos) ---
player.on('start', (data: { track: string }) => console.log(`[Player Event] Start: ${data.track}`));
player.on('end', (data: { track: string }) => {
    console.log(`[Player Event] End: ${data.track}. Checking queue.`);
    if (AudioQueue.list().length > 0) {
        player.play();
    }
});
player.on('error', (error: Error) => console.error('[Player Event] Error:', error.message));

// --- Esquema de Validación para el cuerpo de la petición ---
const VoiceNameEnum = streamElementsVoices.reduce((acc, name) => {
    acc[name] = name;
    return acc;
}, {} as Record<string, string>);

const GenerateAudioBody = t.Object({
    text: t.String({ minLength: 1, maxLength: 500, error: "El texto es requerido." }),
    voice: t.Optional(t.Enum(VoiceNameEnum, { error: "La voz no es válida." }))
});

// --- Creación de la aplicación Elysia ---
const app = new Elysia({adapter:node()})
    .use(cors())
    .onStart(async () => {
        try {
            await mkdir(OUTPUT_DIR, { recursive: true });
            console.log(`✅ Directorio de salida '${OUTPUT_DIR}' está listo.`);
        } catch (error) {
            console.error(`❌ Fallo al crear el directorio de salida`, error);
            process.exit(1);
        }
    })
    .onError(({ code, error, set }) => {
      //@ts-ignore
        console.error(`❌ Error [${code}]:`, error.message);
        if (code === 'VALIDATION') {
            set.status = 400;
            return { error: "Petición inválida", details: JSON.parse(error.message) };
        }
        set.status = 500;
        return { error: 'Error Interno del Servidor' };
    })
    .get('/', () => 'TTS API Server is running.')
    .get('/api/voices', () => ({
        count: streamElementsVoices.length,
        voices: streamElementsVoices
    }))
    .post('/api/generate-audio', async ({ body, set, request }) => {
        const { text, voice } = body;
        console.log(`🔊 Petición de generación. Texto: "${text}", Voz: ${voice || 'default'}`);

        const filename = `audio_${Date.now()}.mp3`;
        const outputFilePath = join(OUTPUT_DIR, filename);

        try {
            await ttsProvider.generateAudioFile(text, outputFilePath, { voiceName: voice });
            AudioQueue.add(outputFilePath);
            if (!player.isPlaying) player.play();

            const host = request.headers.get('host') ?? `localhost:${PORT}`;
            const protocol = host.includes('localhost') ? 'http' : 'https';
            const playbackUrl = `${protocol}://${host}/api/audio/${filename}`;

            set.status = 201;
            return {
                success: true,
                message: 'Audio generado y añadido a la cola.',
                file: filename,
                playbackUrl,
            };
        } catch (error) {
            set.status = 500;
            return { success: false, message: 'Fallo al generar el audio.', error: (error as Error).message };
        }
    }, {
        body: GenerateAudioBody
    })
    .get('/api/player/status', () => ({
        isPlaying: player.isPlaying,
        currentTrack: player.currentTrack,
        queue: AudioQueue.list()
    }))
    .get('/api/player/skip', () => {
        player.skip();
        return { message: 'Saltando al siguiente audio...' };
    })
    .listen(PORT, () => {
        console.log(`🚀 TTS API server está escuchando en http://localhost:${PORT}`);
    });