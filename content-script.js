(function () {
    const TAG = '🚀 [Hornet Buzz]';
    const isTopFrame = window.self === window.top;

    console.log(`${TAG} Bridge Loaded on Frame: ${window.location.href} (${isTopFrame ? 'TOP' : 'IFRAME'})`);

    // Güvenli mesaj gönderme sarmalayıcısı (Extension context invalidated hatasını önlemek için)
    function safeSendMessage(message) {
        try {
            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage(message).catch(err => {
                    if (err.message.includes('Extension context invalidated')) {
                        console.warn(`${TAG} Eklenti güncellendi. Lütfen sayfayı (F5) yenileyin.`);
                    }
                });
            }
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn(`${TAG} Eklenti güncellendi. Lütfen sayfayı (F5) yenileyin.`);
            }
        }
    }

    // Listen for messages from ANY frame (including the MAIN world inject.js via postMessage)
    window.addEventListener('message', (event) => {
        // We catch HORNET_GIFT_EVENT from inject.js
        if (event.data && event.data.type === 'HORNET_GIFT_EVENT') {
            if (isTopFrame) {
                // We are the top frame, relay to Extension Background
                console.warn(`${TAG} Top Frame relaying event:`, event.data);
                safeSendMessage({
                    type: 'GIFT_DETECTED',
                    source: event.data.source,
                    amount: event.data.amount,
                    gifter: event.data.gifter,
                    amountReached: event.data.amountReached,
                    timestamp: Date.now()
                });
            } else {
                // We are an iframe, relay to Top Frame
                console.log(`${TAG} Iframe forwarding event to Top.`);
                window.top.postMessage(event.data, '*');
            }
        }
        else if (event.data && event.data.type === 'HORNET_CHAT_EVENT') {
            if (isTopFrame) {
                console.log(`${TAG} Top Frame relaying CHAT event:`, event.data);
                safeSendMessage({
                    type: 'CHAT_DETECTED',
                    sender: event.data.sender,
                    text: event.data.text,
                    timestamp: Date.now()
                });
            } else {
                window.top.postMessage(event.data, '*');
            }
        }
    });

    // Arka plandan (background.js) gelen hata ayıklama (debug) mesajlarını yakalayalım.
    try {
        chrome.runtime.onMessage.addListener((req) => {
            if (req.type === 'DEBUG_LOG') {
                console.log('%c🪲 [BG DEBUG]', 'color: #ff00ff; font-weight: bold; font-size: 14px;', req.message);
            }
        });
    } catch (e) { }

    // Handshake
    safeSendMessage({ type: 'HANDSHAKE', status: 'ready' });
})();