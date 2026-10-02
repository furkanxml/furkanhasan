(function () {
    'use strict';

    var TAWK_SRC = 'https://embed.tawk.to/69de5c966161b11c3321139b/1jm6j0ckt';

    var originalTitle = document.title;
    try {
        var native = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
        Object.defineProperty(document, 'title', {
            configurable: true,
            get: function () { return native.get.call(document); },
            set: function () {  }
        });
    } catch (err) {  }

    if (window.MutationObserver) {

        new MutationObserver(function () {
            var el = document.querySelector('title');
            if (el && el.textContent !== originalTitle) el.textContent = originalTitle;
        }).observe(document.head, { childList: true, characterData: true, subtree: true });
    }

    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();

    window.Tawk_API.customStyle = {
        visibility: {
            desktop: { position: 'br', xOffset: 24, yOffset: 24 },
            mobile: { position: 'br', xOffset: 14, yOffset: 92 }
        }
    };

    var s1 = document.createElement('script');
    s1.async = true;
    s1.src = TAWK_SRC;
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    document.body.appendChild(s1);

    document.querySelectorAll('[data-chat-open]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            var api = window.Tawk_API;
            if (api && typeof api.maximize === 'function') {
                e.preventDefault();
                api.maximize();
            }

        });
    });
})();
