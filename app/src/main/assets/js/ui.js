// File: app/src/main/assets/js/ui.js

// [HYBRID UPDATE] Helper Icon & Cover
function getIcon(app) {
    let activeBase = (typeof BASE_URL !== 'undefined' && BASE_URL !== '') ? BASE_URL : "https://flowork.cloud";
    return app.icon ? `${activeBase}${app.icon}` : `https://via.placeholder.com/100/222/FFF?text=${app.name[0]}`;
}

function getCover(app) {
    let activeBase = (typeof BASE_URL !== 'undefined' && BASE_URL !== '') ? BASE_URL : "https://flowork.cloud";
    let baseCover = app.cover ? `${activeBase}${app.cover}` :
               (app.seo?.og_image && !app.seo.og_image.startsWith('http') ? `${activeBase}${app.path}/${app.seo.og_image}` :
               (app.icon ? `${activeBase}${app.icon}`.replace('icon.svg', 'cover.webp') : ''));

    return baseCover || '';
}

window.handleImgError = function(img, step, fallbackUrl, finalFallback, placeholder) {
    img.onerror = null;
    if (step === 1) { img.src = fallbackUrl; img.setAttribute('onerror', `handleImgError(this, 2, '', '${finalFallback}', '${placeholder}')`); }
    else if (step === 2) { img.src = finalFallback; img.setAttribute('onerror', `handleImgError(this, 3, '', '', '${placeholder}')`); }
    else { img.src = placeholder; }
};

function renderDashboard(list) {
    const popularApps = list.filter(app => app.popular === 'yes');
    const popularWidget = { id: 'widget-popular', isWidget: true, widgetType: 'popular-list', items: popularApps, category: 'Highlights', source: 'system' };
    let displayList = [...list];
    if (popularApps.length > 0) {
        if (displayList.length > 0) { displayList.splice(1, 0, popularWidget); } else { displayList.push(popularWidget); }
    }
    let html = `<div class="dashboard-container"><div class="home-cats" id="home-cats"></div><div class="apps-list" id="home-grid"></div></div>`;
    if(nativeRoot) nativeRoot.innerHTML = html;
    renderCategories(list);
    renderList(document.getElementById('home-grid'), displayList);
    if(loader) loader.style.display = 'none';
}

function smartSearch(query) {
    const q = query.toLowerCase().trim();
    const grid = document.getElementById('home-grid');
    if(!grid) return;
    if(!q) { renderDashboard(installedApps); return; }
    const scored = installedApps.map(app => {
        let score = 0;
        const titleId = (app.name_id || app.name || '').toLowerCase();
        const titleEn = (app.name_en || app.name || '').toLowerCase();
        const desc = (app.description || '').toLowerCase();
        if (titleId.includes(q) || titleEn.includes(q)) score += 100;
        if (desc.includes(q)) score += 10;
        return { app, score };
    });
    const results = scored.filter(item => item.score > 0).sort((a,b) => b.score - a.score).map(item => item.app);
    renderList(grid, results);
}

function renderCategories(list) {
    const cats = new Set();
    list.forEach(app => { if(app.category) cats.add(app.category); });
    const container = document.getElementById('home-cats');
    if(!container) return;
    container.innerHTML = '';
    const createPill = (label, action, isSpecial = false) => {
        const pill = document.createElement('div');
        pill.className = `cat-pill ${isSpecial ? 'special' : ''} ${label === sys.t('cat_all') ? 'active' : ''}`;
        pill.textContent = label.toUpperCase();
        pill.onclick = () => {
            document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            action();
        };
        container.appendChild(pill);
    };
    createPill(sys.t('cat_all'), () => renderDashboard(installedApps));
    createPill(sys.t('cat_latest'), () => {
        const latest = [...installedApps].sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
        renderList(document.getElementById('home-grid'), latest);
    }, true);
    createPill(sys.t('cat_favorites'), () => {
        const favs = installedApps.filter(app => favoriteIds.includes(String(app.slug || app.id)));
        renderList(document.getElementById('home-grid'), favs);
    }, true);
    cats.forEach(cat => {
        const catKey = 'cat_' + cat.toLowerCase();
        createPill(sys.t(catKey) !== catKey ? sys.t(catKey) : cat, () => {
            const filtered = installedApps.filter(a => a.category === cat);
            renderList(document.getElementById('home-grid'), filtered);
        });
    });
}

