// src/audio-queue.ts

const audioQueue: string[] = [];

function addToQueue(filePath: string): void {
  audioQueue.push(filePath);
  console.log(`[Queue] Added: ${filePath}. Current queue size: ${audioQueue.length}`);
}

function getNextInQueue(): string | undefined {
  if (audioQueue.length === 0) {
    console.log("[Queue] Queue is empty. Nothing to play.");
    return undefined;
  }
  return audioQueue.shift();
}

function getCurrentQueue(): string[] {
  return [...audioQueue];
}

function clearQueue(): void {
  audioQueue.length = 0;
  console.log("[Queue] Queue has been cleared.");
}

// Creamos una interfaz para describir el objeto que exportamos.
// Esto es útil para que otros módulos sepan qué forma tiene `AudioQueue`.
export interface IAudioQueue {
  add: (filePath: string) => void;
  getNext: () => string | undefined;
  list: () => string[];
  clear: () => void;
}

export const AudioQueue: IAudioQueue = {
  add: addToQueue,
  getNext: getNextInQueue,
  list: getCurrentQueue,
  clear: clearQueue,
};