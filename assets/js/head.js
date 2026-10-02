(function () {
    var root = document.documentElement;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        root.classList.add('js');
        setTimeout(function () {
            if (!window.gsap) root.classList.remove('js');
        }, 4000);
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', 'G-8FVFVPS6N0');
})();