function renderList(container, list) {
    if(!container) return;
    container.innerHTML = '';
    if(list.length === 0) { container.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.5;">No apps found.</div>'; return; }
    let appCounter = 0;
    list.forEach(app => {
        if (app.isWidget && app.widgetType === 'popular-list') {
            const card = document.createElement('div');
            card.className = 'app-card popular-list-card';
            let listHtml = '';
            app.items.forEach(popApp => {
                 const icon = getIcon(popApp);
                 const name = popApp['name_' + sys.lang] || popApp.name;
                 const cat = (popApp.category || 'App');
                 listHtml += `
                    <div class="pop-list-item" onclick="launchAppByName('${popApp.name}')">
                        <img src="${icon}" class="pop-mini-icon" onerror="this.src='https://via.placeholder.com/50'">
                        <div class="pop-mini-info"><div class="pop-mini-name">${name}</div><div class="pop-mini-cat">${cat}</div></div>
                    </div>`;
            });
            card.innerHTML = `<div class="pop-card-header"><i class="mdi mdi-fire"></i> TRENDING</div><div class="pop-list-scroll">${listHtml}</div>`;
            container.appendChild(card);
            return;
        }

        const card = document.createElement('div');
        card.className = 'app-card';
        const appId = String(app.slug || app.id);
        card.id = 'app-card-' + appId;
        card.onclick = () => launchApp(app);
        const isFav = favoriteIds.includes(appId);
        let baseCover = getCover(app);
        const appName = app['name_' + sys.lang] || app.name;
        const catKey = 'cat_' + (app.category || 'App').toLowerCase();
        const cat = sys.t(catKey) !== catKey ? sys.t(catKey) : (app.category || 'App');
        const fallbackImg = `https://via.placeholder.com/400x700/222/666?text=${appName.substring(0,2)}`;
        let mobileCoverUrl = "", fallbackUrl = "", finalFallback = baseCover;
        if (sys.lang === 'en') { mobileCoverUrl = baseCover.replace('cover.webp', 'cover_m_en.webp'); fallbackUrl = baseCover.replace('cover.webp', 'cover_m_id.webp'); }
        else { mobileCoverUrl = baseCover.replace('cover.webp', 'cover_m_id.webp'); fallbackUrl = baseCover; }
        let imgTag = (sys.lang === 'en') ?
             `<img src="${mobileCoverUrl}" loading="lazy" onerror="handleImgError(this, 1, '${fallbackUrl}', '${finalFallback}', '${fallbackImg}')">` :
             `<img src="${mobileCoverUrl}" loading="lazy" onerror="handleImgError(this, 2, '', '${finalFallback}', '${fallbackImg}')">`;

        card.innerHTML = `
            <div class="app-cover-wrapper">
                ${imgTag}<div class="card-overlay"></div>
                <div class="card-actions">
                    <div class="action-btn fav ${isFav ? 'active' : ''}" onclick="toggleFavorite('${appId}', this, event)"><i class="mdi ${isFav ? 'mdi-heart' : 'mdi-heart-outline'}"></i></div>
                    <div class="action-btn" onclick="shareApp('${appId}', event)"><i class="mdi mdi-share-variant"></i></div>
                </div>
            </div>
            <div class="app-info-clean"><span class="app-cat">${cat}</span><div class="app-name">${appName}</div></div>
        `;
        container.appendChild(card);

        appCounter++;
        if (appCounter % 5 === 0 && globalAds && globalAds.length > 0) {
            const randomAd = globalAds[Math.floor(Math.random() * globalAds.length)];
            const palettes = [
                { bg: 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)', txt: '#fff', btn: '#fff', btnTxt: '#FF5E62', shadow: 'rgba(255, 94, 98, 0.5)' },
                { bg: 'linear-gradient(135deg, #56CCF2 0%, #2F80ED 100%)', txt: '#fff', btn: '#fff', btnTxt: '#2F80ED', shadow: 'rgba(47, 128, 237, 0.5)' },
                { bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', txt: '#fff', btn: '#fff', btnTxt: '#11998e', shadow: 'rgba(56, 239, 125, 0.5)' },
                { bg: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)', txt: '#fff', btn: '#fff', btnTxt: '#4A00E0', shadow: 'rgba(74, 0, 224, 0.5)' },
                { bg: 'linear-gradient(135deg, #F2994A 0%, #F2C94C 100%)', txt: '#fff', btn: '#fff', btnTxt: '#F2994A', shadow: 'rgba(242, 201, 76, 0.5)' },
                { bg: 'linear-gradient(135deg, #34e89e 0%, #0f3443 100%)', txt: '#fff', btn: '#fff', btnTxt: '#0f3443', shadow: 'rgba(15, 52, 67, 0.5)' },
                { bg: 'linear-gradient(135deg, #FC466B 0%, #3F5EFB 100%)', txt: '#fff', btn: '#fff', btnTxt: '#3F5EFB', shadow: 'rgba(63, 94, 251, 0.5)' },
                { bg: 'linear-gradient(135deg, #141E30 0%, #243B55 100%)', txt: '#fff', btn: '#00C9FF', btnTxt: '#000', shadow: 'rgba(0, 0, 0, 0.6)' }
            ];
            const style = palettes[Math.floor(Math.random() * palettes.length)];
            const adCard = document.createElement('div');
            adCard.className = 'app-card ad-card';
            adCard.onclick = () => window.open(randomAd.link, '_blank');
            adCard.style.cssText = `
                display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
                padding: 24px 16px; background: ${style.bg}; border-radius: 16px; box-shadow: 0 12px 24px ${style.shadow};
                color: ${style.txt}; min-height: 200px; position: relative; overflow: hidden; transition: transform 0.2s;
                cursor: pointer; border: 1px solid rgba(255,255,255,0.1);
            `;
            adCard.innerHTML = `
                 <div style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.25); backdrop-filter: blur(4px); padding: 3px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">AD</div>
                <div style="font-size: 20px; font-weight: 900; line-height: 1.25; margin-bottom: 24px; text-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 2;">${randomAd.title}</div>
                <button style="background: ${style.btn}; color: ${style.btnTxt}; border: none; padding: 12px 28px; border-radius: 50px; font-weight: 800; font-size: 13px; box-shadow: 0 6px 12px rgba(0,0,0,0.3); display: inline-flex; align-items: center; gap: 6px; z-index: 2; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;">${randomAd.cta} <i class="mdi mdi-arrow-right"></i></button>
                <div style="position: absolute; bottom: -30px; left: -30px; width: 100px; height: 100px; background: rgba(255,255,255,0.08); border-radius: 50%; z-index: 1; pointer-events: none;"></div>
                <div style="position: absolute; top: -20px; right: 40%; width: 60px; height: 60px; background: rgba(255,255,255,0.05); border-radius: 50%; z-index: 1; pointer-events: none;"></div>
            `;
            container.appendChild(adCard);
        }
    });
}

function updateSidebar() {
    const listContainer = document.getElementById('sidebar-fav-list');
    const empty = document.getElementById('sidebar-empty-msg');
    const searchEl = document.getElementById('fav-search');
    if(!listContainer || !empty || !searchEl) return;
    const q = searchEl.value.toLowerCase();
    const favApps = installedApps.filter(app => favoriteIds.includes(String(app.slug || app.id)));
    const filtered = favApps.filter(app => (app.name || app.name_en || app.name_id || '').toLowerCase().includes(q));
    listContainer.innerHTML = '';
    if(filtered.length === 0) { empty.style.display = 'block'; } else {
        empty.style.display = 'none';
        filtered.forEach(app => {
            const item = document.createElement('div');
            item.className = 'fav-item';
            item.onclick = () => launchApp(app);
            const iconSrc = getIcon(app);
            const appName = app['name_' + sys.lang] || app.name;
            const catKey = 'cat_' + (app.category || 'App').toLowerCase();
            const cat = sys.t(catKey) !== catKey ? sys.t(catKey) : (app.category || 'App');
            item.innerHTML = `
                <img src="${iconSrc}" class="fav-icon" onerror="this.src='https://via.placeholder.com/100/222/FFF?text=Icon'">
                <div class="fav-details"><div class="fav-name">${appName}</div><div class="fav-cat">${cat}</div></div>
                <button class="fav-remove" onclick="removeFav('${String(app.slug || app.id)}', event)"><i class="mdi mdi-delete-outline"></i></button>
            `;
            listContainer.appendChild(item);
        });
    }
}
function filterFavorites() { updateSidebar(); }

window.launchAppByName = (name) => { const app = installedApps.find(a => a.name === name); if(app) launchApp(app); };
window.toggleFavorite = (id, btn, e) => {
    e.stopPropagation();
    const idx = favoriteIds.indexOf(id);
    if(idx > -1) { favoriteIds.splice(idx, 1); btn.classList.remove('active'); btn.querySelector('i').className = 'mdi mdi-heart-outline'; sys.toast("Removed"); }
    else { favoriteIds.push(id); btn.classList.add('active'); btn.querySelector('i').className = 'mdi mdi-heart'; sys.toast("Added"); }
    localStorage.setItem('flowork_favs', JSON.stringify(favoriteIds));
    updateSidebar();
};
window.removeFav = (id, e) => {
    e.stopPropagation();
    const idx = favoriteIds.indexOf(id);
    if(idx > -1) favoriteIds.splice(idx, 1);
    localStorage.setItem('flowork_favs', JSON.stringify(favoriteIds));
    updateSidebar();
    if (!window.location.search.includes('src=')) renderList(document.getElementById('home-grid'), installedApps);
};
window.shareApp = (id, e) => {
    e.stopPropagation();
    const url = `https://flowork.cloud/flow/${id}`;
    const input = document.createElement('textarea');
    input.value = url; document.body.appendChild(input); input.select();
    document.execCommand('copy'); document.body.removeChild(input);
    sys.toast("Link Copied");
};

// [CLEANED & REFACTORED] Routing cerdas, 100% Mobile Path, Tanpa Jejak /apps-cloud
function launchApp(app) {
    sys.lastScrollY = window.scrollY || document.documentElement.scrollTop;
    sys.lastActiveAppId = String(app.slug || app.id);
    window.closeAllSidebars();

    let logicUrl = app.logic;

    // [CLEANUP] Fallback aman langsung diarahkan ke folder /mobile
    let basePath = app.path || `/mobile/${app.slug || app.id}`;
    basePath = basePath.replace(/\/$/, "");

    // [FIX 404 WebView] Gunakan domain flowork.cloud jika BASE_URL kosong
    let activeBase = (typeof BASE_URL !== 'undefined' && BASE_URL !== '') ? BASE_URL : "https://flowork.cloud";

    // [CRITICAL FIX] Membaca entry_point dari registry, mendeteksi HTML vs Logic
    if (!logicUrl) {
        const entryFile = app.entry_point || app.entry || (app.type === 'apps' ? 'index.html' : 'logic.js');
        const appId = app.slug || app.id;

        if (entryFile.toLowerCase().endsWith('.html') && appId) {
            // Jika HTML / Iframe, tembak langsung ke sistem router SPA Flowork Web
            logicUrl = `https://flowork.cloud/flow/${appId}`;
        } else {
            // Jika DOM / logic.js, load file dari path fisiknya
            logicUrl = `${activeBase}${basePath}/${entryFile}`;
        }
    }

    if (window.Android && window.Android.launchApp) {
        window.Android.launchApp(logicUrl, app.name);
    } else {
        sys.boot(logicUrl, app.name);
        const stateUrl = `?src=${encodeURIComponent(logicUrl)}&name=${encodeURIComponent(app.name)}`;
        history.pushState({app: app.name}, app.name, stateUrl);
    }

    // [ADDED] Ensure Back Button is created and positioned correctly in Bottom Corner
    if (!document.getElementById('sys-floating-back')) {
        const backBtn = document.createElement('button');
        backBtn.id = 'sys-floating-back';
        backBtn.innerHTML = '<i class="mdi mdi-arrow-left"></i>';
        backBtn.onclick = sys.goHome;
        document.body.appendChild(backBtn);
    }
}

// [MODIFIED] Helper untuk menutup sidebar + Cek Antrian Iklan
window.toggleLeftSidebar = () => { document.getElementById('sidebar-left').classList.toggle('open'); document.getElementById('backdrop').classList.toggle('active'); sys.checkPendingSplashAd(); };
window.toggleRightSidebar = () => { document.getElementById('sidebar-right').classList.toggle('open'); document.getElementById('backdrop').classList.toggle('active'); sys.checkPendingSplashAd(); };
window.closeAllSidebars = () => {
    document.getElementById('sidebar-left').classList.remove('open');
    document.getElementById('sidebar-right').classList.remove('open');
    document.getElementById('backdrop').classList.remove('active');
    // Cek pending ad setiap kali menutup sesuatu
    sys.checkPendingSplashAd();
};

window.toggleTheme = () => {
    const n = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', n);
    localStorage.setItem('flowork_theme', n);
};

sys.t = (key) => {
    if (!key) return '';
    return (i18n[sys.lang] && i18n[sys.lang][key]) ? i18n[sys.lang][key] : key;
};

sys.setLang = (l) => {
    const oldLang = localStorage.getItem('flowork_lang') || 'en';
    sys.lang = l;
    localStorage.setItem('flowork_lang', l);
    document.querySelectorAll('.lang-select-box').forEach(el => { el.value = l; });
    document.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); el.textContent = sys.t(key); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { const key = el.getAttribute('data-i18n-placeholder'); el.setAttribute('placeholder', sys.t(key)); });
    if (oldLang !== l) {
        Object.keys(localStorage).forEach(key => { if (key.startsWith('fw_app_cache_')) localStorage.removeItem(key); });
        localStorage.removeItem('ai_council_prompts');
        if (sys.activeAppUrl && sys.activeAppName) { sys.boot(sys.activeAppUrl, sys.activeAppName); } else {
            if(installedApps.length > 0) { renderDashboard(installedApps); updateSidebar(); }
        }
    }
};

