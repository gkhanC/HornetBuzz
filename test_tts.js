const WebSocket = require('ws');
const crypto = require('crypto');

function generateEdgeTts(text, voice = 'tr-TR-AhmetNeural') {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4', {
            headers: {
                'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbnpjfoofahaa',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0'
            }
        });
        const timeoutId = setTimeout(() => { ws.close(); reject('Timeout'); }, 5000);
        ws.on('open', () => {
            const date = new Date().toUTCString();
            ws.send(`X-Timestamp:${date}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);
            const requestId = crypto.randomUUID().replace(/-/g, '');
            ws.send(`X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${date}\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='tr-TR'><voice name='${voice}'><prosody pitch='-2Hz' rate='+15%' volume='+100%'>${text}</prosody></voice></speak>`);
        });
        ws.on('message', (data) => {
            if (typeof data === 'string' && data.includes('Path:turn.end')) {
                clearTimeout(timeoutId); ws.close(); resolve('Success');
            }
        });
        ws.on('error', (err) => reject(err));
    });
}
generateEdgeTts('Merhaba dünya').then(console.log).catch(console.error);
