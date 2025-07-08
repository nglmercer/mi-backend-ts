import asyncio
import requests
from typing import List, Dict
from models import TTSVoice, TTSSpeakOptions
from config import STREAM_ELEMENTS_VOICES

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

            with open(file_path, "wb") as f:
                f.write(response.content)

            print(f"[TTS] Archivo de audio guardado en: {file_path}")

        except requests.RequestException as e:
            print(f"[TTS] Error generando el archivo de audio: {e}")
            raise IOError(f"Error en la API de StreamElements: {e}")