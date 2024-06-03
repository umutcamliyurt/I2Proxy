chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log("Tab updated:", tabId, changeInfo, tab.url);
    updateBadge(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, tab => {
        console.log("Tab activated:", activeInfo.tabId, tab.url);
        updateBadge(activeInfo.tabId, tab.url);
    });
});

function updateBadge(tabId, url) {
    console.log("Checking URL for padlock icon:", url);
    if (url && /\.i2p(\/|$)/.test(url)) {
        console.log("URL domain ends with .i2p:", url);
        chrome.action.setBadgeBackgroundColor({ color: "#000000", tabId: tabId });
        chrome.action.setBadgeText({ text: "🔒", tabId: tabId });
    } else {
        console.log("URL domain does not end with .i2p:", url);
        chrome.action.setBadgeText({ text: "", tabId: tabId });
    }
}

// Configuration flags
let isBlockingJS = true;
let isProxyEnabled = false;
let isCookieIsolationEnabled = true;
let clearHistoryInterval;
const CLEAR_HISTORY_INTERVAL_MS = 30000;
const CUSTOM_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0";

// Function to clear browser history
async function clearBrowserHistory() {
    return new Promise((resolve, reject) => {
        chrome.history.deleteAll(() => {
            if (chrome.runtime.lastError) {
                console.error(`Failed to clear history: ${chrome.runtime.lastError.message}`);
                reject(chrome.runtime.lastError);
            } else {
                console.log("Browser history cleared.");
                resolve();
            }
        });
    });
}

// Function to clear browser cache
async function clearBrowserCache() {
    return new Promise((resolve, reject) => {
        chrome.browsingData.removeCache({}, () => {
            if (chrome.runtime.lastError) {
                console.error(`Failed to clear cache: ${chrome.runtime.lastError.message}`);
                reject(chrome.runtime.lastError);
            } else {
                console.log("Browser cache cleared.");
                resolve();
            }
        });
    });
}

// Function to clear browser history and cache
async function clearBrowserData() {
    await Promise.all([clearBrowserHistory(), clearBrowserCache()]);
}

// Function to start clearing history and cache periodically
function startClearingHistory() {
    clearBrowserData(); // Clear history and cache immediately
    clearHistoryInterval = setInterval(clearBrowserData, CLEAR_HISTORY_INTERVAL_MS); // Clear history and cache every interval
}

// Function to stop clearing history and cache periodically
function stopClearingHistory() {
    if (clearHistoryInterval) {
        clearInterval(clearHistoryInterval);
    }
}

// Function to initialize settings
function initializeSettings() {
    chrome.storage.local.get(["proxyEnabled"], (result) => {
        updateProxyStatus(result.proxyEnabled);
    });
}

// Function to setup periodic clearing
function setupPeriodicClearing() {
    startClearingHistory();
    chrome.runtime.onInstalled.addListener(() => {
        console.log("Extension installed…");
        initializeSettings();
        startClearingHistory();
    });

    chrome.runtime.onStartup.addListener(() => {
        console.log("Extension started…");
        initializeSettings();
        startClearingHistory();
    });
}

// Function to update JavaScript blocking status
function updateJSBlockStatus() {
    console.log("JavaScript blocking enabled");
}

// Function to update Cookie Isolation status
function updateCookieIsolationStatus() {
    console.log("Cookie isolation enabled");
}

// Function to block JavaScript requests
function blockJavaScript(details) {
    if (isBlockingJS && details.type === "script") {
        console.log(`Blocking JavaScript: ${details.url}`);
        return { cancel: true };
    } else {
        console.log(`Allowing: ${details.url}`);
        return { cancel: false };
    }
}

// Add listener for blocking JavaScript requests
chrome.webRequest.onBeforeRequest.addListener(
    blockJavaScript,
    { urls: ["<all_urls>"] },
    ["blocking"]
);

