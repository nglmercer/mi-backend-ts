import { GoogleGenAI } from '@google/genai';
import wav from 'wav';
import { Buffer } from 'buffer';
import { promises as fs } from 'fs';
import path from 'path';
import {
  type TTSVoiceName,
  TTS_VOICE_NAMES,
  TTS_VOICE_CHARACTERISTICS
} from './constants/voices.js'

// Interfaz mejorada con validaciones opcionales
export interface GenerateAudioOptions {
  text: string;
  outputFilename: string;
  model?: string;
  speakers?: {
    speaker: string;
    voiceName: TTSVoiceName;
  }[];
  cleanupOnError?: boolean;
}

// Interfaz para chunks internos
interface AudioChunk {
  text: string;
  speakers: { speaker: string; voiceName: TTSVoiceName; }[];
  index: number;
}

/**
 * Función auxiliar mejorada para guardar archivos .wav
 * Simplificada basada en los ejemplos proporcionados
 */
async function saveWaveFile(
  filename: string, 
  pcmData: Buffer,
  channels: number = 1,
  rate: number = 24000,
  sampleWidth: number = 2
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Crear directorio si no existe
      const dir = path.dirname(filename);
      fs.mkdir(dir, { recursive: true }).catch(() => {}); // Ignorar si ya existe
      
      const writer = new wav.FileWriter(filename, {
        channels,
        sampleRate: rate,
        bitDepth: sampleWidth * 8,
      });
      
      writer.on('finish', resolve);
      writer.on('error', reject);
      
      writer.write(pcmData);
      writer.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Validar texto de entrada
 */
function validateText(text: string): void {
  if (!text || text.trim().length === 0) {
    throw new Error('El texto no puede estar vacío');
  }
  
  if (text.length > 50000) { // Límite razonable
    throw new Error('El texto es demasiado largo (máximo 50,000 caracteres)');
  }
}

/**
 * Validar configuración de speakers
 */
function validateSpeakers(speakers: { speaker: string; voiceName: TTSVoiceName; }[]): void {
  if (!speakers || speakers.length === 0) return;
  
  const speakerNames = new Set<string>();
  for (const speaker of speakers) {
    if (!speaker.speaker || !speaker.voiceName) {
      throw new Error('Cada speaker debe tener "speaker" y "voiceName" definidos');
    }
    
    if (speakerNames.has(speaker.speaker)) {
      throw new Error(`Speaker duplicado encontrado: ${speaker.speaker}`);
    }
    
    speakerNames.add(speaker.speaker);
  }
}

/**
 * Divide el texto y speakers en chunks que contengan máximo 2 speakers únicos
 */
function chunkTextBySpeakers(
  text: string, 
  speakers: { speaker: string; voiceName: TTSVoiceName; }[]
): AudioChunk[] {
  const chunks: AudioChunk[] = [];
  
  // Extraer todas las partes del texto con sus speakers
  const parts = text.split(/(\[[\w\s]+\])/).filter(part => part.trim() !== '');
  
  if (parts.length === 0) {
    return [{
      text: text,
      speakers: speakers.slice(0, 2), // Máximo 2 speakers
      index: 0
    }];
  }
  
  let currentChunk = { 
    text: '', 
    speakers: new Set<string>(), 
    speakerConfigs: [] as { speaker: string; voiceName: TTSVoiceName; }[] 
  };
  
  for (const part of parts) {
    const speakerMatch = part.match(/\[(\w+)\]/);
    
    if (speakerMatch) {
      const speakerName = speakerMatch[1];
      const speakerConfig = speakers.find(s => s.speaker === speakerName);
      
      if (speakerConfig) {
        // Si agregar este speaker excedería el límite de 2, crear nuevo chunk
        if (!currentChunk.speakers.has(speakerName) && currentChunk.speakers.size >= 2) {
          // Guardar chunk actual si tiene contenido válido
          if (currentChunk.text.trim() && currentChunk.speakerConfigs.length > 0) {
            chunks.push({
              text: currentChunk.text.trim(),
              speakers: [...currentChunk.speakerConfigs],
              index: chunks.length
            });
          }
          
          // Iniciar nuevo chunk
          currentChunk = { 
            text: '', 
            speakers: new Set<string>(), 
            speakerConfigs: [] 
          };
        }
        
        // Agregar speaker al chunk actual
        if (!currentChunk.speakers.has(speakerName)) {
          currentChunk.speakers.add(speakerName);
          currentChunk.speakerConfigs.push(speakerConfig);
        }
      }
    }
    
    currentChunk.text += part;
  }
  
  // Agregar último chunk si tiene contenido
  if (currentChunk.text.trim()) {
    chunks.push({
      text: currentChunk.text.trim(),
      speakers: [...currentChunk.speakerConfigs],
      index: chunks.length
    });
  }
  
  return chunks.length > 0 ? chunks : [{
    text: text,
    speakers: speakers.slice(0, 2),
    index: 0
  }];
}

/**
 * Función mejorada para limpiar archivos con mejor manejo de errores
 */
async function cleanupFiles(filePaths: string[]): Promise<void> {
  const cleanupPromises = filePaths.map(async (filePath) => {
    try {
      await fs.unlink(filePath);
      console.log(`🧹 Archivo temporal eliminado: ${filePath}`);
    } catch (error) {
      console.warn(`⚠️ No se pudo eliminar archivo temporal ${filePath}:`, error);
    }
  });
  
  await Promise.allSettled(cleanupPromises);
}

/**
 * Combina múltiples archivos de audio en uno solo
 * Versión corregida que maneja correctamente los headers WAV
 */
async function combineAudioFiles(filePaths: string[], outputPath: string): Promise<void> {
  if (filePaths.length === 0) {
    throw new Error('No hay archivos para combinar');
  }
  
  if (filePaths.length === 1) {
    // Si solo hay un archivo, copiarlo directamente
    await fs.copyFile(filePaths[0], outputPath);
    return;
  }
  
  try {
    const audioDataBuffers: Buffer[] = [];
    let totalDataSize = 0;
    let firstHeader: Buffer | null = null;
    
    // Leer todos los archivos y extraer solo los datos de audio
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      console.log(`📖 Leyendo archivo ${i + 1}/${filePaths.length}: ${filePath}`);
      
      try {
        const fullAudioData = await fs.readFile(filePath);
        
        if (i === 0) {
          // Guardar el header del primer archivo (primeros 44 bytes)
          firstHeader = fullAudioData.slice(0, 44);
          console.log(`📋 Header extraído del primer archivo (${firstHeader.length} bytes)`);
        }
        
        // Extraer solo los datos de audio (después del byte 44)
        const audioData = fullAudioData.slice(44);
        audioDataBuffers.push(audioData);
        totalDataSize += audioData.length;
        
        console.log(`✅ Datos de audio extraídos: ${audioData.length} bytes`);
        
      } catch (error) {
        console.error(`❌ Error leyendo archivo temporal ${filePath}:`, error);
        throw new Error(`Failed to read temporary file: ${filePath}`);
      }
    }
    
    if (!firstHeader) {
      throw new Error('No se pudo extraer el header WAV del primer archivo');
    }
    
    // Actualizar el tamaño del archivo en el header WAV
    // El tamaño total del archivo es: header (44 bytes) + datos de audio
    const totalFileSize = 44 + totalDataSize - 8; // -8 porque el campo de tamaño no incluye los primeros 8 bytes
    const dataChunkSize = totalDataSize;
    
    // Actualizar bytes 4-7 (tamaño total del archivo - 8)
    firstHeader.writeUInt32LE(totalFileSize - 8, 4);
    
    // Actualizar bytes 40-43 (tamaño del chunk de datos)
    firstHeader.writeUInt32LE(dataChunkSize, 40);
    
    console.log(`📊 Header actualizado - Tamaño total: ${totalFileSize + 8} bytes, Datos: ${dataChunkSize} bytes`);
    
    // Combinar header actualizado con todos los datos de audio
    const combinedBuffer = Buffer.concat([firstHeader, ...audioDataBuffers]);
    
    // Escribir el archivo final
    await fs.writeFile(outputPath, combinedBuffer);
    
    console.log(`🎵 Audio combinado exitosamente: ${outputPath} (${combinedBuffer.length} bytes totales)`);
    
  } catch (error) {
    console.error('❌ Error combinando archivos de audio:', error);
    throw error;
  }
}

