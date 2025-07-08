import os
import time
import wave
import uvicorn
from typing import List, Dict
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse

# Importaciones locales
from config import PORT, AUDIO_OUTPUT_DIR
from models import GenerateAudioRequest, TTSSpeakOptions
from tts_provider import StreamElementsProvider
from audio_player import AudioPlayer

# Inicialización de la aplicación
app = FastAPI(
    title="Servidor API de Texto a Voz",
    description="Wrapper en Python para un servicio TTS con control de reproducción.",
    version="1.0.0"
)

# Singletons
tts_provider = StreamElementsProvider()
audio_player = AudioPlayer()

# Función auxiliar para concatenar archivos WAV
def concatenate_wav_files(input_files: List[str], output_file: str):
    """Concatena múltiples archivos WAV en uno solo."""
    data = []
    params = None
    for infile in input_files:
        with wave.open(infile, 'rb') as w:
            if not params:
                params = w.getparams()
            else:
                if params[0:3] != w.getparams()[0:3]:
                    raise ValueError("Los archivos WAV tienen formatos incompatibles.")
            data.append(w.readframes(w.getnframes()))

    with wave.open(output_file, 'wb') as w:
        w.setparams(params)
        for frame_data in data:
            w.writeframes(frame_data)
    print(f"Archivos WAV concatenados en: {output_file}")

# Eventos del ciclo de vida
@app.on_event("startup")
async def startup_event():
    audio_player.start()
    print(f"🚀 TTS API server está escuchando en http://localhost:{PORT}")

@app.on_event("shutdown")
def shutdown_event():
    audio_player.shutdown()
    print("👋 Servidor apagado. Recursos de PyAudio liberados.")

# Endpoints
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
    """Genera un archivo de audio a partir de texto."""
    timestamp = int(time.time() * 1000)
    final_filename = f"audio_{timestamp}.wav"
    final_filepath = os.path.join(AUDIO_OUTPUT_DIR, final_filename)
    
    try:
        opts = TTSSpeakOptions()
        await tts_provider.generate_audio_file(request_body.text, final_filepath, opts)
        audio_player.add_to_queue(final_filepath)
        audio_player.play()
    except (ValueError, IOError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"Error inesperado: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                          detail="Ocurrió un error interno al generar el audio.")

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
    
    audio_player.add_to_queue(file_path)
    return FileResponse(file_path, media_type="audio/wav", filename=filename)

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

# Punto de entrada
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)