import tempfile
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment
from google.cloud import speech

from ws import router as ws_router

# Initialize FastAPI app
app = FastAPI()

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include your WebSocket router
app.include_router(ws_router)

# Load env vars and init Google client
load_dotenv()
speech_client = speech.SpeechClient()


@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    try:
        contents = await file.read()

        # Save original uploaded file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_input:
            tmp_input.write(contents)
            tmp_input_path = tmp_input.name

        # Convert to mono + 16kHz
        output_path = tmp_input_path.replace(".wav", "_converted.wav")
        audio = AudioSegment.from_file(tmp_input_path)
        audio = audio.set_channels(1).set_frame_rate(16000)
        audio.export(output_path, format="wav")

        # Read for Google API
        with open(output_path, "rb") as audio_file:
            audio_data = speech.RecognitionAudio(content=audio_file.read())

        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            language_code="en-US"
        )

        response = speech_client.recognize(config=config, audio=audio_data)
        transcript_text = " ".join(result.alternatives[0].transcript for result in response.results)
        return {"transcription": transcript_text}

    except Exception as e:
        return {"error": f"Transcription failed: {str(e)}"}
