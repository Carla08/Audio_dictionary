
import React, { useEffect, useRef, useState } from "react";
import debounce from "lodash.debounce";
import keywordsConfig from "./keywords.json";

const apiUrl = import.meta.env.VITE_API_BASE_URL;


const sortedKeywords = Object.keys(keywordsConfig).sort((a, b) => b.length - a.length);

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [highlightedWord, setHighlightedWord] = useState(null);
  const [definition, setDefinition] = useState(null);
  const ws = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const transcriptBuffer = useRef("");
  const seenChunks = useRef(new Set());

  const setupWebSocket = () => {
    ws.current = new WebSocket(apiUrl.replace(/^http/, 'ws') + "/ws/audio-stream")

    ws.current.onopen = () => console.log("✅ WebSocket connected");
    ws.current.onclose = () => {
      console.log("🔌 WebSocket disconnected");
    };
    ws.current.onerror = (error) => console.error("❌ WebSocket error:", error);

    ws.current.onmessage = (event) => {
      const newText = event.data.trim();
      if (newText && !seenChunks.current.has(newText)) {
        seenChunks.current.add(newText);
        transcriptBuffer.current += " " + newText;
        debouncedUpdateTranscript();
      }
    };
  };

  useEffect(() => {
    setupWebSocket();
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const debouncedUpdateTranscript = debounce(() => {
    setTranscript(transcriptBuffer.current.trim());
  }, 300);

  const highlightKeywords = (text) => {
    let highlighted = text;
    sortedKeywords.forEach((keyword) => {
      const pattern = new RegExp(`\\b(${keyword})\\b`, "gi");
      highlighted = highlighted.replace(pattern, (match) => {
        return `<span class="highlight" data-key="${keyword.toLowerCase()}">${match}</span>`;
      });
    });
    return highlighted;
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(pcm.buffer);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    processorRef.current = processor;
    sourceRef.current = source;
    setIsRecording(true);
  };

  const stopRecording = () => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();

    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;

    setIsRecording(false);
    console.log("⏹️ Recording stopped");
  };

  const handleHighlightClick = (e) => {
    if (e.target.classList.contains("highlight")) {
      const word = e.target.getAttribute("data-key");
      setHighlightedWord(word);
      setDefinition(keywordsConfig[word]);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${apiUrl}/upload`, {
      method: "POST",
      body: formData,
    });


    const data = await response.json();
    if (data.transcription) {
      transcriptBuffer.current = data.transcription;
      seenChunks.current = new Set();
      setTranscript(data.transcription);
    } else {
      alert("Transcription failed: " + data.error);
    }
  };

  return (
    <div style={{ display: "flex", gap: "2rem", padding: "1rem" }}>
      <div style={{ flex: 1 }}>
        <h1>🎤 Streaming Transcription</h1>
        {!isRecording ? (
          <div style={{ display: "flex", gap: "1rem" }}>
            <button onClick={startRecording}>Start Recording</button>
            <label htmlFor="upload" style={{ cursor: "pointer" }}>
              <span className="highlight">or Upload</span>
              <input
                id="upload"
                type="file"
                accept=".wav, audio/*"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
            </label>
          </div>
        ) : (
          <button onClick={stopRecording}>Stop Recording</button>
        )}
        <div
          onClick={handleHighlightClick}
          dangerouslySetInnerHTML={{ __html: highlightKeywords(transcript) }}
          style={{
            marginTop: "20px",
            lineHeight: "1.5",
            whiteSpace: "pre-wrap",
            border: "1px solid #ccc",
            padding: "1rem",
            borderRadius: "8px",
            minHeight: "150px",
          }}
        />
      </div>

      {highlightedWord && (
        <div
          style={{
            width: "30%",
            backgroundColor: "#f0f8ff",
            padding: "1rem",
            borderRadius: "8px",
            boxShadow: "0 0 10px rgba(0,0,0,0.1)",
          }}
        >
          <h3>📘 {highlightedWord}</h3>
          <p>{definition}</p>
        </div>
      )}

      <style>
        {`
          .highlight {
            display: inline-block;
            background-color: #ffd700;
            color: #333;
            font-weight: bold;
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 6px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
            transition: background-color 0.2s ease;
          }

          .highlight:hover {
            background-color: #ffc107;
          }
        `}
      </style>
    </div>
  );
};

export default App;
