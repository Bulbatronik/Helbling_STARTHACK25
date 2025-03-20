const chatSessionIdInput = document.getElementById('chatSessionId');
const languageInput = document.getElementById('language');
const startSessionButton = document.getElementById('startSession');
const closeSessionButton = document.getElementById('closeSession');
const audioFileInput = document.getElementById('audioFile');
const sendAudioButton = document.getElementById('sendAudio');
const recordButton = document.getElementById("recordAudio");
const stopButton = document.getElementById("stopRecording");
const sendRecordedButton = document.getElementById("sendRecordedAudio");
const audioPlayback = document.getElementById("audioPlayback");
const logDiv = document.getElementById('log');

let sessionId = null;
let websocket = null;

 function logMessage(message) {
    logDiv.innerText = '';  // Clears all text inside logDiv
    logDiv.innerHTML += `<p>${message}</p>`;
    logDiv.scrollTop = logDiv.scrollHeight; // Auto-scroll to bottom
 }

startSessionButton.addEventListener('click', async () => {
    const chatSessionId = chatSessionIdInput.value;
    const language = languageInput.value;

    try {
        const response = await fetch(`http://localhost:5000/chats/${chatSessionId}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: language }),
        });

        const data = await response.json();
        sessionId = data.session_id;

        websocket = new WebSocket(`ws://localhost:5000/ws/chats/${chatSessionId}/sessions/${sessionId}`);        

        websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.event === 'recognizing') {
                logMessage(message.text);
                //logMessage(`Recognizing: ${message.text}`);
            } else if (message.event === 'recognized') {
                logMessage(message.text);
                //logMessage(`Final Transcription: ${message.text}`);
            } else if (message.error) {
                logMessage(`Error: ${message.error}`);
            }
        };

        websocket.onopen = () => {
            logMessage('WebSocket connected.\n');
            startSessionButton.disabled = true;
            closeSessionButton.disabled = false;
            sendAudioButton.disabled = false;
        };

        websocket.onclose = () => {
            logMessage('WebSocket closed.');
            startSessionButton.disabled = false;
            closeSessionButton.disabled = true;
            sendAudioButton.disabled = true;
        };

        logMessage(`Session started with ID: ${sessionId}`);
    } catch (error) {
        logMessage(`Error: ${error.message}`);
    }
});

closeSessionButton.addEventListener('click', async () => {
    const chatSessionId = chatSessionIdInput.value;

    try {
        await fetch(`http://localhost:5000/chats/${chatSessionId}/sessions/${sessionId}`, { method: 'DELETE' });
        logMessage('Session closed.');
        websocket.close();
        sessionId = null;
    } catch (error) {
        logMessage(`Error: ${error.message}`);
    }
});

sendAudioButton.addEventListener('click', async () => {
    const chatSessionId = chatSessionIdInput.value;
    const file = audioFileInput.files[0];

    if (!file) {
        logMessage('Please select an audio file.');
        return;
    }

    try {
        await fetch(`http://localhost:5000/chats/${chatSessionId}/sessions/${sessionId}/wav`, {
            method: 'POST',
            body: file,
        });

        logMessage('Audio sent.');
    } catch (error) {
        logMessage(`Error sending audio: ${error.message}`);
    }
});

let mediaRecorder;
let audioChunks = [];
let processingInterval;

recordButton.addEventListener("click", async () => {
    let stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chatSessionId = document.getElementById("chatSessionId").value;

    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    let isSending = false; // Track if the previous fetch request is still ongoing

    mediaRecorder.ondataavailable = async event => {
        audioChunks.push(event.data);
    
        // Check if there are more than 2 chunks and if the previous request is finished
        if (audioChunks.length > 2 && !isSending) {
            isSending = true;  // Mark that a request is being sent
    
            // Get the oldest two chunks
            let lastTwoChunks = audioChunks.slice(0, 2);
            audioChunks.splice(0, 2); // Remove the sent chunks
            let audioBlob = new Blob(lastTwoChunks, { type: "audio/wav" });
            let file_name = `recorded_audio_${Date.now()}.wav`;
            let file = new File([audioBlob], file_name, { type: "audio/wav" });
    
            try {
                // Send the audio file using fetch
                await fetch(`http://localhost:5000/chats/${chatSessionId}/sessions/${sessionId}/wav`, {
                    method: "POST",
                    body: file,
                });
    
                //logMessage("Recorded audio sent.");
            } catch (error) {
                logMessage(`Error sending recorded audio: ${error.message}`);
            }
    
            isSending = false;  // Mark that the request is complete
        }
    };

    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPlayback.src = audioUrl;

        sendRecordedButton.disabled = false;
    };

    mediaRecorder.start(500);
    recordButton.disabled = true;
    stopButton.disabled = false;
});

// Stop recording
stopButton.addEventListener("click", async () => {
    mediaRecorder.stop();
    recordButton.disabled = false;
    stopButton.disabled = true;
});

// Send recorded audio for processing
sendRecordedButton.addEventListener("click", async () => {
    const chatSessionId = document.getElementById("chatSessionId").value;

    if (!audioChunks.length) {
        logMessage("No recorded audio available.");
        return;
    }

    const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
    const file = new File([audioBlob], "recorded_audio.wav", { type: "audio/wav" });

    try {
        await fetch(`http://localhost:5000/chats/${chatSessionId}/sessions/${sessionId}/wav`, {
            method: "POST",
            body: file,
        });

        logMessage("Recorded audio sent.");
    } catch (error) {
        logMessage(`Error sending recorded audio: ${error.message}`);
    }
});