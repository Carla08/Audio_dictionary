import asyncio
import threading
import queue
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google.cloud import speech

router = APIRouter()

client = speech.SpeechClient()

recognition_config = speech.RecognitionConfig(
    encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
    sample_rate_hertz=16000,
    language_code="en-US",
)

streaming_config = speech.StreamingRecognitionConfig(
    config=recognition_config,
    interim_results=False,
)


@router.websocket("/ws/audio-stream")
async def audio_stream_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("connection open")

    audio_queue = queue.Queue()

    stop_event = threading.Event()

    def request_generator():
        while not stop_event.is_set():
            chunk = audio_queue.get()
            if chunk is None:
                break
            yield speech.StreamingRecognizeRequest(audio_content=chunk)

    def run_transcription():
        try:
            responses = client.streaming_recognize(
                config=streaming_config, requests=request_generator()
            )
            for response in responses:
                for result in response.results:
                    if result.is_final:
                        transcript = result.alternatives[0].transcript.strip()
                        print(f"✅ Transcript: {transcript}")
                        asyncio.run_coroutine_threadsafe(
                            websocket.send_text(transcript), loop
                        )
        except Exception as e:
            print("⏱️ Google API timeout: user was silent too long")

    loop = asyncio.get_event_loop()
    transcribe_thread = threading.Thread(target=run_transcription)
    transcribe_thread.start()

    try:
        while True:
            data = await websocket.receive_bytes()
            audio_queue.put(data)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        stop_event.set()
        audio_queue.put(None)
        transcribe_thread.join()
        if not websocket.application_state.name == "DISCONNECTED":
            await websocket.close()
        print("connection closed")
