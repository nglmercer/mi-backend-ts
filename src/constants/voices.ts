// src/constants/voices.ts

// Un tipo de unión para asegurar que solo se usen nombres de voz válidos.
export type TTSVoiceName =
  | 'Zephyr' | 'Puck' | 'Charon'
  | 'Kore' | 'Fenrir' | 'Leda'
  | 'Orus' | 'Aoede' | 'Callirrhoe'
  | 'Autonoe' | 'Enceladus' | 'Iapetus'
  | 'Umbriel' | 'Algieba' | 'Despina'
  | 'Erinome' | 'Algenib' | 'Rasalgethi'
  | 'Laomedeia' | 'Achernar' | 'Alnilam'
  | 'Schedar' | 'Gacrux' | 'Pulcherrima'
  | 'Achird' | 'Zubenelgenubi' | 'Vindemiatrix'
  | 'Sadachbia' | 'Sadaltager' | 'Sulafat' | string;

// Un array constante con todos los nombres de voz.
// Útil para iterar y para la validación en Elysia.
export const TTS_VOICE_NAMES: TTSVoiceName[] = [
  'Zephyr', 'Puck', 'Charon',
  'Kore', 'Fenrir', 'Leda',
  'Orus', 'Aoede', 'Callirrhoe',
  'Autonoe', 'Enceladus', 'Iapetus',
  'Umbriel', 'Algieba', 'Despina',
  'Erinome', 'Algenib', 'Rasalgethi',
  'Laomedeia', 'Achernar', 'Alnilam',
  'Schedar', 'Gacrux', 'Pulcherrima',
  'Achird', 'Zubenelgenubi', 'Vindemiatrix',
  'Sadachbia', 'Sadaltager', 'Sulafat'
];

// Un objeto que mapea cada voz a su característica descriptiva.
export const TTS_VOICE_CHARACTERISTICS: Record<TTSVoiceName, string> = {
  'Zephyr': 'Bright', 'Puck': 'Upbeat', 'Charon': 'Informative',
  'Kore': 'Firm', 'Fenrir': 'Excitable', 'Leda': 'Youthful',
  'Orus': 'Firm', 'Aoede': 'Breezy', 'Callirrhoe': 'Easy-going',
  'Autonoe': 'Bright', 'Enceladus': 'Breathy', 'Iapetus': 'Clear',
  'Umbriel': 'Easy-going', 'Algieba': 'Smooth', 'Despina': 'Smooth',
  'Erinome': 'Clear', 'Algenib': 'Gravelly', 'Rasalgethi': 'Informative',
  'Laomedeia': 'Upbeat', 'Achernar': 'Soft', 'Alnilam': 'Firm',
  'Schedar': 'Even', 'Gacrux': 'Mature', 'Pulcherrima': 'Forward',
  'Achird': 'Friendly', 'Zubenelgenubi': 'Casual', 'Vindemiatrix': 'Gentle',
  'Sadachbia': 'Lively', 'Sadaltager': 'Knowledgeable', 'Sulafat': 'Warm'
};
/*
export {
  type TTSVoiceName,
  TTS_VOICE_NAMES,
  TTS_VOICE_CHARACTERISTICS
}
*/