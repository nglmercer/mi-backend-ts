# main.py
import os
import wave
import time
import threading
import queue
import re
from contextlib import closing
from typing import List, Optional, Dict
import asyncio
# Dependencias de terceros (pip install "fastapi[all]" uvicorn requests python-dotenv PyAudio)
import uvicorn
import requests
import pyaudio
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# --- Configuración Inicial ---
load_dotenv()
PORT = int(os.getenv("PORT", 8000))
AUDIO_OUTPUT_DIR = "audio_outputs"
os.makedirs(AUDIO_OUTPUT_DIR, exist_ok=True)


# ==============================================================================
# SECCIÓN 1: CONSTANTES (equivalente a src/constants/voices.ts)
# ==============================================================================
# Voces disponibles del servicio de StreamElements
STREAM_ELEMENTS_VOICES =  [
    "Filiz", "Astrid", "Tatyana", "Maxim", "Carmen", "Ines", "Cristiano", "Vitoria",
    "Ricardo", "Maja", "Jan", "Jacek", "Ewa", "Ruben", "Lotte", "Liv", "Seoyeon",
    "Takumi", "Mizuki", "Giorgio", "Carla", "Bianca", "Karl", "Dora", "Mathieu",
    "Celine", "Chantal", "Penelope", "Miguel", "Mia", "Enrique", "Conchita",
    "Geraint", "Salli", "Matthew", "Kimberly", "Kendra", "Justin", "Joey",
    "Joanna", "Ivy", "Raveena", "Aditi", "Emma", "Brian", "Amy", "Russell",
    "Nicole", "Vicki", "Marlene", "Hans", "Naja", "Mads", "Gwyneth", "Zhiyu",
    "es-ES-Standard-A", "it-IT-Standard-A", "it-IT-Wavenet-A", "ja-JP-Standard-A",
    "ja-JP-Wavenet-A", "ko-KR-Standard-A", "ko-KR-Wavenet-A", "pt-BR-Standard-A",
    "tr-TR-Standard-A", "sv-SE-Standard-A", "nl-NL-Standard-A", "nl-NL-Wavenet-A",
    "en-US-Wavenet-A", "en-US-Wavenet-B", "en-US-Wavenet-C", "en-US-Wavenet-D",
    "en-US-Wavenet-E", "en-US-Wavenet-F", "en-GB-Standard-A", "en-GB-Standard-B",
    "en-GB-Standard-C", "en-GB-Standard-D", "en-GB-Wavenet-A", "en-GB-Wavenet-B",
    "en-GB-Wavenet-C", "en-GB-Wavenet-D", "en-US-Standard-B", "en-US-Standard-C",
    "en-US-Standard-D", "en-US-Standard-E", "de-DE-Standard-A", "de-DE-Standard-B",
    "de-DE-Wavenet-A", "de-DE-Wavenet-B", "de-DE-Wavenet-C", "de-DE-Wavenet-D",
    "en-AU-Standard-A", "en-AU-Standard-B", "en-AU-Wavenet-A", "en-AU-Wavenet-B",
    "en-AU-Wavenet-C", "en-AU-Wavenet-D", "en-AU-Standard-C", "en-AU-Standard-D",
    "fr-CA-Standard-A", "fr-CA-Standard-B", "fr-CA-Standard-C", "fr-CA-Standard-D",
    "fr-FR-Standard-C", "fr-FR-Standard-D", "fr-FR-Wavenet-A", "fr-FR-Wavenet-B",
    "fr-FR-Wavenet-C", "fr-FR-Wavenet-D", "da-DK-Wavenet-A", "pl-PL-Wavenet-A",
    "pl-PL-Wavenet-B", "pl-PL-Wavenet-C", "pl-PL-Wavenet-D", "pt-PT-Wavenet-A",
    "pt-PT-Wavenet-B", "pt-PT-Wavenet-C", "pt-PT-Wavenet-D", "ru-RU-Wavenet-A",
    "ru-RU-Wavenet-B", "ru-RU-Wavenet-C", "ru-RU-Wavenet-D", "sk-SK-Wavenet-A",
    "tr-TR-Wavenet-A", "tr-TR-Wavenet-B", "tr-TR-Wavenet-C", "tr-TR-Wavenet-D",
    "tr-TR-Wavenet-E", "uk-UA-Wavenet-A", "ar-XA-Wavenet-A", "ar-XA-Wavenet-B",
    "ar-XA-Wavenet-C", "cs-CZ-Wavenet-A", "nl-NL-Wavenet-B", "nl-NL-Wavenet-C",
    "nl-NL-Wavenet-D", "nl-NL-Wavenet-E", "en-IN-Wavenet-A", "en-IN-Wavenet-B",
    "en-IN-Wavenet-C", "fil-PH-Wavenet-A", "fi-FI-Wavenet-A", "el-GR-Wavenet-A",
    "hi-IN-Wavenet-A", "hi-IN-Wavenet-B", "hi-IN-Wavenet-C", "hu-HU-Wavenet-A",
    "id-ID-Wavenet-A", "id-ID-Wavenet-B", "id-ID-Wavenet-C", "it-IT-Wavenet-B",
    "it-IT-Wavenet-C", "it-IT-Wavenet-D", "ja-JP-Wavenet-B", "ja-JP-Wavenet-C",
    "ja-JP-Wavenet-D", "cmn-CN-Wavenet-A", "cmn-CN-Wavenet-B", "cmn-CN-Wavenet-C",
    "cmn-CN-Wavenet-D", "nb-no-Wavenet-E", "nb-no-Wavenet-A", "nb-no-Wavenet-B",
    "nb-no-Wavenet-C", "nb-no-Wavenet-D", "vi-VN-Wavenet-A", "vi-VN-Wavenet-B",
    "vi-VN-Wavenet-C", "vi-VN-Wavenet-D", "sr-rs-Standard-A", "lv-lv-Standard-A",
    "is-is-Standard-A", "bg-bg-Standard-A", "af-ZA-Standard-A", "Tracy", "Danny",
    "Huihui", "Yaoyao", "Kangkang", "HanHan", "Zhiwei", "Asaf", "An", "Stefanos",
    "Filip", "Ivan", "Heidi", "Herena", "Kalpana", "Hemant", "Matej", "Andika",
    "Rizwan", "Lado", "Valluvar", "Linda", "Heather", "Sean", "Michael",
    "Karsten", "Guillaume", "Pattara", "Jakub", "Szabolcs", "Hoda", "Naayf"
]

