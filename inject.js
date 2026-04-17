(function () {
    const OriginalWS = window.WebSocket;

    function processParsedJson(json) {
        if (json.object && json.object.className === 'SNSGiftMessage') {
            const amount = json.object.metadata?.award?.amount || 0;
            const gifter = json.object.senderName || 'Anonymous';
            window.top.postMessage({ type: 'HORNET_GIFT_EVENT', source: 'SNSGiftMessage', amount: amount, gifter: gifter }, '*');
        }

        if (json.type === 'publish' && json.message && json.message.includes('goalUpdate')) {
            const inner = JSON.parse(json.message);
            if (inner.amountReached !== undefined) {
                window.top.postMessage({ type: 'HORNET_GIFT_EVENT', source: 'goalUpdate', amountReached: inner.amountReached }, '*');
            }
        }

        if (json.object && json.object.type === 'message' && json.object.text) {
            const text = json.object.text;
            let attempts = 0;
            const maxAttempts = 8;
            const interval = 250;

            const check = () => {
                let sender = null;
                const matches = [];
                
                // Sayfadaki tüm metin düğümlerini tara ve metne uyanları topla
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while ((node = walker.nextNode())) {
                    if (node.nodeValue.trim() === text.trim()) {
                        matches.push(node);
                    }
                }

                // Sadece EN SON eşleşmeyi (chat'in en altına yeni eklenen mesajı) alıyoruz
                if (matches.length > 0) {
                    let lastNode = matches[matches.length - 1];
                    let parent = lastNode.parentNode;
                    
                    // Limit vertical search: Mesajın babasından yukarı çıkarak ismi bul
                    for (let i = 0; i < 7; i++) {
                        if (!parent || !parent.querySelector) break;
                        const nameNode = parent.querySelector('.title-cell-name-holder, .tmg-live-video-user-name, .nickname');
                        if (nameNode && nameNode.innerText && nameNode.innerText.trim() !== text.trim()) {
                            sender = nameNode.innerText.trim();
                            break;
                        }
                        parent = parent.parentNode;
                    }
                }

                if (sender && sender !== 'Biri') {
                    window.top.postMessage({ type: 'HORNET_CHAT_EVENT', sender: sender, text: text }, '*');
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(check, interval);
                } else {
                    console.log('%c🚀 [Hornet Buzz] Nickname search failed for text: ' + text, 'color: #e67e22');
                }
            };
            
            check();
        }
    }

    function checkAndNotify(dataStr) {
        try { processParsedJson(JSON.parse(dataStr)); }
        catch (e) {
            if (typeof dataStr === 'string' && dataStr.includes('{')) {
                try { processParsedJson(JSON.parse(dataStr.substring(dataStr.indexOf('{')))); } catch (err2) { }
            }
        }
    }

    try {
        window.WebSocket = function (url, protocols) {
            const socket = new OriginalWS(url, protocols);
            socket.addEventListener('message', (event) => {
                const dataStr = typeof event.data === 'string' ? event.data : (event.data instanceof ArrayBuffer ? new TextDecoder().decode(event.data) : String(event.data));
                checkAndNotify(dataStr);
            });
            return socket;
        };
        Object.assign(window.WebSocket, OriginalWS);
        window.WebSocket.prototype = OriginalWS.prototype;
    } catch (err) { }
})();