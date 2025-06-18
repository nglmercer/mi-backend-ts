import { GoogleGenAI } from '@google/genai';
import wav from 'wav';
import { Buffer } from 'buffer';

// Interfaz para definir las opciones que nuestra función aceptará
export interface GenerateAudioOptions {
  text: string;
  outputFilename: string;
  model?: string; // Parámetro opcional
  speakers?: {
    speaker: string;
    voiceName: string;
  }[]; // Array de objetos de hablante, opcional
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
 * Genera un archivo de audio a partir de texto usando la API de Google Gemini.
 * Se adapta para un solo hablante o múltiples hablantes.
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

    const requestPayload: any = { // Usamos 'any' por flexibilidad, pero se podría tipar más estrictamente
      model,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {}
      }
    };

    if (speakers && speakers.length > 0) {
      console.log("Modo Multi-Hablante detectado.");
      requestPayload.config.speechConfig.multiSpeakerVoiceConfig = {
        speakerVoiceConfigs: speakers.map(s => ({
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
    console.log(`Audio successfully saved to: ${outputFilename}`);

    return outputFilename;

  } catch (error) {
    console.error("Catastrophic error during audio generation:", error);
    throw error;
  }
}