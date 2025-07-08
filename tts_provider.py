import asyncio
import requests
from typing import List, Dict
from models import TTSVoice, TTSSpeakOptions
from config import STREAM_ELEMENTS_VOICES
import subprocess # Importamos subprocess
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
            loop = asyncio.get_event_loop()
            
            response = await loop.run_in_executor(
                None, lambda: requests.get(self.endpoint, params=params, timeout=20)
            )
            response.raise_for_status()

            mp3_content = response.content

            # --- NUEVO BLOQUE DE CONVERSIÓN DE MP3 A WAV (usando subprocess) ---
            def convert_mp3_to_wav(mp3_data: bytes, output_path: str):
                command = ['ffmpeg', '-i', 'pipe:0', '-f', 'wav', '-y', output_path]
                try:
                    subprocess.run(command, input=mp3_data, check=True, capture_output=True)
                except FileNotFoundError:
                    # Este error ocurre si ffmpeg no está instalado o no está en el PATH
                    print("[TTS] Error: El comando 'ffmpeg' no se encontró. Asegúrate de que esté instalado y en el PATH.")
                    raise
                except subprocess.CalledProcessError as e:
                    # Este error ocurre si ffmpeg falla por alguna razón (ej. datos corruptos)
                    print(f"[TTS] ffmpeg falló con el error: {e.stderr.decode()}")
                    raise

            await loop.run_in_executor(
                None, convert_mp3_to_wav, mp3_content, file_path
            )
            
            print(f"[TTS] Archivo de audio convertido a WAV y guardado en: {file_path}")

        except requests.RequestException as e:
            print(f"[TTS] Error generando el archivo de audio: {e}")
            raise IOError(f"Error en la API de StreamElements: {e}")
        except Exception as e:
            print(f"[TTS] Error durante la conversión de audio: {e}")
            raise IOError(f"Error convirtiendo el audio a WAV: {e}")