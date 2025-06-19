// src/index.ts

import path from 'path';
import { fileURLToPath } from 'url';
import Player from './audio-player.js';
import { AudioQueue } from './audio-queue.js'; 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const audioFolder = path.join(__dirname, '../audio_outputs'); // La carpeta audio está fuera de src

const player = new Player(AudioQueue);

// --- Manejo de Eventos con Tipos Explícitos ---

player.on('start', (data: { track: string }) => {
  console.log(`EVENT: 'start' -> Now playing ${path.basename(data.track)}`);
});

player.on('progress', (data: { track: string; elapsed: number }) => {
  const seconds = Math.floor(data.elapsed);
  if (seconds > 0 && seconds % 5 === 0) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    console.log(`EVENT: 'progress' -> ${minutes}:${remainingSeconds.toString().padStart(2, '0')}`);
  }
});

player.on('pause', (data: { track: string; progress: number }) => {
  console.log(`EVENT: 'pause' -> Paused at ${Math.floor(data.progress)}s`);
});

player.on('end', (data: { track: string }) => {
  console.log(`EVENT: 'end' -> Finished ${path.basename(data.track)}. Playing next...`);
  player.play(); // Reproducir la siguiente automáticamente
});

player.on('queue-end', () => {
  console.log("EVENT: 'queue-end' -> Playback queue is empty.");
});

player.on('error', (error: Error) => {
  console.error('EVENT: "error" -> An error occurred:', error.message);
});

function main() {
  console.log('--- Node.js Audio Player (TypeScript) ---');

  AudioQueue.add(path.join(audioFolder, 'track1.mp3'));
  AudioQueue.add(path.join(audioFolder, 'track2.mp3'));
  
  console.log('\nInitial queue:', AudioQueue.list().map(p => path.basename(p)));
  console.log('\nStarting playback...');
  
  player.play();

  setTimeout(() => {
    console.log("\n--- DEMO: Pausing after 7 seconds ---");
    player.pause();
  }, 7000);

  setTimeout(() => {
    console.log("\n--- DEMO: Resuming after 10 seconds ---");
    player.resume();
  }, 10000);
  
  setTimeout(() => {
    console.log("\n--- DEMO: Skipping track after 15 seconds ---");
    player.skip();
  }, 15000);
}

export {
  AudioQueue,
  player
}