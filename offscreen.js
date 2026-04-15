let currentAudio = null;
let currentPlayingValue = 0;
let ttsAudio = null;
let isTtsPlaying = false;
let ttsQueue = [];

function sendLog(msg) {
    console.log(msg);
    chrome.runtime.sendMessage({ type: 'DEBUG_OFFSCREEN', msg: msg }).catch(()=>{});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return;
    if (message.type === 'PLAY_AUDIO') {
        handlePlayAudio(message.file, message.value || 0);
        sendResponse({ success: true });
    } else if (message.type === 'SPEAK_TEXT') {
        handleIncomingChat(message.text, message.readMode || 'drop');
        sendResponse({ success: true });
    }
    return true;
});

function handleIncomingChat(text, mode) {
    if (!text) return;

    if (mode === 'queue') {
        ttsQueue.push(text);
        processQueue();
    } else {
        // Drop mode: Only play if silent
        if (!isTtsPlaying && !currentAudio) {
            ttsQueue.push(text);
            processQueue();
        } else {
            sendLog(`Ignored (drop mode): ${text}`);
        }
    }
}

function handlePlayAudio(file, value) {
    if (isTtsPlaying && ttsAudio) {
        try { 
            ttsAudio.pause(); 
            ttsAudio.currentTime = 0; 
        } catch (e) { }
        ttsAudio = null;
        isTtsPlaying = false;
        sendLog('Interrupted TTS for incoming Gift sound!');
    }
    
    if (currentAudio) {
        if (value > currentPlayingValue) {
            try { currentAudio.pause(); currentAudio.currentTime = 0; } catch (e) { }
            currentAudio = null;
            playAudio(file, value);
        } else {
            sendLog('Ignored new gift sound because a higher or equal value sound is playing');
        }
    } else {
        playAudio(file, value);
    }
}

function playAudio(file, value) {
    currentPlayingValue = value;
    currentAudio = new Audio(file);
    currentAudio.volume = 1.0;
    currentAudio.play().catch((e) => {
        sendLog(`Gift Audio play error: ${e.message}`);
        currentAudio = null;
        currentPlayingValue = 0;
        processQueue(); // Resume chat if any
    });
    currentAudio.onended = () => {
        currentAudio = null;
        currentPlayingValue = 0;
        processQueue(); // Resume chat if any
    };
}

function processQueue() {
    if (isTtsPlaying || currentAudio || ttsQueue.length === 0) return;

    const text = ttsQueue.shift();
    isTtsPlaying = true;
    sendLog(`Processing TTS: ${text}`);

    chrome.runtime.sendMessage({ type: 'FETCH_TTS', text: text }, (response) => {
        // Catch interrupt during fetch
        if (currentAudio) {
            isTtsPlaying = false;
            ttsQueue.unshift(text); // Put it back to retry after gift
            return;
        }

        if (response && response.success && response.url) {
            ttsAudio = new Audio(response.url);
            ttsAudio.volume = 1.0;
            ttsAudio.onended = () => {
                isTtsPlaying = false;
                ttsAudio = null;
                processQueue();
            };
            ttsAudio.onerror = () => fallbackSpeech(text);
            ttsAudio.play().catch(() => fallbackSpeech(text));
        } else {
            fallbackSpeech(text);
        }
    });
}

function fallbackSpeech(text) {
    if (currentAudio) {
        isTtsPlaying = false;
        ttsAudio = null;
        ttsQueue.unshift(text);
        return;
    }
    
    const encodedText = encodeURIComponent(text);
    ttsAudio = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=tr&client=tw-ob`);
    ttsAudio.volume = 1.0;
    ttsAudio.playbackRate = 1.15;
    ttsAudio.onended = () => {
        isTtsPlaying = false;
        ttsAudio = null;
        processQueue();
    };
    ttsAudio.onerror = () => {
        isTtsPlaying = false;
        ttsAudio = null;
        processQueue();
    };
    ttsAudio.play().catch(() => {
        isTtsPlaying = false;
        ttsAudio = null;
        processQueue();
    });
}