/**
 * Genera un archivo de audio a partir de texto usando la API de Google Gemini.
 * Versión mejorada siguiendo los ejemplos de GoogleGenAI
 */
export async function generateAudio(options: GenerateAudioOptions): Promise<string> {
  const {
    text,
    outputFilename,
    model = 'gemini-2.5-flash-preview-tts',
    speakers = null,
    cleanupOnError = true
  } = options;

  // Validaciones de entrada
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("La variable de entorno GEMINI_API_KEY no está definida.");
  }

  validateText(text);
  
  if (speakers) {
    validateSpeakers(speakers);
  }

  const tempFiles: string[] = [];
  
  try {
    // Inicializar GoogleGenAI como en los ejemplos
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Si no hay speakers o hay 2 o menos, usar el método original
    if (!speakers || speakers.length <= 2) {
      return await generateSingleAudio(ai, { text, outputFilename, model, speakers });
    }

    // Si hay más de 2 speakers, dividir en chunks
    console.log(`🎭 Detectados ${speakers.length} speakers. Dividiendo en chunks de máximo 2 speakers.`);
    
    const chunks = chunkTextBySpeakers(text, speakers);
    console.log(`📦 Generando ${chunks.length} chunks de audio...`);
    
    // Generar audio para cada chunk con nombres más únicos
    const timestamp = Date.now();
    for (const chunk of chunks) {
      const tempFileName = outputFilename.replace(
        /\.wav$/, 
        `_temp_${timestamp}_${chunk.index}.wav`
      );
      
      console.log(`🎵 Generando chunk ${chunk.index + 1}/${chunks.length}...`);
      
      await generateSingleAudio(ai, {
        text: chunk.text,
        outputFilename: tempFileName,
        model,
        speakers: chunk.speakers
      });
      
      tempFiles.push(tempFileName);
    }
    
    // Combinar todos los archivos temporales
    await combineAudioFiles(tempFiles, outputFilename);
    
    // Limpiar archivos temporales después de combinar exitosamente
    await cleanupFiles(tempFiles);
    
    console.log(`✅ Audio multi-chunk generado exitosamente: ${outputFilename}`);
    return outputFilename;

  } catch (error) {
    console.error("❌ Error durante la generación de audio:", error);
    
    // Limpiar archivos temporales en caso de error si está habilitado
    if (cleanupOnError && tempFiles.length > 0) {
      console.log("🧹 Limpiando archivos temporales debido al error...");
      await cleanupFiles(tempFiles);
    }
    
    throw error;
  }
}