// Function to handle request headers
async function handleRequestHeaders(details) {
    let modifiedHeaders = details.requestHeaders;

    if (isBlockingJS) {
        modifiedHeaders = modifiedHeaders.filter(header =>
            header.name.toLowerCase() !== "dnt" &&
            header.name.toLowerCase() !== "sec-gpc" &&
            header.name.toLowerCase() !== "priority"
        );
        const acceptEncodingHeaderIndex = modifiedHeaders.findIndex(header =>
            header.name.toLowerCase() === "accept-encoding"
        );
        if (acceptEncodingHeaderIndex !== -1) {
            modifiedHeaders[acceptEncodingHeaderIndex].value = "gzip, deflate, br";
        } else {
            modifiedHeaders.push({ name: "Accept-Encoding", value: "gzip, deflate, br" });
        }
    }

    const userAgentHeaderIndex = modifiedHeaders.findIndex(header =>
        header.name.toLowerCase() === "user-agent"
    );
    if (userAgentHeaderIndex !== -1) {
        modifiedHeaders[userAgentHeaderIndex].value = CUSTOM_USER_AGENT;
    } else {
        modifiedHeaders.push({ name: "User-Agent", value: CUSTOM_USER_AGENT });
    }

    const acceptHeaderIndex = modifiedHeaders.findIndex(header =>
        header.name.toLowerCase() === "accept"
    );
    if (acceptHeaderIndex !== -1) {
        modifiedHeaders[acceptHeaderIndex].value = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
    } else {
        modifiedHeaders.push({ name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" });
    }

    const acceptLanguageHeaderIndex = modifiedHeaders.findIndex(header =>
        header.name.toLowerCase() === "accept-language"
    );
    if (acceptLanguageHeaderIndex !== -1) {
        modifiedHeaders[acceptLanguageHeaderIndex].value = "en-US,en;q=0.5";
    } else {
        modifiedHeaders.push({ name: "Accept-Language", value: "en-US,en;q=0.5" });
    }

    if (isCookieIsolationEnabled) {
        const cookies = await new Promise((resolve, reject) => {
            chrome.cookies.getAll({}, (cookies) => {
                if (chrome.runtime.lastError) {
                    console.error(`Error getting cookies: ${chrome.runtime.lastError.message}`);
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(cookies);
                }
            });
        });
        await Promise.all(cookies.map(cookie =>
            new Promise((resolve, reject) => {
                chrome.cookies.remove({
                    url: details.url + cookie.path,
                    name: cookie.name
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.error(`Failed to remove cookie: ${chrome.runtime.lastError.message}`);
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            })
        ));
    }

    return { requestHeaders: modifiedHeaders };
}

// Add listener for modifying request headers
chrome.webRequest.onBeforeSendHeaders.addListener(
    handleRequestHeaders,
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
);

// Function to handle proxy requests
chrome.proxy.onRequest.addListener(
    (details) => {
        try {
            const url = new URL(details.url);
            if (url.hostname.endsWith(".i2p")) {
                return {
                    type: "http",
                    host: "127.0.0.1",
                    port: 4444
                };
            } else if (url.hostname === "127.0.0.1") {
                console.log(`Allowing request to localhost: ${details.url}`);
                return { type: "direct" };
            } else if (isProxyEnabled) {
                return {
                    type: "http",
                    host: "127.0.0.1",
                    port: 4444
                };
            }
        } catch (error) {
            console.error(`Proxy error for URL ${details.url}: ${error.message}`);
        }
        return { type: "direct" };
    },
    { urls: ["<all_urls>"] }
);

// Function to update proxy status
function updateProxyStatus(proxyEnabled) {
    isProxyEnabled = proxyEnabled;
    console.log(`Proxy ${proxyEnabled ? "enabled" : "disabled"}`);
}

// Listen for storage changes and update proxy status accordingly
chrome.storage.onChanged.addListener((changes, areaName) => {
    console.log("Storage changed…");
    if (changes.hasOwnProperty("proxyEnabled")) {
        updateProxyStatus(changes.proxyEnabled.newValue);
    }
});

// Initialize settings and setup clearing on startup
initializeSettings();
setupPeriodicClearing();