sys.toast = (msg) => { const t = document.getElementById('sys-toast'); t.textContent = msg; t.style.opacity = '1'; setTimeout(() => t.style.opacity = '0', 3000); };
sys.toggleRecording = () => { if(window.Android && window.Android.toggleRecording) window.Android.toggleRecording(); else sys.toast("Record Not Available"); };

// [NEW] Helper to get Random Ad Object
sys.getRandomAd = () => {
    if (typeof globalAds !== 'undefined' && Array.isArray(globalAds) && globalAds.length > 0) {
        return globalAds[Math.floor(Math.random() * globalAds.length)];
    }
    return null;
};

// [NEW] Handle Ad Click (Open Link & Stop Propagation)
sys.onAdClick = (e) => {
    e.stopPropagation(); // Mencegah toggle header
    const url = e.target.dataset.url;
    if(url) {
        window.open(url, '_blank');
    }
};

// [NEW] Logika Toggle UI Fullscreen App Mode
// [ADDED] Logic Fullscreen Mode untuk menyembunyikan/menampilkan header dan dock
sys.enterFullscreenMode = () => {
    document.querySelector('.sys-header').classList.remove('hidden'); // Pastikan terbuka secara default
    document.querySelector('.mobile-dock').classList.remove('hidden'); // Pastikan terbuka secara default
    document.getElementById('app-root').classList.add('fullscreen');

    // [MODIFIED] Only show Master Bottom Toggle (Dock Toggle)
    document.getElementById('sys-header-toggle').style.display = 'none';
    document.getElementById('sys-dock-toggle').style.display = 'flex';

    // Icon harus menghadap ke bawah (v) untuk instruksi "tutup"
    document.querySelector('#sys-dock-toggle i').className = 'mdi mdi-chevron-down';

    // [NEW] Inject Random Ad to Toggles
    const ad = sys.getRandomAd();
    if(ad) {
        const fText = document.getElementById('footer-ad-text');
        if(fText) {
            fText.textContent = ad.title;
            fText.dataset.url = ad.link;
        }
    }
};

