import requests
import json
import websocket
import time
import threading
import wave
import sys

# Configuration
base_url = "http://localhost:5000"
chat_session_id = "example_chat_123"
audio_file_path = "audio/sample_audio.wav"  # Path to your WAV file

# Step 1: Create a session
response = requests.post(
    f"{base_url}/chats/{chat_session_id}/sessions",
    json={"language": "en-US"}
)
session_data = response.json()
session_id = session_data["session_id"]
print(f"Session created: {session_id}")

# Step 2: Set up WebSocket for receiving transcription
ws_messages = []

def on_message(ws, message):
    print(f"Received: {message}")
    ws_messages.append(json.loads(message))

def on_error(ws, error):
    print(f"Error: {error}")

def on_close(ws, close_status_code, close_msg):
    print("WebSocket connection closed")

def on_open(ws):
    print("WebSocket connection established")

ws_url = f"ws://localhost:5000/ws/chats/{chat_session_id}/sessions/{session_id}"
ws = websocket.WebSocketApp(ws_url,
                            on_open=on_open,
                            on_message=on_message,
                            on_error=on_error,
                            on_close=on_close)

# Start WebSocket in a separate thread
ws_thread = threading.Thread(target=ws.run_forever)
ws_thread.daemon = True
ws_thread.start()

# Wait for WebSocket to connect
time.sleep(1)

# Step 3: Read and send audio chunks
def send_audio_chunks():
    # Open the WAV file
    with wave.open(audio_file_path, 'rb') as wav_file:
        # Get file parameters
        n_channels = wav_file.getnchannels()
        sample_width = wav_file.getsampwidth()
        frame_rate = wav_file.getframerate()
        n_frames = wav_file.getnframes()
        
        print(f"Audio file: {n_channels} channels, {frame_rate} Hz, {n_frames} frames")
        
        # Calculate chunk size (e.g., 0.5 seconds of audio)
        chunk_size = int(frame_rate * 0.5)
        
        # Read and send chunks
        frames_sent = 0
        while frames_sent < n_frames:
            # Read a chunk of frames
            chunk_frames = min(chunk_size, n_frames - frames_sent)
            data = wav_file.readframes(chunk_frames)
            frames_sent += chunk_frames
            
            # Send the chunk
            response = requests.post(
                f"{base_url}/chats/{chat_session_id}/sessions/{session_id}/wav",
                data=data,
                headers={"Content-Type": "application/octet-stream"}
            )
            
            print(f"Sent chunk: {len(data)} bytes, response: {response.json()}")
            
            # Small delay to simulate real-time recording
            time.sleep(0.1)

send_audio_chunks()

# Step 4: Close the session to get the final transcription
print("Closing session...")
response = requests.delete(f"{base_url}/chats/{chat_session_id}/sessions/{session_id}")
print(f"Session closed: {response.json()}")

# Wait to receive the final transcription
time.sleep(3)

# Step 5: Setting memories based on the conversation
if ws_messages:
    # Find the recognized transcription
    recognized_messages = [msg for msg in ws_messages if msg.get("event") == "recognized"]
    if recognized_messages:
        transcription = recognized_messages[-1]["text"]
        
        # Create a simple chat history
        chat_history = [
            {"text": "Hello, how can I help you today?"},
            {"text": transcription},
            {"text": "I'll take care of that for you."}
        ]
        
        # Set memories
        response = requests.post(
            f"{base_url}/chats/{chat_session_id}/set-memories",
            json=chat_history
        )
        print(f"Memories set: {response.json()}")

# Step 6: Get memories
response = requests.get(f"{base_url}/chats/{chat_session_id}/get-memories")
print(f"Retrieved memories: {response.json()}")

# Clean up
ws.close()