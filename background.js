let history = [];
const MAX_HISTORY = 50;
let lastAmountReached = null;
let latestState = { amountReached: 0, delta: 0 };

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'HANDSHAKE') { sendResponse({ ack: true }); }
    else if (request.type === 'GIFT_DETECTED') { processEvent(request); }
    else if (request.type === 'GET_STATE') { sendResponse({ history, state: latestState }); }
    else if (request.type === 'CHAT_DETECTED') { processChat(request); }
    else if (request.type === 'FETCH_TTS') {
        generateEdgeTts(request.text)
            .then(b64 => sendResponse({ success: true, url: b64 }))
            .catch(err => sendResponse({ success: false }));
        return true;
    }
});

function processEvent(event) {
    if (event.source === 'SNSGiftMessage') {
        const amount = parseInt(event.amount) || 0;
        const gifter = event.gifter || 'Birisi';
        history.unshift({ text: `${gifter} ${amount} Kredi Gönderdi`, time: new Date().toLocaleTimeString('tr-TR') });
        if (history.length > MAX_HISTORY) history.pop();
        playTieredSound(amount);
        broadcastState();
    } else if (event.source === 'goalUpdate') {
        const currentAmount = parseInt(event.amountReached) || 0;
        if (lastAmountReached === null) {
            lastAmountReached = currentAmount;
            latestState.amountReached = currentAmount;
            broadcastState();
            return;
        }
        const delta = currentAmount - lastAmountReached;
        if (delta < 0) {
            lastAmountReached = currentAmount;
            latestState.amountReached = currentAmount;
            latestState.delta = 0;
            broadcastState();
            return;
        }
        if (delta > 0) {
            latestState.amountReached = currentAmount;
            latestState.delta = delta;
            history.unshift({ text: `Hedef Güncellendi: +${delta} (Toplam: ${currentAmount})`, time: new Date().toLocaleTimeString('tr-TR') });
            if (history.length > MAX_HISTORY) history.pop();
            playTieredSound(delta);
            broadcastState();
            lastAmountReached = currentAmount;
        }
    }
}

function playTieredSound(value) {
    let soundFile = 'sounds/ses1.mp3';
    switch (true) {
        case (value >= 200): soundFile = 'sounds/ses6.mp3'; break;
        case (value >= 100): soundFile = 'sounds/ses5.mp3'; break;
        case (value >= 20): soundFile = 'sounds/ses4.mp3'; break;
        case (value >= 10): soundFile = 'sounds/ses3.mp3'; break;
        case (value >= 5): soundFile = 'sounds/ses2.mp3'; break;
        default: soundFile = 'sounds/ses1.mp3'; break;
    }
    triggerAudio(soundFile, value);
}

function broadcastState() {
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED', state: latestState, history: history }).catch(() => { });
}

async function ensureOffscreen() {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (!hasDoc) {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Text to speech for chat messages and gift sounds'
        }).catch(() => { });
    }
}

async function triggerAudio(soundFile, value) {
    await ensureOffscreen();
    chrome.runtime.sendMessage({ type: 'PLAY_AUDIO', file: soundFile, value: value, target: 'offscreen' }).catch(() => { });
}

const TURKISH_VOWELS = 'aeıioöuüAEIİOÖUÜ';
const TURKISH_LETTERS = 'abcçdefgğhıijklmnoöprsştuüvyzABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';

function cleanSenderName(name) {
    if (!name) return '';
    // Sadece harf, rakam ve boşlukları koru, emojileri ve özel karakterleri sil
    return name.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ ]/g, '').replace(/\s+/g, ' ').trim();
}

function isGibberish(word) {
    // Sadece harflerden oluşan kısmını kontrol edelim
    const alphaOnly = word.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g, '');
    if (alphaOnly.length <= 3) return false;
    
    const firstThree = alphaOnly.substring(0, 3);
    let vowelsCount = 0;
    let consonantsCount = 0;
    
    for (let char of firstThree) {
        if (TURKISH_VOWELS.includes(char)) {
            vowelsCount++;
        } else {
            consonantsCount++;
        }
    }
    
    // İlk 3 harf tamamen sesli veya tamamen sessizse gibberish say
    return (vowelsCount === 3 || consonantsCount === 3);
}

const ABBREVIATIONS = {
    'hyr': 'hayır',
    'evt': 'evet',
    'naslsn': 'nasılsın',
    'ap': 'a p',
    'Ap': 'a p'
};