# ==============================================================================
# SECCIÓN 2: PROVEEDOR DE TTS (equivalente a src/tts.module.ts)
# ==============================================================================
class TTSVoice(BaseModel):
    name: str
    characteristic: Optional[str] = None # StreamElements no provee esta info, pero mantenemos la estructura

class TTSSpeakOptions(BaseModel):
    voiceName: Optional[str] = None

class TTSProvider:
    def __init__(self, config: Dict = {}):
        self.config = config

    def is_available(self) -> bool:
        return False

    def get_voices(self) -> List[TTSVoice]:
        return []

    async def generate_audio_file(self, text: str, file_path: str, opts: TTSSpeakOptions):
        raise NotImplementedError("'generate_audio_file' no implementado")

class StreamElementsProvider(TTSProvider):
    def __init__(self, config: Dict = {}):
        default_config = {"defaultVoice": "Conchita"}
        super().__init__({**default_config, **config})
        self.endpoint = "https://api.streamelements.com/kappa/v2/speech"
        print(f"StreamElementsProvider inicializado con config: {self.config}")

    def is_available(self) -> bool:
        return True

    def get_voices(self) -> List[TTSVoice]:
        # Como no tenemos características, las omitimos.
        return [TTSVoice(name=voice) for voice in STREAM_ELEMENTS_VOICES]

    def _get_final_opts(self, opts: TTSSpeakOptions) -> Dict:
        return {
            "voiceName": opts.voiceName or self.config["defaultVoice"]
        }

    async def generate_audio_file(self, text: str, file_path: str, opts: TTSSpeakOptions):
        if not text or not isinstance(text, str) or not text.strip():
            raise ValueError("El texto no puede estar vacío")

        final_opts = self._get_final_opts(opts)
        params = {"voice": final_opts["voiceName"], "text": text.strip()}

        print(f"[TTS] Solicitando audio a StreamElements para: \"{text}\" con voz: {final_opts['voiceName']}")

        try:
            # Usamos un executor para no bloquear el bucle de eventos de asyncio
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, lambda: requests.get(self.endpoint, params=params, timeout=20)
            )
            response.raise_for_status()

            with open(file_path, "wb") as f:
                f.write(response.content)

            print(f"[TTS] Archivo de audio guardado en: {file_path}")

        except requests.RequestException as e:
            print(f"[TTS] Error generando el archivo de audio: {e}")
            raise IOError(f"Error en la API de StreamElements: {e}")