sys.exitFullscreenMode = () => {
    document.querySelector('.sys-header').classList.remove('hidden');
    document.querySelector('.mobile-dock').classList.remove('hidden');
    document.getElementById('app-root').classList.remove('fullscreen');

    document.getElementById('sys-header-toggle').style.display = 'none';
    document.getElementById('sys-dock-toggle').style.display = 'none';
};

sys.toggleHeader = () => {
    // Legacy function, now does nothing or redirects to toggleDock if needed
};

// [MODIFIED] Master Toggle: Controls BOTH Header and Dock
sys.toggleDock = () => {
    const dock = document.querySelector('.mobile-dock');
    const header = document.querySelector('.sys-header');
    const icon = document.querySelector('#sys-dock-toggle i');
    const adText = document.getElementById('footer-ad-text'); // Get text element

    // Cek salah satu (misal dock), jika hidden, maka tampilkan KEDUANYA
    if (dock.classList.contains('hidden')) {
        // [OPEN] TAMPILKAN SEMUA
        dock.classList.remove('hidden');
        header.classList.remove('hidden');
        document.getElementById('app-root').classList.remove('fullscreen');

        icon.className = 'mdi mdi-chevron-down';
        if(adText) adText.textContent = ""; // Clear content
    } else {
        // [CLOSE] SEMBUNYIKAN SEMUA
        dock.classList.add('hidden');
        header.classList.add('hidden');
        document.getElementById('app-root').classList.add('fullscreen');

        icon.className = 'mdi mdi-chevron-up';

        // Show Ad Logic
        const ad = sys.getRandomAd();
        if(ad && adText) {
             adText.textContent = ad.title;
             adText.dataset.url = ad.link;
        }
    }
};

