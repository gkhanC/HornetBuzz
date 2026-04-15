document.addEventListener('DOMContentLoaded', () => {
    const historyList = document.getElementById('historyList');
    const refreshBtn = document.getElementById('refreshBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');

    // Counters
    const totalGoalEl = document.getElementById('totalGoal');
    const lastDeltaEl = document.getElementById('lastDelta');

    function updateUI(state, history) {
        if (state) {
            const oldDelta = lastDeltaEl.innerText;
            totalGoalEl.innerText = state.amountReached;
            lastDeltaEl.innerText = state.delta;

            // Flash effect if delta changed
            if (state.delta > 0 && state.delta != oldDelta) {
                lastDeltaEl.classList.remove('flash');
                void lastDeltaEl.offsetWidth; // Force reflow
                lastDeltaEl.classList.add('flash');
            }
        }

        if (history) {
            if (history.length === 0) {
                historyList.innerHTML = '<li class="empty-msg">Henüz hediye yok...</li>';
                return;
            }

            historyList.innerHTML = history.map(item => `
                <li>
                    <span>${item.text}</span>
                    <span class="time">${item.time}</span>
                </li>
            `).join('');
        }
    }

    function syncState() {
        chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
            if (response) {
                updateUI(response.state, response.history);
            }
        });
    }

    // Listen for real-time updates from background
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'STATE_UPDATED') {
            updateUI(msg.state, msg.history);
        }
    });

    refreshBtn.onclick = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'FORCE_REFRESH' }, () => {
                    alert('Observer reloaded!');
                });
            }
        });
    };

    // Chat Settings Logic
    const readChatToggle = document.getElementById('readChatToggle');
    const filterModeRadios = document.getElementsByName('filterMode');
    const readModeRadios = document.getElementsByName('readMode');
    const newUserInput = document.getElementById('newUserInput');
    const addUserBtn = document.getElementById('addUserBtn');
    const filterListUl = document.getElementById('filterList');

    let chatSettings = {
        enabled: true,
        mode: 'blacklist',
        readMode: 'drop',
        users: []
    };

    function renderFilterList() {
        filterListUl.innerHTML = '';
        chatSettings.users.forEach(user => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${user}</span> <button class="delete-btn" data-user="${user}">X</button>`;
            filterListUl.appendChild(li);
        });

        // Delete handlers
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.onclick = (e) => {
                const u = e.target.getAttribute('data-user');
                chatSettings.users = chatSettings.users.filter(x => x !== u);
                saveSettings();
            };
        });
    }

    function saveSettings() {
        chrome.storage.local.set({ chatSettings }, () => {
            renderFilterList();
        });
    }

    chrome.storage.local.get(['chatSettings'], (res) => {
        if (res.chatSettings) {
            chatSettings = { ...chatSettings, ...res.chatSettings };
            readChatToggle.checked = chatSettings.enabled;
            Array.from(filterModeRadios).forEach(r => r.checked = (r.value === chatSettings.mode));
            Array.from(readModeRadios).forEach(r => r.checked = (r.value === chatSettings.readMode));
            renderFilterList();
        }
    });

    readChatToggle.onchange = (e) => {
        chatSettings.enabled = e.target.checked;
        saveSettings();
    };

    Array.from(filterModeRadios).forEach(r => {
        r.onchange = (e) => {
            chatSettings.mode = e.target.value;
            saveSettings();
        };
    });

    Array.from(readModeRadios).forEach(r => {
        r.onchange = (e) => {
            chatSettings.readMode = e.target.value;
            saveSettings();
        };
    });

    addUserBtn.onclick = () => {
        const u = newUserInput.value.trim();
        if (u && !chatSettings.users.includes(u)) {
            chatSettings.users.push(u);
            newUserInput.value = '';
            saveSettings();
        }
    };

    resetViewBtn.onclick = () => {
        totalGoalEl.innerText = '0';
        lastDeltaEl.innerText = '0';
        lastDeltaEl.classList.remove('flash');
    };

    // Initial Sync
    syncState();
});
