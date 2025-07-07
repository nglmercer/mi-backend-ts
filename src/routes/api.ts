// src/routes/api.ts

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { join } from 'node:path';

// Importamos solo lo que necesitamos para las rutas
import { AudioQueue } from '../player/audio-queue.js';
import { streamElementsVoices } from '../constants/voices.js';

// --- Esquema e Interfaz (específicos de estas rutas) ---
const generateAudioBodySchema = {
  type: 'object',
  required: ['text'],
  properties: {
    text: { type: 'string', minLength: 1, maxLength: 500 },
    voice: { type: 'string', enum: streamElementsVoices },
  },
};

interface GenerateAudioBody {
  text: string;
  voice?: string;
}

// --- Definición del Plugin (Router) ---
// Usamos FastifyPluginAsync para poder usar `async/await`
const apiRouter: FastifyPluginAsync = async (fastify, opts) => {
  // GET /api/voices
  fastify.get('/voices', async (request, reply) => {
    return {
      count: streamElementsVoices.length,
      voices: streamElementsVoices,
    };
  });

  // POST /api/generate-audio
  fastify.post<{ Body: GenerateAudioBody }>('/generate-audio', {
    schema: {
      body: generateAudioBodySchema,
    },
  }, async (request, reply) => {
    const { text, voice } = request.body;
    fastify.log.info(`🔊 Petición de generación. Texto: "${text}", Voz: ${voice || 'default'}`);

    // Accedemos a las dependencias a través de la instancia `fastify` decorada
    const { ttsProvider, player, outputDir } = fastify;

    const filename = `audio_${Date.now()}.mp3`;
    const outputFilePath = join(outputDir, filename);

    try {
      await ttsProvider.generateAudioFile(text, outputFilePath, { voiceName: voice });
      AudioQueue.add(outputFilePath);
      if (!player.isPlaying) player.play();

      const playbackUrl = `${request.protocol}://${request.hostname}/api/audio/${filename}`; // (Nota: Necesitarás una ruta para servir este audio)

      reply.code(201).send({
        success: true,
        message: 'Audio generado y añadido a la cola.',
        file: filename,
        playbackUrl,
      });
    } catch (error) {
      reply.code(500).send({
        success: false,
        message: 'Fallo al generar el audio.',
        error: (error as Error).message,
      });
    }
  });

  // GET /api/player/status
  fastify.get('/player/status', async (request, reply) => {
    const { player } = fastify;
    return {
      isPlaying: player.isPlaying,
      currentTrack: player.currentTrack,
      queue: AudioQueue.list(),
    };
  });

  // GET /api/player/skip
  fastify.get('/player/skip', async (request, reply) => {
    fastify.player.skip();
    return { message: 'Saltando al siguiente audio...' };
  });
};

// Exportamos el plugin para que pueda ser registrado en la app principal
export default apiRouter;