sys.goHome = () => {
    // [NEW] Kembalikan tampilan Header & Dock saat kembali ke Home
    if (sys.exitFullscreenMode) sys.exitFullscreenMode();

    // [BARU] Hapus Tombol Back jika ada (agar tidak muncul di Home)
    const backBtn = document.getElementById('sys-floating-back');
    if (backBtn) backBtn.remove();

    window.closeAllSidebars();
    document.querySelectorAll('.full-overlay').forEach(el => el.style.display = 'none');
    sys.activeAppUrl = null;
    sys.activeAppName = null;

    if(window.location.search.includes('src=')) {
        const url = new URL(window.location.href);
        url.search = "";
        window.history.replaceState({}, document.title, url.toString());
    }

    if (sys.aiAppInstance) {
        try { sys.aiAppInstance.unmount(); } catch (e) {}
        sys.aiAppInstance = null;
    }

    if(authUserIdentity) {
        renderDashboard(installedApps);

        // [BARU] LOGIKA SCROLL RESTORATION BERDASARKAN ID
        if (sys.lastActiveAppId) {
            // Cari elemen kartu dengan ID yang tersimpan
            const targetCard = document.getElementById('app-card-' + sys.lastActiveAppId);
            if (targetCard) {
                // Scroll agar kartu berada di tengah layar
                setTimeout(() => {
                     targetCard.scrollIntoView({ behavior: 'auto', block: 'center' });
                }, 100);
            } else {
                // Fallback jika ID tidak ditemukan
                if (sys.lastScrollY) {
                    setTimeout(() => { window.scrollTo({ top: sys.lastScrollY, behavior: 'auto' }); }, 50);
                } else {
                    window.scrollTo(0,0);
                }
            }
        } else {
            // Fallback Biasa
            if (sys.lastScrollY) {
                setTimeout(() => { window.scrollTo({ top: sys.lastScrollY, behavior: 'auto' }); }, 50);
            } else {
                window.scrollTo(0,0);
            }
        }

        if(loader) loader.style.display = 'none';

        // [ADDED] Cek apakah ada antrian iklan setelah kembali ke Home
        sys.checkPendingSplashAd();

    } else {
        sys.checkAuth();
    }
};

