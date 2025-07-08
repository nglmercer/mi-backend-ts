import os
import time
import wave
import json
import atexit # Para gestionar el apagado limpio
from typing import List, Dict
from flask import Flask, request, jsonify, send_from_directory, Response

# Importaciones locales (estas no cambian)
from config import PORT, AUDIO_OUTPUT_DIR
from models import GenerateAudioRequest, TTSSpeakOptions # Modelos Pydantic aún útiles para la validación
from tts_provider import StreamElementsProvider
from audio_player import AudioPlayer

# Inicialización de la aplicación Flask
app = Flask(__name__)

# Singletons (no cambian)
tts_provider = StreamElementsProvider()
audio_player = AudioPlayer()

# Función auxiliar para concatenar archivos WAV (no cambia)
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

# --- Endpoints de la API con Flask ---

@app.route("/", methods=['GET'])
def root():
    return jsonify({"message": "TTS API Server is running (Flask version)"})

@app.route("/api/voices", methods=['GET'])
def get_voices():
    """Obtiene la lista de todas las voces disponibles."""
    voices = tts_provider.get_voices()
    return jsonify({"count": len(voices), "voices": voices})

@app.route("/api/generate-audio", methods=['POST'])
def generate_audio():
    """Genera un archivo de audio a partir de texto."""
    # Obtener el JSON del cuerpo de la solicitud
    json_data = request.get_json()
    if not json_data or 'text' not in json_data:
        return jsonify({"error": "El campo 'text' es requerido en el cuerpo JSON."}), 400

    # Usamos el modelo Pydantic para validar y estructurar los datos
    try:
        request_body = GenerateAudioRequest(**json_data)
    except Exception as e:
        return jsonify({"error": f"Datos de solicitud inválidos: {e}"}), 400

    timestamp = int(time.time() * 1000)
    final_filename = f"audio_{timestamp}.wav"
    final_filepath = os.path.join(AUDIO_OUTPUT_DIR, final_filename)
    
    try:
        # La generación de audio asíncrona no es nativa en Flask,
        # la ejecutamos de forma síncrona.
        # Si la función fuera 'async', necesitarías un runner de eventos.
        opts = TTSSpeakOptions()
        # await tts_provider.generate_audio_file(...) # Esto era de FastAPI/asyncio
        # Lo llamamos de forma síncrona si es posible, o lo adaptamos.
        # Asumiremos que StreamElementsProvider puede ser llamado síncronamente.
        # Si no, se necesitaría una adaptación con asyncio.run().
        tts_provider.generate_audio_file_sync(request_body.text, final_filepath, opts) # Asumimos que tienes una versión síncrona
        
        audio_player.add_to_queue(final_filepath)
        audio_player.play()
    except (ValueError, IOError) as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"Error inesperado: {e}")
        return jsonify({"error": "Ocurrió un error interno al generar el audio."}), 500

    # Construir la URL de reproducción
    playback_url = f"{request.host_url}api/audio/{final_filename}"

    return jsonify({
        "message": "¡Audio generado con éxito!",
        "file": final_filename,
        "playbackUrl": playback_url
    }), 201 # HTTP 201 Created

@app.route("/api/audio/<string:filename>", methods=['GET'])
def serve_audio(filename: str):
    """Sirve un archivo de audio y lo añade a la cola de reproducción."""
    file_path = os.path.join(AUDIO_OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "Archivo no encontrado."}), 404
    
    audio_player.add_to_queue(file_path)
    return send_from_directory(AUDIO_OUTPUT_DIR, filename, mimetype='audio/wav')

@app.route("/api/play", methods=['GET'])
def play_queue():
    """Inicia la reproducción de la cola de audio en el servidor."""
    audio_player.play()
    return jsonify({"message": "Comando de reproducción enviado."})

@app.route("/api/next", methods=['GET'])
def next_in_queue():
    """Salta al siguiente audio en la cola de reproducción."""
    audio_player.next()
    return jsonify({"message": "Comando para saltar a la siguiente pista enviado."})

# --- Ciclo de vida de la aplicación ---
def startup_event():
    audio_player.start()
    print(f"🚀 TTS API server (Flask) está escuchando en http://localhost:{PORT}")

def shutdown_event():
    audio_player.shutdown()
    print("👋 Servidor apagado. Recursos de PyAudio liberados.")

# Registrar la función de apagado para que se ejecute al salir del script
atexit.register(shutdown_event)

# Punto de entrada
if __name__ == "__main__":
    startup_event()
    # Usa el servidor de desarrollo de Flask. Para producción, usa un servidor WSGI como Gunicorn.
    app.run(host="0.0.0.0", port=PORT)