# ==============================================================================
# SECCIÓN 3: CONTROL DE REPRODUCCIÓN (equivalente a src/player/audio-control.ts)
# ==============================================================================
class AudioPlayer:
    def __init__(self):
        self.audio_queue = queue.Queue()
        self.is_playing = threading.Event()
        self.skip_track = threading.Event()
        self.player_thread = threading.Thread(target=self._play_audio_loop, daemon=True)
        self.pyaudio_instance = pyaudio.PyAudio()

    def start(self):
        self.player_thread.start()
        print("🎧 Reproductor de audio iniciado en segundo plano.")

    def add_to_queue(self, file_path: str):
        if os.path.exists(file_path):
            self.audio_queue.put(file_path)
            print(f"🎵 Añadido a la cola: {os.path.basename(file_path)}. Pistas en cola: {self.audio_queue.qsize()}")
        else:
            print(f"⚠️ Archivo no encontrado, no se puede añadir a la cola: {file_path}")

    def play(self):
        if not self.is_playing.is_set() and not self.audio_queue.empty():
            self.is_playing.set()
            print("▶️ Iniciando reproducción.")
        elif self.audio_queue.empty():
            print("⏹️ La cola de reproducción está vacía.")
        else:
            print("▶️ La reproducción ya está en curso.")

    def next(self):
        if self.is_playing.is_set():
            print("⏭️ Saltando a la siguiente pista...")
            self.skip_track.set()
        else:
            print("⏹️ No hay nada que saltar, el reproductor está detenido.")

    def _play_audio_loop(self):
        while True:
            self.is_playing.wait() # Espera hasta que se llame a play()

            if self.skip_track.is_set():
                self.skip_track.clear()

            try:
                file_path = self.audio_queue.get_nowait()
            except queue.Empty:
                self.is_playing.clear()
                print("⏹️ Cola finalizada. Reproductor detenido.")
                continue

            print(f"🎶 Reproduciendo ahora: {os.path.basename(file_path)}")
            
            stream = None
            wf = None
            try:
                with closing(wave.open(file_path, 'rb')) as wf:
                    stream = self.pyaudio_instance.open(
                        format=self.pyaudio_instance.get_format_from_width(wf.getsampwidth()),
                        channels=wf.getnchannels(),
                        rate=wf.getframerate(),
                        output=True
                    )
                    
                    data = wf.readframes(1024)
                    while data and not self.skip_track.is_set():
                        stream.write(data)
                        data = wf.readframes(1024)
                
                if self.skip_track.is_set():
                    self.skip_track.clear() # Resetea el flag de salto
                    print("⏭️ Pista saltada.")

            except Exception as e:
                print(f"❌ Error al reproducir {file_path}: {e}")
            finally:
                if stream:
                    stream.stop_stream()
                    stream.close()
                self.audio_queue.task_done()

            # Si la cola se vació, detener la reproducción
            if self.audio_queue.empty():
                self.is_playing.clear()
                print("⏹️ Cola finalizada. Reproductor detenido.")
    
    def shutdown(self):
        self.pyaudio_instance.terminate()

# ==============================================================================
# SECCIÓN 4: SERVIDOR API CON FASTAPI (equivalente a src/index.ts)
# ==============================================================================

# --- Inicialización de Singletons ---
app = FastAPI(
    title="Servidor API de Texto a Voz",
    description="Wrapper en Python para un servicio TTS con control de reproducción.",
    version="1.0.0"
)
tts_provider = StreamElementsProvider()
audio_player = AudioPlayer()

