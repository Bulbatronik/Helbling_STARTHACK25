const chatSessionIdInput = document.getElementById('chatSessionId');
const languageInput = document.getElementById('language');
const startSessionButton = document.getElementById('startSession');
const closeSessionButton = document.getElementById('closeSession');
const audioFileInput = document.getElementById('audioFile');
const sendAudioButton = document.getElementById('sendAudio');
const logDiv = document.getElementById('log');

let sessionId = null;
let websocket = null;

function logMessage(message) {
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
            if (message.event === 'recognizing' || message.event === 'recognized') {
                logMessage(`Transcription: ${message.text}`);
            } else if (message.error) {
                logMessage(`Error: ${message.error}`);
            }
        };

        websocket.onopen = () => {
            logMessage('WebSocket connected.');
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
        const formData = new FormData();
        formData.append('audio', file);

        await fetch(`http://localhost:5000/chats/${chatSessionId}/sessions/${sessionId}/wav`, {
            method: 'POST',
            body: file,
        });

        logMessage('Audio sent.');
    } catch (error) {
        logMessage(`Error sending audio: ${error.message}`);
    }
});