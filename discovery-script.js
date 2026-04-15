(function() {
    const KEYWORDS = ['gift', 'award', 'coin', 'diamond'];
    const selectorFrequency = {};

    function getSelector(el) {
        if (!(el instanceof Element)) return;
        const path = [];
        while (el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
                selector += '#' + el.id;
                path.unshift(selector);
                break;
            } else {
                let sibling = el, nth = 1;
                while (sibling = sibling.previousElementSibling) {
                    if (sibling.nodeName.toLowerCase() == selector) nth++;
                }
                if (nth != 1) selector += ":nth-of-type(" + nth + ")";
            }
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(" > ");
    }

    function logElement(el) {
        const dataAttrs = {};
        for (const attr of el.attributes) {
            if (attr.name.startsWith('data-')) {
                dataAttrs[attr.name] = attr.value;
            }
        }
        console.log('[Discovery] New Element:', {
            className: el.className,
            innerText: el.innerText.substring(0, 50),
            data: dataAttrs,
            element: el
        });
    }

    function checkKeywords(el) {
        const text = (el.innerText + ' ' + el.className).toLowerCase();
        const hasKeyword = KEYWORDS.some(k => text.includes(k));
        
        if (hasKeyword) {
            el.style.border = '3px solid red';
            el.style.boxSizing = 'border-box';
            const selector = getSelector(el);
            selectorFrequency[selector] = (selectorFrequency[selector] || 0) + 1;
            console.warn('[Discovery] GIFT CANDIDATE:', selector);
        }
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element
                    logElement(node);
                    checkKeywords(node);
                    // Also check children in case of bulk injection
                    node.querySelectorAll('*').forEach(child => checkKeywords(child));
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // UI Button
    const btn = document.createElement('button');
    btn.innerText = 'Copy Selectors';
    Object.assign(btn.style, {
        position: 'fixed',
        top: '10px',
        left: '10px',
        zIndex: '999999',
        padding: '10px',
        background: '#ff4757',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontWeight: 'bold',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    });

    btn.onclick = () => {
        const sorted = Object.entries(selectorFrequency)
            .sort((a, b) => b[1] - a[1])
            .map(pair => `${pair[1]}x: ${pair[0]}`)
            .join('\n');
        
        const output = sorted || 'No selectors found yet.';
        navigator.clipboard.writeText(output).then(() => {
            alert('Selectors copied to clipboard:\n\n' + output);
        });
    };

    document.body.appendChild(btn);
    console.log('%c[Discovery Script Loaded]', 'color: #2ed573; font-weight: bold; font-size: 1.2em;');
    console.log('Monitoring started. Hit "Copy Selectors" to get candidates.');
})();
