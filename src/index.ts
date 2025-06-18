import { Elysia, t,file } from 'elysia';
import { node } from '@elysiajs/node'
import { generateAudio, type GenerateAudioOptions } from './tts.module'; // Asegúrate de que la ruta sea correcta
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { AudioQueue, player } from './audio-control';

// --- Constantes y Configuración Inicial ---
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = join(process.cwd(), 'audio_outputs');

// --- Esquema de Validación para el cuerpo de la petición (reemplaza la interfaz) ---
const GenerateAudioBody = t.Object({
  text: t.String({ minLength: 1, error: "El campo 'text' es requerido y no puede estar vacío." }),
  speakers: t.Optional(
    t.Array(
      t.Object({
        speaker: t.String(),
        voiceName: t.String(),
      })
    )
  ),
});

// Asegurarse de que el directorio de salida exista antes de iniciar el servidor
(async () => {
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`✅ Directorio de salida '${OUTPUT_DIR}' está listo.`);
  } catch (error) {
    console.error(`❌ Fallo al crear el directorio de salida: ${OUTPUT_DIR}`, error);
    process.exit(1);
  }
})();


// --- Creación de la aplicación Elysia ---
const app = new Elysia({ adapter: node() })
  // Hook para manejar errores de forma centralizada
  .onError(({ code, error, set }) => {
    console.error(`❌ Error en el servidor [${code}]:`, error);
    
    // Errores de validación de Elysia
    if (code === 'VALIDATION') {
      set.status = 400;
      return {
        error: "Petición inválida",
        details: error.message.toString()
      };
    }
    
    // Errores internos del servidor
    set.status = 500;
    return { error: 'Error Interno del Servidor'};
  })

  // Ruta principal para verificar que el servidor está vivo
  .get('/', () => 'TTS API Server is running.')

  // Endpoint para generar el audio (POST)
  .post('/api/generate-audio', async ({ body, request, set }) => {
    const { text, speakers } = body;

    if (speakers && speakers.length > 0) {
      console.log("🔊 Petición multi-speaker recibida.");
    }
    
    const filename = `audio_${Date.now()}.wav`;
    const outputFilePath = join(OUTPUT_DIR, filename);

    const options: GenerateAudioOptions = {
      text: text,
      outputFilename: outputFilePath,
      speakers: speakers,
    };

    await generateAudio(options);

    const origin = new URL(request.url).origin;
    const playbackUrl = `${origin}/api/audio/${filename}`;

    // Establecer el código de estado a 201 (Created)
    set.status = 201;
    //AudioQueue.add(playbackUrl);
    console.log({
      filename,
      playbackUrl
    })
    return {
      message: '¡Audio generado con éxito!',
      file: filename,
      playbackUrl: playbackUrl,
    };
  }, {
    // Aquí se aplica la validación automática del cuerpo de la petición
    body: GenerateAudioBody
  })

  // Endpoint para servir/reproducir archivos de audio (GET con parámetro)
  .get('/api/audio/:filename', ({ params, set }) => {
    const { filename } = params;

    // Medida de seguridad: Prevenir 'Path Traversal'
    if (filename.includes('..')) {
      set.status = 400;
      return { error: 'Nombre de archivo inválido' };
    }

    const filePath = join(OUTPUT_DIR, filename);

    if (!existsSync(filePath)) {
      set.status = 404;
      return { error: 'Archivo no encontrado' };
    }

    // Añadir a la cola de reproducción
    AudioQueue.add(filePath);
    console.log(`▶️ Archivo '${filename}' añadido a la cola y servido.`);

    // Servir el archivo. Elysia se encarga de las cabeceras 'Content-Type'.
    return file(filePath)
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
  .listen(PORT);
const localaudioPath = join(process.cwd(),'audio_outputs')
function joinPath(basepath:string,...paths:string[]){
  return join(basepath,...paths)
}
AudioQueue.add(joinPath(localaudioPath,'audio_1750218178225.wav'));
AudioQueue.add(joinPath(localaudioPath,'audio_1750219520892.wav'));
player.play()
console.log(`🚀 TTS API server está escuchando en http://localhost:${app.server?.port}`);