sys.showLogin = () => {
    document.querySelectorAll('.full-overlay').forEach(el => el.style.display = 'none');
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('auth-lang-container').style.display = 'block';

    // [UPDATE] Reset Login State to Hero
    sys.hideLoginPopup();
};

// [NEW] LOGIC FOR LOGIN REDESIGN
sys.showLoginPopup = () => {
    document.getElementById('login-hero').style.display = 'none';
    document.getElementById('login-popup').classList.add('active');
    document.getElementById('wallet-key-input').focus();
};

sys.hideLoginPopup = () => {
    document.getElementById('login-popup').classList.remove('active');
    document.getElementById('login-hero').style.display = 'flex';
};

sys.openRegister = () => {
    document.querySelectorAll('.full-overlay').forEach(el => el.style.display = 'none');
    document.getElementById('register-overlay').style.display = 'flex';
    document.getElementById('auth-lang-container').style.display = 'block';
};
sys.showPinSetup = () => {
    document.querySelectorAll('.full-overlay').forEach(el => el.style.display = 'none');
    document.getElementById('pin-setup-overlay').style.display = 'flex';
    document.getElementById('wallet-pin-create').value = '';
    document.getElementById('encrypt-progress-bar').style.display = 'none';
    document.getElementById('btn-save-pin').disabled = false;
};
sys.showPinUnlock = (target = 'auth') => {
    sys._unlockTarget = target;
    document.querySelectorAll('.full-overlay').forEach(el => el.style.display = 'none');
    document.getElementById('pin-unlock-overlay').style.display = 'flex';
    document.getElementById('wallet-pin-unlock').value = '';
    document.getElementById('decrypt-progress-bar').style.display = 'none';
    document.getElementById('btn-unlock-pin').disabled = false;
    if(target === 'auth') {
        document.getElementById('auth-lang-container').style.display = 'block';
    }
};

