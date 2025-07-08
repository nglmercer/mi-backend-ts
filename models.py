from dataclasses import dataclass, field
from typing import List, Optional

# Ya no se necesita pydantic

# Modelos para TTS
@dataclass
class TTSVoice:
    """Representa una voz disponible para TTS."""
    name: str
    characteristic: Optional[str] = None

@dataclass
class TTSSpeakOptions:
    """Opciones de habla para una solicitud TTS."""
    voiceName: Optional[str] = None

# Modelos para API
@dataclass
class Speaker:
    """
    Representa un hablante y la voz asignada.
    Corresponde a la descripción que antes estaba en Field.
    """
    # El '...' en Pydantic.Field significa que el campo es obligatorio.
    # En dataclasses, cualquier campo sin un valor por defecto es obligatorio.
    speaker: str  # Nombre del hablante, e.g., 'NARRADOR'
    voiceName: str  # Nombre de la voz a usar, e.g., 'Brian'

@dataclass
class GenerateAudioRequest:
    """
    Define la solicitud para generar un audio.
    Puede incluir múltiples hablantes.
    """
    text: str  # Texto a convertir en audio. Usar [HABLANTE] para multi-voz.
    
    # Para listas u otros tipos mutables, el valor por defecto debe ser
    # 'None' o usar 'default_factory' para evitar problemas. 'None' es perfecto aquí.
    speakers: Optional[List[Speaker]] = None # Lista de hablantes y sus voces asignadas.