# --- Modelos de Datos (Validación) ---
class Speaker(BaseModel):
    speaker: str = Field(..., description="Nombre del hablante, e.g., 'NARRADOR'")
    voiceName: str = Field(..., description="Nombre de la voz a usar, e.g., 'Brian'")

class GenerateAudioRequest(BaseModel):
    text: str = Field(..., description="Texto a convertir en audio. Usar [HABLANTE] para multi-voz.")
    speakers: Optional[List[Speaker]] = Field(None, description="Lista de hablantes y sus voces asignadas.")

# --- Funciones Auxiliares ---
def concatenate_wav_files(input_files: List[str], output_file: str):
    """Concatena múltiples archivos WAV en uno solo."""
    data = []
    params = None
    for infile in input_files:
        with wave.open(infile, 'rb') as w:
            if not params:
                params = w.getparams()
            else:
                if params[0:3] != w.getparams()[0:3]: # nchannels, sampwidth, framerate
                    raise ValueError("Los archivos WAV tienen formatos incompatibles.")
            data.append(w.readframes(w.getnframes()))

    with wave.open(output_file, 'wb') as w:
        w.setparams(params)
        for frame_data in data:
            w.writeframes(frame_data)
    print(f"Archivos WAV concatenados en: {output_file}")


# --- Eventos de Ciclo de Vida de la App ---
@app.on_event("startup")
async def startup_event():
    audio_player.start()
    print(f"🚀 TTS API server está escuchando en http://localhost:{PORT}")

@app.on_event("shutdown")
def shutdown_event():
    audio_player.shutdown()
    print("👋 Servidor apagado. Recursos de PyAudio liberados.")


# --- Endpoints de la API ---
@app.get("/", tags=["Status"])
async def root():
    return {"message": "TTS API Server is running"}

@app.get("/api/voices", response_model=Dict, tags=["General"])
async def get_voices():
    """Obtiene la lista de todas las voces disponibles."""
    voices = tts_provider.get_voices()
    return {"count": len(voices), "voices": voices}

@app.post("/api/generate-audio", status_code=status.HTTP_201_CREATED, tags=["Generación de Audio"])
async def generate_audio(request_body: GenerateAudioRequest, request: Request):
    """Genera un archivo de audio a partir de texto, con soporte para uno o varios hablantes."""
    timestamp = int(time.time() * 1000)
    final_filename = f"audio_{timestamp}.wav"
    final_filepath = os.path.join(AUDIO_OUTPUT_DIR, final_filename)
    
    try:
        opts = TTSSpeakOptions() # Usa la voz por defecto
        await tts_provider.generate_audio_file(request_body.text, final_filepath, opts)
        audio_player.add_to_queue(final_filepath)
        audio_player.play()
    except (ValueError, IOError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"Error inesperado: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ocurrió un error interno al generar el audio.")

    base_url = str(request.base_url)
    playback_url = f"{base_url}api/audio/{final_filename}"

    return {
        "message": "¡Audio generado con éxito!",
        "file": final_filename,
        "playbackUrl": playback_url
    }

@app.get("/api/audio/{filename}", tags=["Generación de Audio"])
async def serve_audio(filename: str):
    """Sirve un archivo de audio y lo añade a la cola de reproducción."""
    file_path = os.path.join(AUDIO_OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado.")
    
    # Añadir a la cola de reproducción del servidor ANTES de servirlo
    audio_player.add_to_queue(file_path)

    return FileResponse(file_path, media_type="audio/wav", filename=filename)


# --- Endpoints de Control del Reproductor ---
@app.get("/api/play", tags=["Control del Reproductor"])
async def play_queue():
    """Inicia la reproducción de la cola de audio en el servidor."""
    audio_player.play()
    return JSONResponse(content={"message": "Comando de reproducción enviado."})

@app.get("/api/next", tags=["Control del Reproductor"])
async def next_in_queue():
    """Salta al siguiente audio en la cola de reproducción."""
    audio_player.next()
    return JSONResponse(content={"message": "Comando para saltar a la siguiente pista enviado."})


# --- Punto de Entrada para Ejecutar el Servidor ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)