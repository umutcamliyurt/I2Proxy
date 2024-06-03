document.addEventListener('DOMContentLoaded', () => {
    const proxyToggle = document.getElementById('proxyToggle');
    const i2pLogo = document.getElementById('i2pLogo');

    // Retrieve stored settings and update UI
    chrome.storage.local.get(['proxyEnabled'], result => {
        proxyToggle.checked = result.proxyEnabled || false;
    });

    // Event listener for proxy toggle
    proxyToggle.addEventListener('change', () => {
        if (proxyToggle.checked) {
            setProxy();
        } else {
            resetProxy();
        }

        // Update storage with new proxy status
        chrome.storage.local.set({ proxyEnabled: proxyToggle.checked }).then(() => {
            console.log(`Proxy ${proxyToggle.checked ? "enabled" : "disabled"}`);
        }).catch(error => {
            console.error("Error updating proxy setting:", error);
        });
    });

    // Event listener for logo click
    i2pLogo.addEventListener('click', () => {
        // Open a new tab with the I2P router page
        chrome.tabs.create({ url: 'http://127.0.0.1:7657/home' });
    });

    // Function to update UI based on URL
    function updateUI(url) {
        i2pLogo.src = 'icon/icon.png';
        const padlockLabel = document.createElement('label');
        padlockLabel.textContent = '🔒 Connected to Eepsite';
        padlockLabel.style.color = 'lime';

        if (url && /\.i2p(\/|$)/.test(url)) {
            document.body.appendChild(padlockLabel);
        } else {
            padlockLabel.remove();
        }
    }

    // Get current tab URL and update UI
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const url = tabs[0].url;
        updateUI(url);
    });
});

// Function to set proxy
function setProxy() {
    chrome.proxy.settings.set({
        value: {
            mode: "fixed_servers",
            rules: {
                singleProxy: {
                    scheme: "http",
                    host: "127.0.0.1",
                    port: 4444
                },
                bypassList: ["<local>"]
            }
        },
        scope: "regular"
    }).then(() => {
        // Update storage with proxy enabled status
        chrome.storage.local.set({ proxyEnabled: true });
        console.log("Proxy enabled: 127.0.0.1:4444");
    }).catch(error => {
        console.error("Error enabling proxy:", error);
    });
}

// Function to reset proxy
function resetProxy() {
    chrome.proxy.settings.clear({ scope: "regular" }).then(() => {
        // Update storage with proxy disabled status
        chrome.storage.local.set({ proxyEnabled: false });
        console.log("Proxy disabled");
    }).catch(error => {
        console.error("Error disabling proxy:", error);
    });
}
