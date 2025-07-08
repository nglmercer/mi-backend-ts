import os
import wave
import threading
import queue
from contextlib import closing
import pyaudio

class AudioPlayer:
    def __init__(self):
        self.audio_queue = queue.Queue()
        self.is_playing = threading.Event()
        self.skip_track = threading.Event()
        self.player_thread = threading.Thread(target=self._play_audio_loop, daemon=True)
        self.pyaudio_instance = pyaudio.PyAudio()

    def start(self):
        self.player_thread.start()
        print("🎧 Reproductor de audio iniciado en segundo plano.")

    def add_to_queue(self, file_path: str):
        if os.path.exists(file_path):
            self.audio_queue.put(file_path)
            print(f"🎵 Añadido a la cola: {os.path.basename(file_path)}. Pistas en cola: {self.audio_queue.qsize()}")
        else:
            print(f"⚠️ Archivo no encontrado, no se puede añadir a la cola: {file_path}")

    def play(self):
        if not self.is_playing.is_set() and not self.audio_queue.empty():
            self.is_playing.set()
            print("▶️ Iniciando reproducción.")
        elif self.audio_queue.empty():
            print("⏹️ La cola de reproducción está vacía.")
        else:
            print("▶️ La reproducción ya está en curso.")

    def next(self):
        if self.is_playing.is_set():
            print("⏭️ Saltando a la siguiente pista...")
            self.skip_track.set()
        else:
            print("⏹️ No hay nada que saltar, el reproductor está detenido.")

    def _play_audio_loop(self):
        while True:
            self.is_playing.wait()

            if self.skip_track.is_set():
                self.skip_track.clear()

            try:
                file_path = self.audio_queue.get_nowait()
            except queue.Empty:
                self.is_playing.clear()
                print("⏹️ Cola finalizada. Reproductor detenido.")
                continue

            print(f"🎶 Reproduciendo ahora: {os.path.basename(file_path)}")
            
            stream = None
            wf = None
            try:
                with closing(wave.open(file_path, 'rb')) as wf:
                    stream = self.pyaudio_instance.open(
                        format=self.pyaudio_instance.get_format_from_width(wf.getsampwidth()),
                        channels=wf.getnchannels(),
                        rate=wf.getframerate(),
                        output=True
                    )
                    
                    data = wf.readframes(1024)
                    while data and not self.skip_track.is_set():
                        stream.write(data)
                        data = wf.readframes(1024)
                
                if self.skip_track.is_set():
                    self.skip_track.clear()
                    print("⏭️ Pista saltada.")

            except Exception as e:
                print(f"❌ Error al reproducir {file_path}: {e}")
            finally:
                if stream:
                    stream.stop_stream()
                    stream.close()
                self.audio_queue.task_done()

            if self.audio_queue.empty():
                self.is_playing.clear()
                print("⏹️ Cola finalizada. Reproductor detenido.")
    
    def shutdown(self):
        self.pyaudio_instance.terminate()