/**
 * Genera un solo archivo de audio (para uso interno)
 * Mejorado siguiendo el patrón de los ejemplos de GoogleGenAI
 */
async function generateSingleAudio(
  ai: GoogleGenAI, 
  options: { 
    text: string; 
    outputFilename: string; 
    model: string; 
    speakers?: { speaker: string; voiceName: TTSVoiceName; }[] | null 
  }
): Promise<string> {
  const { text, outputFilename, model, speakers } = options;
  
  // Configurar el payload siguiendo los ejemplos proporcionados
  const requestPayload: any = {
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {}
    }
  };

  if (speakers && speakers.length > 0) {
    console.log(`🎤 Configurando ${speakers.length} speaker(s): ${speakers.map(s => s.speaker).join(', ')}`);
    
    if (speakers.length > 2) {
      throw new Error(`Error interno: Se intentó configurar ${speakers.length} speakers, pero el máximo es 2.`);
    }
    
    // Si solo hay 1 speaker, usar voiceConfig simple como en el ejemplo
    if (speakers.length === 1) {
      console.log("🗣️ Configurando modo de un solo speaker.");
      requestPayload.config.speechConfig.voiceConfig = {
        prebuiltVoiceConfig: { voiceName: speakers[0].voiceName }
      };
    } else {
      // Si hay 2 speakers, usar multiSpeakerVoiceConfig como en el ejemplo
      console.log("🎭 Configurando modo multi-speaker.");
      requestPayload.config.speechConfig.multiSpeakerVoiceConfig = {
        speakerVoiceConfigs: speakers.map(s => ({
          speaker: s.speaker,
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: s.voiceName }
          }
        }))
      };
    }
  } else {
    console.log("🗣️ Modo de un solo hablante sin configuración específica.");
  }

  try {
    // Llamar a la API siguiendo el patrón de los ejemplos
    const response = await ai.models.generateContent(requestPayload);
    
    // Extraer los datos de audio siguiendo el patrón de los ejemplos
    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!data) {
      console.error("DEBUG: API response did not contain audio data.", JSON.stringify(response, null, 2));
      throw new Error("Failed to generate audio. Check the console for the full API response.");
    }

    // Convertir y guardar el audio
    const audioBuffer = Buffer.from(data, 'base64');
    await saveWaveFile(outputFilename, audioBuffer);
    console.log(`💾 Audio guardado en: ${outputFilename}`);

    return outputFilename;
    
  } catch (error) {
    console.error(`❌ Error generando audio para ${outputFilename}:`, error);
    throw error;
  }
}