from typing import List, Optional
from pydantic import BaseModel, Field

# Modelos para TTS
class TTSVoice(BaseModel):
    name: str
    characteristic: Optional[str] = None

class TTSSpeakOptions(BaseModel):
    voiceName: Optional[str] = None

# Modelos para API
class Speaker(BaseModel):
    speaker: str = Field(..., description="Nombre del hablante, e.g., 'NARRADOR'")
    voiceName: str = Field(..., description="Nombre de la voz a usar, e.g., 'Brian'")

class GenerateAudioRequest(BaseModel):
    text: str = Field(..., description="Texto a convertir en audio. Usar [HABLANTE] para multi-voz.")
    speakers: Optional[List[Speaker]] = Field(None, description="Lista de hablantes y sus voces asignadas.")