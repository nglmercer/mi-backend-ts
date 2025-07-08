// src/app.ts

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { Player, AudioQueue } from 'ffmpeg-audio-player';
// Tus módulos de negocio no cambian
import { StreamElementsProvider } from './tts-provider.js';

// Nuestro nuevo router
import apiRouter from './routes/api.js';

// --- Constantes y Configuración Inicial ---
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const OUTPUT_DIR = join(process.cwd(), 'audio_outputs');

// --- Declaración de Tipos para los Decorators (¡Importante para TypeScript!) ---
// Esto le dice a TypeScript que nuestra instancia de Fastify tendrá estas propiedades.
declare module 'fastify' {
  export interface FastifyInstance {
    player: Player;
    ttsProvider: StreamElementsProvider;
    outputDir: string;
  }
}

// --- Creación de la aplicación Fastify ---
const app: FastifyInstance = Fastify({
  logger: true,
});

// --- Inicialización de Módulos ---
const player = new Player(AudioQueue,{ forceNativeFFmpeg: true });
const ttsProvider = new StreamElementsProvider();

// --- Decorators (Inyección de Dependencias de Fastify) ---
// "Decoramos" la instancia de Fastify con nuestros módulos.
// Ahora, cualquier ruta o plugin registrado después de esto tendrá acceso
// a `fastify.player`, `fastify.ttsProvider`, etc.
app.decorate('player', player);
app.decorate('ttsProvider', ttsProvider);
app.decorate('outputDir', OUTPUT_DIR);

// --- Registro de Plugins (Middleware) ---
app.register(fastifyCors);

// --- Registro de Rutas ---
// Ruta raíz, se queda en el archivo principal
app.get('/', async (request, reply) => {
  return 'TTS API Server is running.';
});

// ¡Aquí está la magia! Registramos nuestro router de la API.
// Todas las rutas dentro de `apiRouter` tendrán el prefijo `/api`.
// Por ejemplo, `/voices` en el router se convierte en `/api/voices`.
app.register(apiRouter, { prefix: '/api' });

// --- Manejador de Errores Global ---
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);
  if (error.validation) {
    reply.status(400).send({
      error: 'Petición inválida',
      details: error.validation,
    });
    return;
  }
  reply.status(500).send({ error: 'Error Interno del Servidor' });
});

// --- Función para iniciar el servidor ---
const start = async () => {
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`✅ Directorio de salida '${OUTPUT_DIR}' está listo.`);

    await app.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();