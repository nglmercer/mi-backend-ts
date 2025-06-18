
# Servidor API de Texto a Voz (TTS) con Elysia y Gemini

Este proyecto es un servidor API de alto rendimiento construido con [ElysiaJS](https://elysiajs.com/) que actúa como un wrapper para el servicio de Texto a Voz de la API de Google Gemini. Permite generar archivos de audio `.wav` a partir de texto, soportando tanto una voz única como múltiples hablantes en una misma petición.

Además, incluye un sistema de cola y control de reproducción para reproducir los audios generados directamente en el servidor.

## ✨ Características Principales

- **Framework Moderno**: Construido sobre ElysiaJS, conocido por su increíble rendimiento y excelente experiencia de desarrollo.
- **Motor TTS Potente**: Utiliza el modelo `gemini-2.5-flash-preview-tts` de Google para una generación de voz de alta calidad.
- **Soporte Multi-Hablante**: Capacidad para definir diferentes hablantes con voces distintas dentro de un mismo texto.
- **Validación de Datos**: Esquemas de validación robustos con `t` de Elysia para asegurar la integridad de las peticiones.
- **API Completa**: Endpoints para generar audio, listar voces disponibles, servir los archivos de audio y controlar la reproducción.
- **Configuración Sencilla**: Se configura fácilmente a través de variables de entorno.

## 📋 Requisitos Previos

- [Node.js](https://nodejs.org/) (versión 18 o superior recomendada)
- Un gestor de paquetes como `npm`, `yarn` o `bun`.
- Una **API Key de Google Gemini**. Puedes obtenerla en [Google AI Studio](https://aistudio.google.com/app/apikey).

## 🚀 Instalación y Puesta en Marcha

1.  **Clona el repositorio:**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd <NOMBRE_DEL_DIRECTORIO>
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```
    *(O `bun install` si usas Bun)*

3.  **Crea un archivo de entorno:**
    Crea un archivo llamado `.env` en la raíz del proyecto y añade tu API Key de Gemini.

    **.env**
    ```
    GEMINI_API_KEY="AIzaSy...TU_API_KEY_AQUI"
    PORT=3000
    ```

4.  **Inicia el servidor:**
    ```bash
    npm start
    ```
    *(Asegúrate de tener un script `start` en tu `package.json`, por ejemplo: `"start": "node src/index.js"` o `"start": "bun src/index.ts"`)*

    Verás un mensaje en la consola indicando que el servidor está en funcionamiento:
    ```
    🚀 TTS API server está escuchando en http://localhost:3000
    ```

## 📖 Uso de la API (Endpoints)

La URL base para las peticiones es `http://localhost:3000`.

---

### `GET /api/voices`

Obtiene la lista de todas las voces disponibles para la generación de audio, junto con su característica principal.

**Ejemplo de Petición (cURL):**
```bash
curl -X GET http://localhost:3000/api/voices
```

**Ejemplo de Respuesta Exitosa (200 OK):**
```json
{
  "count": 30,
  "voices": [
    {
      "name": "Zephyr",
      "characteristic": "Bright"
    },
    {
      "name": "Puck",
      "characteristic": "Upbeat"
    },
    // ... más voces
    {
      "name": "Sulafat",
      "characteristic": "Warm"
    }
  ]
}
```

---

### `POST /api/generate-audio`

El endpoint principal para generar un archivo de audio a partir de texto.

#### Ejemplo 1: Petición con un solo hablante

En este caso, solo necesitas enviar el campo `text`. La API usará una voz por defecto.

**Cuerpo de la Petición (JSON):**
```json
{
  "text": "Hola mundo, esta es una prueba de generación de audio con una sola voz."
}
```

**Ejemplo de Petición (cURL):**
```bash
curl -X POST http://localhost:3000/api/generate-audio \
-H "Content-Type: application/json" \
-d '{"text": "Hola mundo, esta es una prueba de generación de audio con una sola voz."}'
```

#### Ejemplo 2: Petición con múltiples hablantes (Multi-Speaker)

Para usar múltiples hablantes, debes:
1.  Definir los hablantes y sus voces en el array `speakers`.
2.  Usar la sintaxis `[NOMBRE_DEL_HABLANTE]` en el campo `text` para indicar qué parte del texto debe decir cada uno.

**Cuerpo de la Petición (JSON):**
```json
{
  "text": "[NARRADOR] Y entonces, el aventurero preguntó: [AVENTURERO] ¿Dónde está el tesoro? [NARRADOR] A lo que el guardián respondió con voz grave: [GUARDIAN] El verdadero tesoro son los amigos que hicimos en el camino.",
  "speakers": [
    {
      "speaker": "NARRADOR",
      "voiceName": "Charon"
    },
    {
      "speaker": "AVENTURERO",
      "voiceName": "Puck"
    },
    {
      "speaker": "GUARDIAN",
      "voiceName": "Algenib"
    }
  ]
}
```

**Ejemplo de Respuesta Exitosa para ambas peticiones (201 Created):**
```json
{
  "message": "¡Audio generado con éxito!",
  "file": "audio_1701123456789.wav",
  "playbackUrl": "http://localhost:3000/api/audio/audio_1701123456789.wav"
}
```
La URL en `playbackUrl` puede ser usada en un navegador o reproductor para escuchar el audio.

---

### `GET /api/audio/:filename`

Sirve un archivo de audio generado previamente. Al acceder a esta URL, el archivo también se añade a la cola de reproducción del servidor.

**Ejemplo de Petición (Navegador o cURL):**
```bash
# Reemplaza el nombre del archivo con uno real obtenido de la respuesta anterior
curl -X GET http://localhost:3000/api/audio/audio_1701123456789.wav --output mi_audio.wav
```
Esto descargará el archivo de audio. Si abres la URL en un navegador, se reproducirá directamente.



### Endpoints de Control del Reproductor

Estos endpoints controlan la cola de reproducción en el servidor.

- **`GET /api/play`**: Inicia la reproducción de la cola de audio.
  ```bash
  curl http://localhost:3000/api/play
  ```
- **`GET /api/next`**: Salta al siguiente audio en la cola.
  ```bash
  curl http://localhost:3000/api/next
  ```

## 📂 Estructura del Proyecto

```
.
├── audio_outputs/      # Directorio donde se guardan los audios generados
├── src/
│   ├── constants/
│   │   └── voices.ts   # Constantes y tipos para las voces
│   ├── player/
│   │   └── audio-control.ts # Lógica para la cola y reproducción
│   ├── index.ts        # Archivo principal, configuración de Elysia y rutas
│   └── tts.module.ts   # Módulo que interactúa con la API de Gemini
├── .env                # Archivo de variables de entorno (¡ignorado por Git!)
├── package.json
└── README.md
```



### 2. Documento para Cliente API (Colección de Postman)

Este es el contenido de un archivo JSON que puedes importar en Postman. Guárdalo como `TTS_API_Postman_Collection.json` y luego en Postman ve a `Import` > `File` y selecciónalo.

```json
{
	"info": {
		"_postman_id": "b1b2d3e4-f5a6-4b7c-8d9e-1a2b3c4d5e6f",
		"name": "TTS API - Elysia & Gemini",
		"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
		"_exporter_id": "1234567"
	},
	"item": [
		{
			"name": "General",
			"item": [
				{
					"name": "Obtener Voces Disponibles",
					"request": {
						"method": "GET",
						"header": [],
						"url": {
							"raw": "{{baseUrl}}/api/voices",
							"host": [
								"{{baseUrl}}"
							],
							"path": [
								"api",
								"voices"
							]
						}
					},
					"response": []
				},
				{
					"name": "Servidor Status Check",
					"request": {
						"method": "GET",
						"header": [],
						"url": {
							"raw": "{{baseUrl}}/",
							"host": [
								"{{baseUrl}}"
							],
							"path": [
								""
							]
						}
					},
					"response": []
				}
			]
		},
		{
			"name": "Generación de Audio",
			"item": [
				{
					"name": "Generar Audio (Simple)",
					"request": {
						"method": "POST",
						"header": [
							{
								"key": "Content-Type",
								"value": "application/json"
							}
						],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"text\": \"Este es un ejemplo simple de texto a voz, generado con la API.\"\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{baseUrl}}/api/generate-audio",
							"host": [
								"{{baseUrl}}"
							],
							"path": [
								"api",
								"generate-audio"
							]
						}
					},
					"response": []
				},
				{
					"name": "Generar Audio (Multi-Hablante)",
					"request": {
						"method": "POST",
						"header": [
							{
								"key": "Content-Type",
								"value": "application/json"
							}
						],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"text\": \"[ENTREVISTADOR] Bienvenido a nuestro podcast. ¿Cómo te encuentras hoy? [INVITADO] ¡Fantástico! Gracias por invitarme. [ENTREVISTADOR] Empecemos con la primera pregunta.\",\n  \"speakers\": [\n    {\n      \"speaker\": \"ENTREVISTADOR\",\n      \"voiceName\": \"Charon\"\n    },\n    {\n      \"speaker\": \"INVITADO\",\n      \"voiceName\": \"Puck\"\n    }\n  ]\n}",
							"options": {
								"raw": {
									"language": "json"
								}
							}
						},
						"url": {
							"raw": "{{baseUrl}}/api/generate-audio",
							"host": [
								"{{baseUrl}}"
							],
							"path": [
								"api",
								"generate-audio"
							]
						}
					},
					"response": []
				},
				{
					"name": "Obtener/Reproducir Archivo de Audio",
					"request": {
						"method": "GET",
						"header": [],
						"url": {
							"raw": "{{baseUrl}}/api/audio/audio_1701123456789.wav",
							"host": [
								"{{baseUrl}}"
							],
							"path": [
								"api",
								"audio",
								"audio_1701123456789.wav"
							]
						},
						"description": "Recuerda reemplazar `audio_1701123456789.wav` con un nombre de archivo real obtenido de la respuesta de `POST /api/generate-audio`."
					},
					"response": []
				}
			]
		},
		{
			"name": "Control del Reproductor",
			"item": [
				{
					"name": "Iniciar Reproducción",
					"request": {
						"method": "GET",
						"header": [],
						"url": {
							"raw": "{{baseUrl}}/api/play",
							"host": [
								"{{baseUrl}}"
							],
							"path": [
								"api",
								"play"
							]
						}
					},
					"response": []
				},
				{
					"name": "Siguiente Audio",
					"request": {
						"method": "GET",
						"header": [],
						"url": {
							"raw": "{{baseUrl}}/api/next",
							"host": [
								"{{baseUrl}}"
							],
							"path": [
								"api",
								"next"
							]
						}
					},
					"response": []
				}
			]
		}
	],
	"variable": [
		{
			"key": "baseUrl",
			"value": "http://localhost:3000",
			"type": "string"
		}
	]
}
```