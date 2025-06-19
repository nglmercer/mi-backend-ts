import { GoogleGenAI } from '@google/genai';
import wav from 'wav';
import { Buffer } from 'buffer';
import {
  type TTSVoiceName,
  TTS_VOICE_NAMES,
  TTS_VOICE_CHARACTERISTICS
} from './constants/voices.js'

// Interfaz para definir las opciones que nuestra función aceptará
export interface GenerateAudioOptions {
  text: string;
  outputFilename: string;
  model?: string;
  speakers?: {
    speaker: string;
    voiceName: TTSVoiceName;
  }[];
}

// Función auxiliar para guardar el archivo .wav
async function saveWaveFile(filename: string, pcmData: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filename, {
      channels: 1,
      sampleRate: 24000,
      bitDepth: 16,
    });
    writer.on('finish', () => resolve());
    writer.on('error', reject);
    writer.write(pcmData);
    writer.end();
  });
}

/**
 * Divide el texto y speakers en chunks que contengan máximo 2 speakers únicos
 */
function chunkTextBySpeakers(text: string, speakers: { speaker: string; voiceName: TTSVoiceName; }[]): Array<{
  text: string;
  speakers: { speaker: string; voiceName: TTSVoiceName; }[];
}> {
  const chunks: Array<{ text: string; speakers: { speaker: string; voiceName: TTSVoiceName; }[] }> = [];
  
  // Extraer todas las partes del texto con sus speakers
  const parts = text.split(/(\[[\w\s]+\])/).filter(part => part.trim() !== '');
  
  let currentChunk = { text: '', speakers: new Set<string>(), speakerConfigs: [] as { speaker: string; voiceName: TTSVoiceName; }[] };
  
  for (const part of parts) {
    const speakerMatch = part.match(/\[(\w+)\]/);
    
    if (speakerMatch) {
      const speakerName = speakerMatch[1];
      const speakerConfig = speakers.find(s => s.speaker === speakerName);
      
      if (speakerConfig) {
        // Si agregar este speaker excedería el límite de 2, crear nuevo chunk
        if (!currentChunk.speakers.has(speakerName) && currentChunk.speakers.size >= 2) {
          // Guardar chunk actual
          if (currentChunk.text.trim()) {
            chunks.push({
              text: currentChunk.text.trim(),
              speakers: currentChunk.speakerConfigs
            });
          }
          
          // Iniciar nuevo chunk
          currentChunk = { text: '', speakers: new Set<string>(), speakerConfigs: [] };
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
      speakers: currentChunk.speakerConfigs
    });
  }
  
  return chunks;
}

/**
 * Combina múltiples archivos de audio en uno solo
 */
async function combineAudioFiles(filePaths: string[], outputPath: string): Promise<void> {
  // Esta es una implementación simplificada
  // En producción, necesitarías una librería como ffmpeg-static o similar
  
  const combinedBuffers: Buffer[] = [];
  
  for (const filePath of filePaths) {
    const fs = await import('fs');
    const audioData = fs.readFileSync(filePath);
    // Saltar el header WAV (44 bytes) excepto para el primer archivo
    const dataToAdd = combinedBuffers.length === 0 ? audioData : audioData.slice(44);
    combinedBuffers.push(dataToAdd);
  }
  
  const fs = await import('fs');
  const combinedBuffer = Buffer.concat(combinedBuffers);
  fs.writeFileSync(outputPath, combinedBuffer);
  
  // Limpiar archivos temporales
  for (const filePath of filePaths) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Genera un archivo de audio a partir de texto usando la API de Google Gemini.
 * Maneja automáticamente casos con más de 2 speakers dividiendo en chunks.
 */
export async function generateAudio(options: GenerateAudioOptions): Promise<string> {
  const {
    text,
    outputFilename,
    model = 'gemini-2.5-flash-preview-tts',
    speakers = null,
  } = options;

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("La variable de entorno GEMINI_API_KEY no está definida.");
  }

  try {
    //@ts-ignore
    const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);

    // Si no hay speakers o hay 2 o menos, usar el método original
    if (!speakers || speakers.length <= 2) {
      return await generateSingleAudio(ai, { text, outputFilename, model, speakers });
    }

    // Si hay más de 2 speakers, dividir en chunks
    console.log(`Detectados ${speakers.length} speakers. Dividiendo en chunks de máximo 2 speakers.`);
    
    const chunks = chunkTextBySpeakers(text, speakers);
    const tempFiles: string[] = [];
    
    // Generar audio para cada chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const tempFileName = outputFilename.replace(/\.wav$/, `_temp_${i}.wav`);
      
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
    
    console.log(`Audio multi-chunk generado exitosamente: ${outputFilename}`);
    return outputFilename;

  } catch (error) {
    console.error("Error durante la generación de audio:", error);
    throw error;
  }
}

/**
 * Genera un solo archivo de audio (para uso interno)
 */
async function generateSingleAudio(
  ai: any, 
  options: { text: string; outputFilename: string; model: string; speakers?: { speaker: string; voiceName: TTSVoiceName; }[] | null }
): Promise<string> {
  const { text, outputFilename, model, speakers } = options;
  
  const requestPayload: any = {
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {}
    }
  };

  if (speakers && speakers.length > 0) {
    console.log(`Configurando ${speakers.length} speaker(s) para: ${speakers.map(s => s.speaker).join(', ')}`);
    
    if (speakers.length > 2) {
      throw new Error(`Error interno: Se intentó configurar ${speakers.length} speakers, pero el máximo es 2.`);
    }
    
    // Si solo hay 1 speaker, agregar un speaker dummy para cumplir con el requisito de 2 speakers
    let speakerConfigs = [...speakers];
    if (speakers.length === 1) {
      console.log("⚡ Solo 1 speaker detectado. Agregando speaker dummy para cumplir requisito de 2 speakers.");
      speakerConfigs.push({
        speaker: 'DUMMY_SPEAKER',
        voiceName: 'Charon' // Usar una voz por defecto como dummy
      });
    }
    
    requestPayload.config.speechConfig.multiSpeakerVoiceConfig = {
      speakerVoiceConfigs: speakerConfigs.map(s => ({
        speaker: s.speaker,
        voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voiceName } }
      }))
    };
  } else {
    console.log("Modo de un solo hablante detectado.");
  }

  const response = await ai.models.generateContent(requestPayload);
  const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data as string | undefined;

  if (!data) {
    console.error("DEBUG: API response did not contain audio data.", JSON.stringify(response, null, 2));
    throw new Error("Failed to generate audio. Check the console for the full API response.");
  }

  const audioBuffer = Buffer.from(data, 'base64');
  await saveWaveFile(outputFilename, audioBuffer);
  console.log(`Audio guardado en: ${outputFilename}`);

  return outputFilename;
}