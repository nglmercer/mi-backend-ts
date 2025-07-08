# GenAI-Audio

Servidor API de Texto a Voz (TTS) en Python, que permite generar archivos de audio a partir de texto y controlar su reproducción en el servidor.

## Características

- API REST para convertir texto a voz usando StreamElements.
- Reproductor de audio integrado con control de cola y salto de pista.
- Soporte para múltiples voces.
- Entrega de archivos de audio generados en formato WAV.
- Basado en FastAPI.

## Estructura del Proyecto

- `main.py`: Servidor FastAPI y endpoints principales.
- `tts_provider.py`: Proveedor TTS (StreamElements).
- `audio_player.py`: Reproductor de audio en segundo plano.
- `models.py`: Modelos de datos y validaciones.
- `config.py`: Configuración y variables de entorno.
- `audio_outputs/`: Carpeta donde se guardan los archivos de audio generados.

## Instalación

1. Clona el repositorio y entra en la carpeta del proyecto.
2. Instala las dependencias:
   ```sh
   pip install -r requirements.txt
   ```
3. (Opcional) Crea un archivo `.env` para definir el puerto:
   ```
   PORT=8000
   ```

4. Asegúrate de tener instalado `ffmpeg` y que esté en tu PATH.

## Uso

Inicia el servidor con:

```sh
python main.py
```

El servidor estará disponible en `http://localhost:8000`.

### Endpoints principales

- `GET /api/voices`: Lista todas las voces disponibles.
- `POST /api/generate-audio`: Genera un archivo de audio a partir de texto.
- `GET /api/audio/{filename}`: Descarga y añade a la cola un archivo de audio generado.
- `GET /api/play`: Inicia la reproducción de la cola.
- `GET /api/next`: Salta a la siguiente pista en la cola.

### Ejemplo de petición para generar audio

```json
POST /api/generate-audio
{
  "text": "Hola, este es un ejemplo de texto a voz."
}
```

## Notas

- Los archivos de audio se almacenan en la carpeta `audio_outputs/`.
- El reproductor de audio funciona en segundo plano y reproduce los archivos en el servidor.
- Para cambiar la voz, consulta la lista de voces disponibles en `/api/voices`.

## Requisitos

- Python 3.8+
- ffmpeg (para la conversión de MP3 a WAV)
- Dependencias en `requirements.txt`

---