function cleanMessageText(text) {
    if (!text) return '';
    
    // 1. Ardışık emojileri teke indir
    let cleaned = text.replace(/(\p{Emoji_Presentation})\p{Emoji_Presentation}+/gu, '$1');
    
    // 2. Kelimeleri ayır, random (gibberish) olanları filtrele ve kısaltmaları düzelt
    let words = cleaned.split(/\s+/);
    let processedWords = words
        .filter(word => !isGibberish(word))
        .map(word => {
            const lowerWord = word.toLowerCase();
            if (ABBREVIATIONS[word]) return ABBREVIATIONS[word];
            if (ABBREVIATIONS[lowerWord]) return ABBREVIATIONS[lowerWord];
            return word;
        });
    
    return processedWords.join(' ').trim();
}

const PROFANITY_LIST = ['annı', 'bacını', 'ailenı', 'aq', 'orusbu', 'orusbu çocuğu', 'cocugu'];

function checkProfanity(text) {
    const lower = text.toLowerCase();
    for (let word of PROFANITY_LIST) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(lower)) return true;
    }
    return false;
}

function processChat(event) {
    const rawSender = event.sender;
    const rawText = event.text || '';
    
    const sender = cleanSenderName(rawSender);
    const text = cleanMessageText(rawText);
    
    // Strict requirement: No nickname, no reading.
    if (!sender || sender === 'Biri') {
        console.log('[Background] Skipping chat because sender name is invalid or cleaned to empty.');
        return;
    }

    if (!text) {
        console.log('[Background] Skipping chat because text is empty after cleaning.');
        return;
    }

    chrome.storage.local.get(['chatSettings'], (res) => {
        const settings = res.chatSettings || { enabled: true, mode: 'blacklist', users: [] };
        if (!settings.enabled) return;

        const isUserInList = settings.users.includes(sender);
        if (settings.mode === 'blacklist' && isUserInList) return;
        if (settings.mode === 'whitelist' && !isUserInList) return;
        
        // Küfür kontrolü temizlenmiş metin üzerinden yapılır
        if (checkProfanity(text)) return;

        // Custom format requested by user
        triggerSpeech(`${sender} Diyor ki ${text}`, settings.readMode || 'drop');
    });
}

async function triggerSpeech(text, readMode = 'drop') {
    if (!text) return;
    await ensureOffscreen();
    chrome.runtime.sendMessage({ type: 'SPEAK_TEXT', text: text, readMode: readMode, target: 'offscreen' }).catch(() => { });
}

function generateEdgeTts(text, voice = 'tr-TR-AhmetNeural') {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4');
        ws.binaryType = 'arraybuffer';
        let audioParts = [];

        const timeoutId = setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) ws.close();
            reject(new Error('Timeout'));
        }, 5000);

        ws.onopen = () => {
            const date = new Date().toUTCString();
            ws.send(`X-Timestamp:${date}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
            const requestId = crypto.randomUUID().replace(/-/g, '');
            const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${date}\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='tr-TR'><voice name='${voice}'><prosody pitch='-2Hz' rate='+15%' volume='+100%'>${safeText}</prosody></voice></speak>`);
        };

        ws.onmessage = (event) => {
            if (typeof event.data === 'string') {
                if (event.data.includes('Path:turn.end')) {
                    clearTimeout(timeoutId);
                    ws.close();
                    if (audioParts.length > 0) {
                        const totalLength = audioParts.reduce((a, b) => a + b.byteLength, 0);
                        const combined = new Uint8Array(totalLength);
                        let offset = 0;
                        for (let b of audioParts) {
                            combined.set(new Uint8Array(b), offset);
                            offset += b.byteLength;
                        }
                        let binary = '';
                        const chunkSize = 8192;
                        for (let i = 0; i < combined.length; i += chunkSize) {
                            binary += String.fromCharCode.apply(null, combined.subarray(i, i + chunkSize));
                        }
                        resolve('data:audio/mp3;base64,' + btoa(binary));
                    } else {
                        reject(new Error('No audio'));
                    }
                }
            } else if (event.data instanceof ArrayBuffer) {
                const view = new Uint8Array(event.data);
                let headerEndIndex = 0;
                const pathAudioSeq = [80, 97, 116, 104, 58, 97, 117, 100, 105, 111, 13, 10];
                for (let i = 0; i < view.length - pathAudioSeq.length; i++) {
                    let match = true;
                    for (let j = 0; j < pathAudioSeq.length; j++) {
                        if (view[i + j] !== pathAudioSeq[j]) { match = false; break; }
                    }
                    if (match) {
                        headerEndIndex = i + pathAudioSeq.length;
                        break;
                    }
                }
                audioParts.push(event.data.slice(headerEndIndex > 0 ? headerEndIndex : 0));
            }
        };
        ws.onerror = () => reject(new Error('WS Error'));
        ws.onclose = () => clearTimeout(timeoutId);
    });
}