sys.closePinUnlock = () => {
    document.getElementById('pin-unlock-overlay').style.display = 'none';
    document.getElementById('pin-setup-overlay').style.display = 'none';

    if (sys._unlockTarget === 'send_crypto') {
        document.getElementById('wallet-overlay').style.display = 'flex';
    }
    else if (sys._unlockTarget === 'show_key') {
        document.getElementById('profile-overlay').style.display = 'flex';
    }
    // [ADDED] Cek iklan pending
    sys.checkPendingSplashAd();
};

sys.copyMnemonic = () => {
    const phraseEl = document.getElementById('generated-mnemonic');
    if (phraseEl && phraseEl.value) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(phraseEl.value).then(() => {
                sys.toast(sys.t('toast_copy_success'));
            }).catch(() => {
                phraseEl.select(); phraseEl.setSelectionRange(0, 99999);
                document.execCommand('copy'); sys.toast(sys.t('toast_copy_success'));
                if (window.getSelection) window.getSelection().removeAllRanges();
            });
        } else {
            phraseEl.select(); phraseEl.setSelectionRange(0, 99999);
            try { document.execCommand('copy'); sys.toast(sys.t('toast_copy_success')); } catch (err) { sys.toast(sys.t('toast_copy_fail')); }
            if (window.getSelection) window.getSelection().removeAllRanges();
        }
    }
};

sys.copyLoginInput = () => {
    const phraseEl = document.getElementById('wallet-key-input');
    if (phraseEl && phraseEl.value) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(phraseEl.value).then(() => {
                sys.toast(sys.t('toast_copy_success'));
            }).catch(() => {
                phraseEl.select(); phraseEl.setSelectionRange(0, 99999);
                document.execCommand('copy'); sys.toast(sys.t('toast_copy_success'));
                if (window.getSelection) window.getSelection().removeAllRanges();
            });
        } else {
            phraseEl.select(); phraseEl.setSelectionRange(0, 99999);
            try { document.execCommand('copy'); sys.toast(sys.t('toast_copy_success')); } catch (err) { sys.toast(sys.t('toast_copy_fail')); }
            if (window.getSelection) window.getSelection().removeAllRanges();
        }
    } else { sys.toast(sys.t('toast_empty')); }
};

sys.copyPrivateKey = () => {
    const keyEl = document.getElementById('profile-key-input');
    if (keyEl && keyEl.value) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(keyEl.value).then(() => {
                sys.toast(sys.t('toast_key_copied'));
            }).catch(() => {
                keyEl.select(); keyEl.setSelectionRange(0, 99999);
                document.execCommand('copy'); sys.toast(sys.t('toast_key_copied'));
                if (window.getSelection) window.getSelection().removeAllRanges();
            });
        } else {
            keyEl.select(); keyEl.setSelectionRange(0, 99999);
            try { document.execCommand('copy'); sys.toast(sys.t('toast_key_copied')); } catch (err) { sys.toast(sys.t('toast_copy_fail')); }
            if (window.getSelection) window.getSelection().removeAllRanges();
        }
    }
};

sys.copyWalletAddress = () => {
    if (!authUserIdentity || !authUserIdentity.id) return;
    const tempInput = document.createElement('textarea');
    tempInput.value = authUserIdentity.id;
    document.body.appendChild(tempInput);
    tempInput.select();
    tempInput.setSelectionRange(0, 99999);
    try { document.execCommand('copy'); sys.toast(sys.t('toast_address_copied')); } catch (err) { sys.toast(sys.t('toast_copy_fail')); }
    document.body.removeChild(tempInput);
};

sys.openVault = () => {
    window.closeAllSidebars();
    if (!authPrivateKey) { sys.showPinUnlock('vault'); } else { sys.proceedToVault(); }
};
sys.proceedToVault = () => {
    document.getElementById('vault-overlay').style.display = 'flex';
    sys.fetchVaultKeys();
};
sys.closeVault = () => {
    document.getElementById('vault-overlay').style.display = 'none';
    sys.checkPendingSplashAd();
};
sys.renderVaultKeys = () => {
    localApiVault = JSON.parse(localStorage.getItem('flowork_local_vars') || '{}');
    const c = document.getElementById('vault-list-container');
    c.innerHTML = '';
    for(let k in localApiVault) {
        c.innerHTML += `<div class="vault-item"><span>${k}</span> <button onclick="sys.removeVaultKey('${k}')"><i class="mdi mdi-delete"></i></button></div>`;
    }
};

