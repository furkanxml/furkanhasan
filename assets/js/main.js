(function () {
    'use strict';

    var root = document.documentElement;

    document.querySelectorAll('[data-copy]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (!navigator.clipboard) return;
            navigator.clipboard.writeText(btn.dataset.copy).then(function () {
                btn.classList.add('is-copied');
                setTimeout(function () { btn.classList.remove('is-copied'); }, 1800);
            }, function () {});
        });
    });

    var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/';
    var pdfjsPromise = null;
    var pdfDocs = {};

    function loadPdfjs() {
        if (!pdfjsPromise) {
            pdfjsPromise = import(PDFJS + 'pdf.min.mjs').then(function (lib) {
                lib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
                return lib;
            });
        }
        return pdfjsPromise;
    }

    function getPdf(url) {
        if (!pdfDocs[url]) {
            pdfDocs[url] = loadPdfjs().then(function (lib) { return lib.getDocument(url).promise; });
        }
        return pdfDocs[url];
    }

    function renderPage(pdf, number, cssWidth) {
        return pdf.getPage(number).then(function (page) {
            var base = page.getViewport({ scale: 1 });
            var ratio = Math.min(window.devicePixelRatio || 1, 2);
            var viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
            var canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise
                .then(function () { return canvas; });
        });
    }

    var thumbs = document.querySelectorAll('[data-pdf]');
    if (thumbs.length && 'IntersectionObserver' in window) {
        var thumbObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var holder = entry.target;
                thumbObserver.unobserve(holder);
                getPdf(holder.dataset.pdf)
                    .then(function (pdf) { return renderPage(pdf, 1, holder.offsetWidth); })
                    .then(function (canvas) {
                        holder.appendChild(canvas);
                        requestAnimationFrame(function () { holder.classList.add('is-ready'); });
                    })
                    .catch(function () {});
            });
        }, { rootMargin: '400px' });
        thumbs.forEach(function (el) { thumbObserver.observe(el); });
    }

    var modal = document.getElementById('cert-modal');
    if (modal && typeof modal.showModal === 'function') {
        var pages = modal.querySelector('.modal__pages');
        var statusEl = modal.querySelector('.modal__status');
        var openLink = modal.querySelector('[data-modal-open]');
        var downloadLink = modal.querySelector('[data-modal-download]');
        var openToken = 0;

        document.querySelectorAll('[data-cert-open]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var url = btn.dataset.file;
                var token = ++openToken;
                modal.querySelector('.modal__title').textContent = btn.dataset.title;
                modal.querySelector('.modal__sub').textContent = btn.dataset.issuer;
                openLink.href = url;
                downloadLink.href = url;
                pages.innerHTML = '';
                statusEl.textContent = 'Yükleniyor…';
                statusEl.hidden = false;
                modal.showModal();
                if (window.__lenis) window.__lenis.stop();

                var width = Math.min(pages.clientWidth || 900, 1000);
                getPdf(url).then(function (pdf) {
                    var chain = Promise.resolve();
                    for (var n = 1; n <= Math.min(pdf.numPages, 5); n++) {
                        (function (num) {
                            chain = chain.then(function () { return renderPage(pdf, num, width); })
                                .then(function (canvas) {
                                    if (token !== openToken) return;
                                    pages.appendChild(canvas);
                                    statusEl.hidden = true;
                                });
                        })(n);
                    }
                    return chain;
                }).catch(function () {
                    if (token !== openToken) return;
                    statusEl.textContent = 'Önizleme yüklenemedi. "Yeni sekmede aç" ile görüntüleyebilirsiniz.';
                });
            });
        });

        modal.querySelector('[data-modal-close]').addEventListener('click', function () { modal.close(); });
        modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
        modal.addEventListener('close', function () {
            openToken++;
            pages.innerHTML = '';
            if (window.__lenis) window.__lenis.start();
        });
    } else if (modal) {

        document.querySelectorAll('[data-cert-open]').forEach(function (btn) {
            btn.addEventListener('click', function () { window.open(btn.dataset.file, '_blank', 'noopener'); });
        });
    }

    (function () {
        var narrow = matchMedia('(max-width: 899px)');
        var lastY = window.scrollY;
        var ticking = false;

        var update = function () {
            ticking = false;
            var y = window.scrollY;
            var delta = y - lastY;
            if (!narrow.matches) { root.classList.remove('nav-hidden'); lastY = y; return; }
            if (Math.abs(delta) < 8) return;
            var nearTop = y < 120;
            var nearEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 60;
            root.classList.toggle('nav-hidden', delta > 0 && !nearTop && !nearEnd);
            lastY = y;
        };

        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
    })();

    var form = document.querySelector('.form');
    if (form) {
        var statusBox = form.querySelector('[data-form-status]');
        var submitBtn = form.querySelector('[type="submit"]');

        var showStatus = function (ok, text) {
            statusBox.className = 'notice ' + (ok ? 'notice--ok' : 'notice--err');
            statusBox.textContent = text;
            statusBox.hidden = false;
        };

        var clearErrors = function () {
            form.querySelectorAll('.field').forEach(function (field) {
                field.classList.remove('field--err');
                var input = field.querySelector('input, textarea');
                input.removeAttribute('aria-invalid');
                input.removeAttribute('aria-describedby');
                var small = field.querySelector('small');
                if (small) small.remove();
            });
        };

        var showErrors = function (errors) {
            Object.keys(errors).forEach(function (name) {
                var input = form.elements[name];
                if (!input || !input.closest) return;
                var field = input.closest('.field');
                if (!field) return;
                var small = document.createElement('small');
                small.id = name + '-err';
                small.textContent = errors[name];
                field.classList.add('field--err');
                field.appendChild(small);
                input.setAttribute('aria-invalid', 'true');
                input.setAttribute('aria-describedby', small.id);
            });
        };

        var params = new URLSearchParams(location.search);
        if (params.get('form') === 'ok') showStatus(true, 'Teşekkürler, mesajınız ulaştı. En kısa sürede döneceğim.');
        if (params.get('form') === 'hata') showStatus(false, 'Mesaj gönderilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.');

        var validate = function (d) {
            var errors = {};
            if (d.name.length < 2 || d.name.length > 80) errors.name = 'Adınızı yazın.';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) || d.email.length > 120) errors.email = 'Geçerli bir e-posta adresi girin.';
            if (d.subject.length > 120) errors.subject = 'Konu en fazla 120 karakter olabilir.';
            if (d.message.length < 10) errors.message = 'Mesaj en az 10 karakter olmalı.';
            else if (d.message.length > 3000) errors.message = 'Mesaj en fazla 3000 karakter olabilir.';
            return errors;
        };

        var tawkCall = function (method, args) {
            return new Promise(function (resolve, reject) {
                var api = window.Tawk_API;
                if (!api || typeof api[method] !== 'function') { reject(new Error('Tawk hazır değil')); return; }
                var timer = setTimeout(function () { reject(new Error('Tawk zaman aşımı')); }, 6000);
                api[method].apply(api, args.concat(function (err) {
                    clearTimeout(timer);
                    if (err) reject(err); else resolve();
                }));
            });
        };

        var sendToTawk = function (d) {

            var meta = { isim: d.name, email: d.email, konu: d.subject || '-' };
            for (var i = 0, part = 1; i < d.message.length; i += 240, part++) {
                meta[part === 1 ? 'mesaj' : 'mesaj_' + part] = d.message.slice(i, i + 240);
            }
            return tawkCall('setAttributes', [{ name: d.name, email: d.email }])
                .catch(function () {  })
                .then(function () { return tawkCall('addEvent', ['İletişim Formu', meta]); });
        };

        var sendToServer = function () {
            return fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: { 'Accept': 'application/json' }
            })
                .then(function (res) { return res.json(); })
                .then(function (json) { if (!json.ok) throw new Error(json.message); });
        };

        var settle = function (promise) {
            return promise.then(function () { return true; }, function () { return false; });
        };

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            clearErrors();
            statusBox.hidden = true;

            var d = {
                name: form.elements.namedItem('name').value.trim(),
                email: form.elements.namedItem('email').value.trim(),
                subject: form.elements.namedItem('subject').value.trim(),
                message: form.elements.namedItem('message').value.trim()
            };
            var errors = validate(d);
            if (Object.keys(errors).length) {
                showErrors(errors);
                showStatus(false, 'Lütfen işaretli alanları kontrol edin.');
                return;
            }
            if (form.elements.namedItem('website').value) {
                showStatus(true, 'Teşekkürler, mesajınız ulaştı.');
                form.reset();
                return;
            }

            submitBtn.disabled = true;
            var jobs = [settle(sendToTawk(d))];

            if (/\.php$/.test(form.getAttribute('action')) && window.fetch && window.FormData) jobs.push(settle(sendToServer()));

            Promise.all(jobs).then(function (results) {
                if (results.indexOf(true) === -1) {
                    showStatus(false, 'Mesaj gönderilemedi. Doğrudan e-posta ile ulaşabilirsiniz: ' + (document.querySelector('.mailbox__address') || {}).textContent);
                    return;
                }
                showStatus(true, 'Teşekkürler ' + d.name + ', mesajınız ulaştı. En kısa sürede döneceğim.');
                form.reset();

                var api = window.Tawk_API;
                if (results[0] && api && typeof api.getStatus === 'function' && api.getStatus() === 'online'
                    && typeof api.maximize === 'function') {
                    api.maximize();
                }
            }).then(function () { submitBtn.disabled = false; });
        });
    }

    if (!root.classList.contains('js') || !window.gsap || !window.ScrollTrigger) {
        root.classList.remove('js');
        return;
    }

    gsap.registerPlugin(ScrollTrigger);

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    ScrollTrigger.clearScrollMemory('manual');

    ScrollTrigger.config({ ignoreMobileResize: true });
    var navEntry = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    var isReload = navEntry && navEntry.type === 'reload';
    var pendingTarget = null;
    if (location.hash && location.hash !== '#') {
        if (!isReload) pendingTarget = document.querySelector(location.hash);
        history.replaceState(null, '', location.pathname + location.search);
    }
    window.scrollTo(0, 0);

    var userScrolled = false;
    ['wheel', 'touchstart', 'keydown'].forEach(function (type) {
        window.addEventListener(type, function () { userScrolled = true; }, { once: true, passive: true });
    });

    var isTouch = !matchMedia('(hover: hover) and (pointer: fine)').matches;

    var lenis = null;
    if (window.Lenis && !isTouch) {
        lenis = new Lenis({ lerp: 0.09 });
        window.__lenis = lenis;
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
        gsap.ticker.lagSmoothing(0);
    }

    function scrollToTarget(target, immediate) {
        if (!lenis) {
            var behavior = immediate ? 'auto' : 'smooth';
            if (target === 0) window.scrollTo({ top: 0, behavior: behavior });
            else target.scrollIntoView({ behavior: behavior });
            return;
        }
        lenis.scrollTo(target, {
            duration: 1.4,
            immediate: !!immediate,
            force: true,
            onComplete: function () {

                if (target !== 0 && Math.abs(target.getBoundingClientRect().top) > 2) {
                    lenis.scrollTo(target, { immediate: true, force: true });
                }
            }
        });
    }

    document.querySelectorAll('a[href*="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            var url = new URL(a.href, location.href);
            if (url.pathname !== location.pathname) return;
            if (url.hash === '' || url.hash === '#') {
                e.preventDefault();
                scrollToTarget(0);
                return;
            }
            var target = document.querySelector(url.hash);
            if (!target) return;
            e.preventDefault();
            scrollToTarget(target);
        });
    });

    var loader = document.querySelector('.loader');
    var heroChars = document.querySelectorAll('.hero .ch, .project__title .ch');
    var heroFades = document.querySelectorAll('[data-hero-fade]');
    var heroPhoto = document.querySelector('.hero__photo');
    var intro = gsap.timeline({ defaults: { ease: 'expo.out' } });

    var showLoader = !!loader && !pendingTarget;

    if (loader && showLoader) {

        if (lenis) lenis.stop();
        root.style.overflow = 'hidden';
        var loaderChars = loader.querySelectorAll('.ch');
        intro
            .from(loaderChars, { yPercent: 110, stagger: 0.05, duration: 1 })
            .to(loaderChars, { yPercent: -110, stagger: 0.03, duration: 0.6, ease: 'expo.in' }, '+=0.2')
            .to(loader, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '-=0.25')
            .set(loader, { display: 'none' })
            .call(function () {
                root.style.overflow = '';
                if (lenis) lenis.start();
            });
    } else if (loader) {
        loader.style.display = 'none';
    }

    var startAt = showLoader ? '-=0.7' : 0.1;
    intro.fromTo(heroChars,
        { yPercent: 115, opacity: 1 },
        { yPercent: 0, stagger: 0.035, duration: 1.3 },
        startAt);
    if (heroPhoto) {
        intro.fromTo(heroPhoto,
            { clipPath: 'inset(100% 0% 0% 0%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'expo.inOut' },
            '<-0.2');
        intro.fromTo(heroPhoto.querySelector('img'), { scale: 1.3 }, { scale: 1, duration: 2.4 }, '<');
    }
    intro.fromTo(heroFades,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, stagger: 0.1, duration: 1.2 },
        '<0.4');

    var heroInner = document.querySelector('.hero__inner');

    if (heroInner && !isTouch) {
        gsap.to(heroInner, {
            yPercent: -12,
            opacity: 0.25,
            ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
        });
    }

    if (heroPhoto && !isTouch) {
        gsap.to(heroPhoto, {
            yPercent: 18,
            ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
        });
    }

    document.querySelectorAll('[data-words]').forEach(function (el) {
        gsap.from(el.querySelectorAll('.w > span'), {
            yPercent: 115,
            stagger: 0.06,
            duration: 1.2,
            ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 85%' }
        });
    });

    document.querySelectorAll('[data-scrub]').forEach(function (el) {
        gsap.fromTo(el.querySelectorAll('.w > span'),
            { opacity: 0.14 },
            {
                opacity: 1,
                stagger: 0.1,
                ease: 'none',
                scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true }
            });
    });

    document.querySelectorAll('[data-fade]').forEach(function (el) {
        gsap.from(el, {
            opacity: 0,
            y: 40,
            duration: 1.1,
            ease: 'expo.out',
            scrollTrigger: { trigger: el, start: 'top 90%' }
        });
    });

    document.querySelectorAll('[data-reveal-img]').forEach(function (el) {
        var fromLeft = el.dataset.revealImg === 'left';
        var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 80%' } });
        tl.fromTo(el,
            { clipPath: fromLeft ? 'inset(0% 100% 0% 0%)' : 'inset(100% 0% 0% 0%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut' });
        if (fromLeft) {

            tl.fromTo(el.querySelector('img'), { xPercent: -25 }, { xPercent: 0, duration: 1.8, ease: 'expo.out' }, 0);
        }
    });

    if (!isTouch) document.querySelectorAll('[data-parallax]').forEach(function (img) {
        gsap.fromTo(img,
            { yPercent: -6, scale: 1.15 },
            {
                yPercent: 6,
                scale: 1,
                ease: 'none',
                scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
            });
    });

    var work = document.querySelector('.work');
    if (work) {
        var track = work.querySelector('.work__track');
        var cards = work.querySelectorAll('.card');
        var setBg = function (color) { work.style.setProperty('--bg', color); };
        var mm = gsap.matchMedia();

        mm.add('(min-width: 900px)', function () {
            work.classList.add('is-horizontal');
            var distance = function () { return track.scrollWidth - window.innerWidth; };

            var slide = gsap.to(track, {
                x: function () { return -distance(); },
                ease: 'none',
                scrollTrigger: {
                    trigger: work,
                    pin: work.querySelector('.work__pin'),
                    scrub: 1,
                    end: function () { return '+=' + distance(); },
                    invalidateOnRefresh: true
                }
            });

            cards.forEach(function (card) {
                ScrollTrigger.create({
                    trigger: card,
                    containerAnimation: slide,
                    start: 'left 65%',
                    end: 'right 35%',
                    onToggle: function (self) { if (self.isActive) setBg(card.dataset.color); }
                });
                gsap.fromTo(card.querySelector('img'),
                    { xPercent: -10 },
                    {
                        xPercent: 0,
                        ease: 'none',
                        scrollTrigger: {
                            trigger: card,
                            containerAnimation: slide,
                            start: 'left right',
                            end: 'right left',
                            scrub: true
                        }
                    });
            });

            return function () { work.classList.remove('is-horizontal'); };
        });

        mm.add('(max-width: 899px)', function () {
            cards.forEach(function (card) {
                ScrollTrigger.create({
                    trigger: card,
                    start: 'top 60%',
                    end: 'bottom 40%',
                    onToggle: function (self) { if (self.isActive) setBg(card.dataset.color); }
                });
                gsap.from(card, {
                    y: 80,
                    opacity: 0,
                    duration: 1.2,
                    ease: 'expo.out',
                    scrollTrigger: { trigger: card, start: 'top 88%' }
                });
            });
        });
    }

    var marquee = document.querySelector('.marquee__track');
    var marqueeAnim = marquee && marquee.getAnimations ? marquee.getAnimations()[0] : null;
    if (lenis && marqueeAnim) {
        lenis.on('scroll', function (l) {
            var boost = 1 + Math.min(Math.abs(l.velocity) / 6, 5);
            marqueeAnim.playbackRate = (l.direction < 0 ? -1 : 1) * boost;
        });
    }

    var topbar = document.querySelector('.topbar');
    var lightTriggers = Array.prototype.map.call(document.querySelectorAll('[data-theme="light"]'), function (section) {
        return ScrollTrigger.create({
            trigger: section,
            start: 'top 40px',
            end: 'bottom 40px',
            onToggle: function () {
                topbar.classList.toggle('is-light', lightTriggers.some(function (t) { return t.isActive; }));
            }
        });
    });

    gsap.to('.logo__mark', {
        rotation: 360,
        ease: 'none',
        scrollTrigger: { start: 0, end: 'max', scrub: 1 }
    });

    var mark = document.querySelector('.footer__mark span');
    if (mark) {
        gsap.from(mark, {
            yPercent: 70,
            ease: 'none',
            scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true }
        });
    }

    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
        document.querySelectorAll('[data-magnetic]').forEach(function (el) {
            var mx = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
            var my = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
            el.addEventListener('pointermove', function (e) {
                var r = el.getBoundingClientRect();
                mx((e.clientX - r.left - r.width / 2) * 0.3);
                my((e.clientY - r.top - r.height / 2) * 0.4);
            });
            el.addEventListener('pointerleave', function () { mx(0); my(0); });
        });
    }

    var nav = document.querySelector('.nav');
    var indicator = nav && nav.querySelector('.nav__indicator');
    var current = null;

    function moveIndicator(link) {
        current = link;
        nav.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('is-active', a === link); });
        if (!link) { indicator.style.opacity = '0'; return; }
        indicator.style.opacity = '1';
        indicator.style.width = link.offsetWidth + 'px';
        indicator.style.transform = 'translateX(' + link.offsetLeft + 'px)';
    }

    if (indicator && document.body.classList.contains('is-home')) {
        var navTriggers = [];
        nav.querySelectorAll('[data-nav]').forEach(function (link) {
            var section = document.getElementById(link.dataset.nav);
            if (!section) return;
            var t = ScrollTrigger.create({
                trigger: section,
                start: 'top 50%',
                end: 'bottom 50%',
                onToggle: function () {
                    var active = navTriggers.filter(function (x) { return x.isActive; }).pop();
                    moveIndicator(active ? active.link : null);
                }
            });
            t.link = link;
            navTriggers.push(t);
        });
        ScrollTrigger.addEventListener('refresh', function () { if (current) moveIndicator(current); });
    }

    var pageLoaded = new Promise(function (resolve) {
        if (document.readyState === 'complete') resolve();
        else window.addEventListener('load', resolve);
    });
    var fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    Promise.all([pageLoaded, fontsReady]).then(function () {
        ScrollTrigger.refresh();
        if (pendingTarget) {
            scrollToTarget(pendingTarget, true);
            pendingTarget = null;
        } else if (!userScrolled && window.scrollY > 0) {
            window.scrollTo(0, 0);
            if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
        }
    });
})();
