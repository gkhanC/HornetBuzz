let currentAudio = null;
let currentPlayingValue = 0;
let ttsAudio = null;
let isTtsPlaying = false;

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
        handleSpeakText(message.text);
        sendResponse({ success: true });
    }
    return true;
});

function handlePlayAudio(file, value) {
    // Gift takes absolute priority over TTS
    if (isTtsPlaying && ttsAudio) {
        try { 
            ttsAudio.pause(); 
            ttsAudio.currentTime = 0; 
        } catch (e) { }
        ttsAudio = null;
        isTtsPlaying = false;
        sendLog('Interrupted TTS for incoming Gift sound!');
    }
    
    // Higher value gift can interrupt lower value gift
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
    });
    currentAudio.onended = () => {
        currentAudio = null;
        currentPlayingValue = 0;
    };
}

function handleSpeakText(text) {
    if (!text) return;
    
    // NO QUEUING: If anything is playing, drop the message.
    if (currentAudio || isTtsPlaying) {
        sendLog(`Ignored chat text "${text}" because another sound/speech is already playing.`);
        return;
    }
    
    isTtsPlaying = true;
    sendLog(`Starting Edge TTS Generation for: ${text}`);
    
    chrome.runtime.sendMessage({ type: 'FETCH_TTS', text: text }, (response) => {
        // Double check after fetch starts/finishes if a gift arrived in between
        if (currentAudio) {
            isTtsPlaying = false;
            return;
        }

        if (response && response.success && response.url) {
            ttsAudio = new Audio(response.url);
            ttsAudio.volume = 1.0;
            ttsAudio.onended = () => {
                isTtsPlaying = false;
                ttsAudio = null;
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
        return;
    }
    
    const encodedText = encodeURIComponent(text);
    ttsAudio = new Audio(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=tr&client=tw-ob`);
    ttsAudio.volume = 1.0;
    ttsAudio.playbackRate = 1.15;
    ttsAudio.onended = () => {
        isTtsPlaying = false;
        ttsAudio = null;
    };
    ttsAudio.onerror = () => {
        isTtsPlaying = false;
        ttsAudio = null;
    };
    ttsAudio.play().catch(() => {
        isTtsPlaying = false;
        ttsAudio = null;
    });
}