sys.openProfile = () => {
    window.closeAllSidebars();
    const currentName = (authUserIdentity.username === authUserIdentity.id) ? '' : (authUserIdentity.username || '');
    document.getElementById('profile-name-input').value = currentName;
    const currentAvatar = authUserIdentity.avatar || '';
    document.getElementById('profile-avatar-base64').value = currentAvatar;

    if (currentAvatar) {
        document.getElementById('profile-avatar-preview').innerHTML = `<img src="${currentAvatar}" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
        document.getElementById('profile-avatar-preview').innerHTML = `<i class="mdi mdi-account" style="font-size: 24px; color: #555;"></i>`;
    }

    if (authPrivateKey) {
        sys.renderPrivateKey();
    } else {
        document.getElementById('profile-key-container').innerHTML = `
            <button class="vault-btn" style="width: 100%; border: 1px solid #444; background: #000; color: #0ea5e9;" onclick="sys.requestShowKey()">
                <i class="mdi mdi-eye"></i> <span data-i18n="btn_show_key">${sys.t('btn_show_key')}</span>
            </button>
        `;
    }
    document.getElementById('profile-overlay').style.display = 'flex';
};
sys.requestShowKey = () => {
    if (!authPrivateKey) { sys.showPinUnlock('show_key'); } else { sys.renderPrivateKey(); }
};
sys.renderPrivateKey = () => {
    document.getElementById('profile-key-container').innerHTML = `
        <textarea id="profile-key-input" readonly style="width: 100%; height: 50px; color:#2dd4bf; background: #000; border: 1px solid #444; border-radius: 8px; padding: 10px; font-family: monospace; resize: none; font-size: 11px; cursor: pointer;" onclick="sys.copyPrivateKey()">${authPrivateKey}</textarea>
        <button class="vault-btn" style="position: absolute; right: 5px; top: 5px; background: transparent; color: #0ea5e9; font-size: 18px; border: none; padding: 5px;" onclick="sys.copyPrivateKey()" title="Copy Key">
            <i class="mdi mdi-content-copy"></i>
        </button>
    `;
};
sys.closeProfile = () => {
    document.getElementById('profile-overlay').style.display = 'none';
    sys.checkPendingSplashAd();
};

sys.openWallet = () => {
    window.closeAllSidebars();
    if (!authPrivateKey) { sys.showPinUnlock('wallet'); } else { sys.proceedToWallet(); }
};
sys.proceedToWallet = () => {
    document.getElementById('wallet-overlay').style.display = 'flex';
    if(authUserIdentity && authUserIdentity.id) {
        document.getElementById('wallet-address-display').innerText = authUserIdentity.id;
    }
    sys.fetchBalance(false);
};
sys.closeWallet = () => {
    document.getElementById('wallet-overlay').style.display = 'none';
    sys.checkPendingSplashAd();
};
sys.switchNetwork = (netKey) => {
    if (NETWORKS[netKey]) {
        currentWalletNetwork = netKey;
        localStorage.setItem('flowork_wallet_net', netKey);
        sys.fetchBalance(false);
    }
};

// [ADDED] Logic Load Script with ID Cache (Persistent Cache Forever)
sys.loadScript = (src, id) => new Promise((resolve, reject) => {
    if (id && document.getElementById(id)) {
        return resolve();
    }
    if (!id && document.querySelector(`script[src="${src}"]`)) return resolve();

    const s = document.createElement('script');
    s.src = src;
    if(id) s.id = id;

    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
});

// [ADDED] SPLASH AD RENDER UI
sys.showSplashAdUI = (adData) => {
    // Hapus ad lama jika ada
    const existing = document.getElementById('sys-splash-ad-overlay');
    if(existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sys-splash-ad-overlay';
    overlay.className = 'splash-ad-overlay';

    // Klik overlay membuka link
    overlay.onclick = () => {
        if(adData.link) window.open(adData.link, '_blank');
    };

    overlay.innerHTML = `
        <div class="splash-ad-close" onclick="event.stopPropagation(); document.getElementById('sys-splash-ad-overlay').remove();">
            <i class="mdi mdi-close"></i>
        </div>
        <img src="${adData.img}" class="splash-ad-img" onerror="this.src='https://via.placeholder.com/1080x1920/000/FFF?text=AD+LOAD+ERROR'">
    `;

    document.body.appendChild(overlay);

    // Animasi Masuk
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });
};

// [ADDED] Helper: Check & Show Pending Ad
sys.checkPendingSplashAd = () => {
    if(sys.pendingSplashAd) {
        // Double check UI busy status before showing
        if(!sys.isUiBusy()) {
            sys.triggerSplashAd();
        }
    }
};