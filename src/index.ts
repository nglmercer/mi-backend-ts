// src/index.ts

import { mkdir } from 'node:fs/promises';
import { Elysia, t, file } from 'elysia';
import { node } from '@elysiajs/node'
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { generateAudio, type GenerateAudioOptions } from './tts.module.js';
import { AudioQueue, player } from './player/audio-control.js';
import 'dotenv/config';
import {
  TTS_VOICE_NAMES,
  TTS_VOICE_CHARACTERISTICS
} from './constants/voices.js';

// --- Constantes y Configuración Inicial ---
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = join(process.cwd(), 'audio_outputs');

// --- INICIO DE LA CORRECCIÓN ---

// t.Enum necesita un objeto (Record<string, string>), no un array de strings.
// Transformamos el array ['Zephyr', 'Puck'] en un objeto { Zephyr: 'Zephyr', Puck: 'Puck' }
const VoiceNameEnum = TTS_VOICE_NAMES.reduce((acc, name) => {
  acc[name] = name;
  return acc;
}, {} as Record<string, string>);

// --- FIN DE LA CORRECCIÓN ---


// --- Esquema de Validación para el cuerpo de la petición (CORREGIDO) ---
const GenerateAudioBody = t.Object({
  text: t.String({ minLength: 1, error: "El campo 'text' es requerido y no puede estar vacío." }),
  speakers: t.Optional(
    t.Array(
      t.Object({
        speaker: t.String(),
        // Ahora usamos el objeto VoiceNameEnum que acabamos de crear
        voiceName: t.Enum(VoiceNameEnum, { error: "El 'voiceName' proporcionado no es válido." }),
      })
    )
  ),
});

// Asegurarse de que el directorio de salida exista antes de iniciar el servidor
// (El resto del archivo no necesita cambios)
try {
  mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`✅ Directorio de salida '${OUTPUT_DIR}' está listo.`);
} catch (error) {
  console.error(`❌ Fallo al crear el directorio de salida: ${OUTPUT_DIR}`, error);
  process.exit(1);
}

// --- Creación de la aplicación Elysia ---
const app = new Elysia({adapter:node()})
  // Hook para manejar errores de forma centralizada
  .onError(({ code, error, set }) => {
    console.error(`❌ Error en el servidor [${code}]:`, error);
    
    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        error: "Petición inválida",
        details: JSON.parse(error.message)
      };
    }
    
    set.status = 500;
    return { error: 'Error Interno del Servidor' };
  })

  // Ruta principal para verificar que el servidor está vivo
  .get('/', () => 'TTS API Server is running.')

  // Ruta para obtener la lista de voces disponibles
  .get('/api/voices', () => {
    const availableVoices = TTS_VOICE_NAMES.map(name => ({
      name: name,
      characteristic: TTS_VOICE_CHARACTERISTICS[name] || 'No especificada'
    }));
    return {
      count: availableVoices.length,
      voices: availableVoices
    };
  })

  // Endpoint para generar el audio (POST)
  .post('/api/generate-audio', async ({ body, set, request }) => {
    const { text, speakers } = body;

    console.log("🔊 Petición de generación de audio recibida.",text,speakers);
    if (!speakers || !Array.isArray(speakers)) {
      return {
        success:false,
        message: "utilize una de las siguientes voces"+JSON.stringify(TTS_VOICE_NAMES)
      }
    }
    
    const filename = `audio_${Date.now()}.wav`;
    const outputFilePath = join(OUTPUT_DIR, filename);

    const options: GenerateAudioOptions = {
      text: text,
      outputFilename: outputFilePath,
      speakers: speakers,
    };

    await generateAudio(options);

    const origin = request.headers.get('origin') || `http://${request.headers.get('host')}`;
    const playbackUrl = `${origin}/api/audio/${filename}`;

    set.status = 201;
    
    console.log(`✅ Audio generado: ${filename}`);
    const filePath = join(OUTPUT_DIR, filename);
    AudioQueue.add(filePath);
    if (!player.isPlaying) player.play();
    return {
      message: '¡Audio generado con éxito!',
      file: filename,
      playbackUrl: playbackUrl,
    };
  }, {
    body: GenerateAudioBody
  })

  // Endpoint para servir/reproducir archivos de audio
  .get('/api/audio/:filename', ({ params, set }) => {
    const { filename } = params;

    if (filename.includes('..')) {
      set.status = 400;
      return { error: 'Nombre de archivo inválido' };
    }

    const filePath = join(OUTPUT_DIR, filename);

    if (!existsSync(filePath)) {
      set.status = 404;
      return { error: 'Archivo no encontrado' };
    }

    AudioQueue.add(filePath);
    console.log(`▶️ Archivo '${filename}' añadido a la cola y servido al cliente.`);
    
    return file(filePath);
  })

  // Endpoints de control del reproductor
  .get('/api/play', () => {
    player.play();
    return { message: 'Iniciando reproducción...' };
  })
  
  .get('/api/next', () => {
    player.skip();
    return { message: 'Saltando al siguiente audio...' };
  })
  
  // Iniciar el servidor
  .listen(PORT, (server) => {
    console.log(`🚀 TTS API server está escuchando en http://${server.hostname}:${server.port}`,server.url);
  });