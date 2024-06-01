// Block access to document.fonts API
Object.defineProperty(document, 'fonts', {
    get: function() {
        return {
            load: function() { return Promise.resolve(); },
            check: function() { return false; },
            addEventListener: function() {},
            removeEventListener: function() {},
            clear: function() {}
        };
    },
    configurable: false
});

// Remove @font-face rules from stylesheets
const styleSheets = document.styleSheets;
for (let i = 0; i < styleSheets.length; i++) {
    const cssRules = styleSheets[i].cssRules || [];
    for (let j = cssRules.length - 1; j >= 0; j--) {
        if (cssRules[j].type === CSSRule.FONT_FACE_RULE) {
            styleSheets[i].deleteRule(j);
        }
    }
}

// Observe new style tags and remove @font-face rules dynamically
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            mutation.addedNodes.forEach((node) => {
                if (node.tagName === 'STYLE' || node.tagName === 'LINK') {
                    const cssRules = node.sheet.cssRules || [];
                    for (let j = cssRules.length - 1; j >= 0; j--) {
                        if (cssRules[j].type === CSSRule.FONT_FACE_RULE) {
                            node.sheet.deleteRule(j);
                        }
                    }
                }
            });
        }
    });
});

observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});
