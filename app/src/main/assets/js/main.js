// File: app/src/main/assets/js/main.js

// [HYBRID] Fungsi Fetch Apps (Smart Cache: Instant Load + Background Update)
async function fetchApps() {
    try {
        // [SETUP] Definisi Variabel
        // [Rule #1] App lokal sudah tidak dipakai
        // let localApps = [];

        const CACHE_KEY = 'fw_registry_cache';
        const ADS_CACHE_KEY = 'fw_ads_storage'; // Key untuk simpan ads selamanya

        let cachedRegistryData = null;

        // =================================================================
        // 1. ADS STRATEGY: "CACHE FOREVER + BACKGROUND SYNC"
        // =================================================================
        const cachedAdsStr = localStorage.getItem(ADS_CACHE_KEY);
        let localAdsId = null;

        if (cachedAdsStr) {
            try {
                const parsedAds = JSON.parse(cachedAdsStr);
                localAdsId = parsedAds.id;

                if (parsedAds.ads && Array.isArray(parsedAds.ads)) {
                    // [MODIFIED] Hormati flag iklan dari cache
                    if (parsedAds.iklan === "off") {
                        globalAds = [];
                    } else {
                        globalAds = parsedAds.ads;
                    }
                    console.log(`⚡ Ads Loaded from Cache: ${localAdsId} (Status: ${parsedAds.iklan || 'on'})`);
                }
            } catch (errAds) {
                console.warn("Ads Cache Corrupt, clearing...");
                localStorage.removeItem(ADS_CACHE_KEY);
            }
        }
        // =================================================================
        // 3. CEK CACHE CLOUD APPS
        const cachedDataStr = localStorage.getItem(CACHE_KEY);
        let currentCloudApps = [];

        if (cachedDataStr) {
            try {
                cachedRegistryData = JSON.parse(cachedDataStr);
                if (cachedRegistryData.meta && cachedRegistryData.meta.version) {
                     console.log(`⚡ Apps Loaded: Version ${cachedRegistryData.meta.version}`);
                } else {
                     console.log("⚡ Apps Loaded: Legacy Cache");
                }
                currentCloudApps = Array.isArray(cachedRegistryData) ? cachedRegistryData : (cachedRegistryData.apps || []);
                // [Rule #1] App lokal sudah tidak dipakai
                // renderAndMerge(localApps, currentCloudApps);
                renderAndMerge(null, currentCloudApps);
            } catch (e) {
                console.error("Cache Corrupt:", e);
                localStorage.removeItem(CACHE_KEY);
            }
        }

        // 4. NETWORK CHECK: APPS
        if (navigator.onLine) {
            console.log("🔄 Checking App Updates...");
            try {
                // Endpoint diarahkan ke /mobile/
                const resCloud = await fetch(`${BASE_URL}/mobile/registry.json?t=${Date.now()}`, { cache: "no-store" });

                if (resCloud.ok) {
                    const serverData = await resCloud.json();
                    const serverApps = serverData.apps || [];
                    const serverVer = serverData.meta?.version;
                    const localVer = cachedRegistryData?.meta?.version;

                    if (serverVer !== localVer) {
                        console.log(`🚨 APP UPDATE FOUND! [${localVer} -> ${serverVer}]`);

                        if (cachedRegistryData && cachedRegistryData.apps) {
                             const newAppIds = new Set(serverApps.map(a => a.id));
                             cachedRegistryData.apps.forEach(oldApp => {
                                 if (!newAppIds.has(oldApp.id)) {
                                     console.log(`💀 Killing Zombie App Cache: ${oldApp.id}`);
                                     localStorage.removeItem(`fw_app_cache_${oldApp.id}`);
                                 }
                             });
                        }
                        localStorage.setItem(CACHE_KEY, JSON.stringify(serverData));

                        // [Rule #1] App lokal sudah tidak dipakai
                        // renderAndMerge(localApps, serverApps);
                        renderAndMerge(null, serverApps);
                        sys.toast("System Updated: " + serverVer);
                    } else {
                        console.log("✅ Apps are Up-to-Date.");
                    }
                }
            } catch (errCloud) { console.warn("App Update Failed:", errCloud); }
        }

        // 5. NETWORK CHECK: ADS (Sinkronisasi ID)
        if (navigator.onLine) {
            console.log("🔄 Syncing Ads...");
            // Endpoint diarahkan ke /mobile/
            fetch(`${BASE_URL}/mobile/ads.json?t=${Date.now()}`)
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error("Ads Fetch Failed");
                })
                .then(serverAdsData => {
                    const serverId = serverAdsData.id;

                    // Update jika ID beda ATAU jika globalAds masih kosong (misal local storage dihapus manual)
                    if ((serverId && serverId !== localAdsId) || globalAds.length === 0) {
                        console.log(`🚨 ADS UPDATE FOUND! [${localAdsId} -> ${serverId}]`);

                        // [MODIFIED] Set globalAds berdasarkan flag "iklan"
                        if (serverAdsData.iklan === "off") {
                            globalAds = [];
                        } else {
                            globalAds = serverAdsData.ads || [];
                        }

                        localStorage.setItem(ADS_CACHE_KEY, JSON.stringify(serverAdsData));

                        // [FIX] FORCE RENDER UI dengan Timeout kecil agar aman
                        if (!sys.activeApp && typeof renderDashboard === 'function') {
                            console.log("♻️ Refreshing UI for new Ads...");
                            setTimeout(() => {
                                renderDashboard(installedApps);
                                if (serverAdsData.iklan !== "off") sys.toast("Promo Updated");
                            }, 50);
                        }
                    } else {
                        console.log("✅ Ads are Up-to-Date (Using Cache)");
                    }
                })
                .catch(e => console.warn("Ads Sync Skipped:", e.message));
        }

        // [ADDED] SPLASH SCREEN ADS SYSTEM INIT
        sys.initSplashAds();

        sys.startBackgroundPrefetch();

    } catch(e) { console.error("Critical Registry Error:", e); }
}

// [ADDED] SPLASH ADS SYSTEM LOGIC
sys.initSplashAds = async () => {
    const SPLASH_STORAGE_KEY = 'fw_splash_config';
    const SPLASH_TIME_KEY = 'fw_splash_next_trigger';

    // 1. Load Local Cache
    let splashConfig = null;
    try {
        const cached = localStorage.getItem(SPLASH_STORAGE_KEY);
        if(cached) splashConfig = JSON.parse(cached);
    } catch(e) { localStorage.removeItem(SPLASH_STORAGE_KEY); }

    // 2. Fetch Remote Config (Background)
    if(navigator.onLine) {
        try {
            // Endpoint diarahkan ke /mobile/
            const res = await fetch(`${BASE_URL}/mobile/splash.json?t=${Date.now()}`);

            if(res.ok) {
                const serverConfig = await res.json();
                const serverId = serverConfig.id;
                const localId = splashConfig ? splashConfig.id : null;

                // Jika ID berubah, reset timer untuk "Initial Delay"
                if(serverId !== localId) {
                    console.log("🆕 New Splash Ads Batch Found!");
                    localStorage.setItem(SPLASH_STORAGE_KEY, JSON.stringify(serverConfig));
                    splashConfig = serverConfig;

                    // Set trigger time = Sekarang + Initial Delay
                    const delayMs = (serverConfig.settings?.initial_delay_minutes || 1) * 60 * 1000;
                    const nextTrigger = Date.now() + delayMs;
                    localStorage.setItem(SPLASH_TIME_KEY, nextTrigger);
                    console.log(`⏱️ Splash Timer Reset. Next ad in: ${delayMs/1000}s`);
                } else {
                    console.log("✅ Splash Ads Config Up-to-date");
                }
            }
        } catch(e) { console.warn("Splash Config Fetch Failed:", e.message); }
    }

    // 3. Start Timer Loop
    // [MODIFIED] Cek flag "iklan" sebelum memulai loop interval
    if(splashConfig && splashConfig.iklan !== "off") {
        sys.splashAdLoop();
    } else {
        console.log("🚫 Splash Ads are disabled remotely.");
    }
};

sys.splashAdLoop = () => {
    const SPLASH_TIME_KEY = 'fw_splash_next_trigger';

    setInterval(() => {
        // Cek apakah waktu trigger sudah lewat
        const nextTrigger = parseInt(localStorage.getItem(SPLASH_TIME_KEY) || '0');
        const now = Date.now();

        if(nextTrigger > 0 && now >= nextTrigger) {
            // Cek apakah UI sedang sibuk?
            if(sys.isUiBusy()) {
                // UI Sibuk -> Set Flag Pending
                if(!sys.pendingSplashAd) {
                    console.log("⚠️ Splash Ad ready but UI busy. Queued.");
                    sys.pendingSplashAd = true;
                }
            } else {
                // UI Aman -> Show Ad
                sys.triggerSplashAd();
            }
        }
    }, 5000); // Cek setiap 5 detik
};

// Helper: Cek apakah UI sedang "Sibuk" (Ada overlay lain atau sedang di App)
sys.isUiBusy = () => {
    // 1. Cek apakah sedang di dalam App (bukan Dashboard)
    if(sys.activeApp) return true;

    // 2. Cek apakah ada overlay fullscreen yang aktif (Login, Vault, Pin, dll)
    const overlays = document.querySelectorAll('.full-overlay');
    for(let el of overlays) {
        if(el.style.display !== 'none' && el.style.display !== '') return true;
    }

    // 3. Cek apakah Sidebar terbuka
    const leftSidebar = document.getElementById('sidebar-left');
    const rightSidebar = document.getElementById('sidebar-right');
    if(leftSidebar && leftSidebar.classList.contains('open')) return true;
    if(rightSidebar && rightSidebar.classList.contains('open')) return true;

    return false;
};

// [UPDATED] Trigger Ad & Render Logic (SENSITIVE TOUCH + INSTANT CLOSE)
sys.triggerSplashAd = () => {
    const SPLASH_STORAGE_KEY = 'fw_splash_config';
    const SPLASH_TIME_KEY = 'fw_splash_next_trigger';

    try {
        const config = JSON.parse(localStorage.getItem(SPLASH_STORAGE_KEY));
        // [MODIFIED] Tambahkan proteksi flag "iklan" di sini sebagai fail-safe terakhir
        if(!config || config.iklan === "off" || !config.pool || config.pool.length === 0) return;

        // Weighted Random Selection
        const pool = [];
        config.pool.forEach(ad => {
            const weight = ad.weight || 1;
            for(let i=0; i<weight; i++) pool.push(ad);
        });

        const selectedAd = pool[Math.floor(Math.random() * pool.length)];

        // [MODIFIKASI] Render UI Langsung di sini untuk Kecepatan & Kontrol
        const overlay = document.createElement('div');
        overlay.className = 'splash-ad-overlay active'; // active class agar opacity 1

        // Style tambahan untuk memastikan full cover & touch capture
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #000; z-index: 999999; display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.3s ease; touch-action: none;
        `;

        const img = document.createElement('img');
        // [FIXED] GUNAKAN KEY 'img' BUKAN 'image' SESUAI JSON
        img.src = selectedAd.img;
        img.className = 'splash-ad-img';
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; cursor: pointer;';

        const closeBtn = document.createElement('div');
        closeBtn.className = 'splash-ad-close';
        closeBtn.innerHTML = '<i class="mdi mdi-close"></i>';
        closeBtn.style.cssText = `
            position: absolute; top: 25px; right: 25px; width: 36px; height: 36px;
            background: rgba(0,0,0,0.6); border-radius: 50%; color: #fff;
            display: flex; align-items: center; justify-content: center; font-size: 20px;
            border: 1px solid rgba(255,255,255,0.3); cursor: pointer; z-index: 1000000;
        `;

        // Variable Lock agar Close tidak trigger Open
        let isActionTaken = false;

        // [CRITICAL FIX] Handler Klik SUPER SENSITIF
        const openAd = (e) => {
            if(isActionTaken) return;
            isActionTaken = true;

            // Visual Touch Feedback
            img.style.opacity = '0.5';

            // [FIXED] GUNAKAN KEY 'link' BUKAN 'url' SESUAI JSON
            const targetUrl = selectedAd.link;

            // 1. Buka Link via NATIVE ANDROID SECEPAT MUNGKIN
            if (typeof Android !== 'undefined' && Android.openInBrowser) {
                Android.openInBrowser(targetUrl);
            } else {
                window.open(targetUrl, '_blank');
            }

            // 2. LANGSUNG HAPUS OVERLAY (INSTANT CLOSE)
            // Tidak pakai fade out, langsung hilang biar user balik ke app sudah bersih
            overlay.remove();
        };

        const closeAd = (e) => {
            e.stopPropagation(); // Stop event biar gak nembus ke gambar
            e.preventDefault();

            if(isActionTaken) return;
            isActionTaken = true;

            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 250);
        };

        // [SENSITIVITY UPGRADE] Gunakan 'touchstart' agar kena dikit langsung jalan
        img.addEventListener('touchstart', openAd, { passive: true });
        img.addEventListener('mousedown', openAd); // Backup mouse
        img.addEventListener('click', openAd);     // Backup click

        // Tombol Close
        closeBtn.addEventListener('touchstart', closeAd, { passive: false });
        closeBtn.addEventListener('click', closeAd);

        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);

        // Animasi Masuk
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });

        // Reset Timer (Next Interval)
        const intervalMs = (config.settings?.interval_minutes || 20) * 60 * 1000;
        const nextTime = Date.now() + intervalMs;
        localStorage.setItem(SPLASH_TIME_KEY, nextTime);

        sys.pendingSplashAd = false; // Clear queue
        console.log(`✅ Splash Ad Shown. Next in ${config.settings?.interval_minutes} mins`);

    } catch(e) { console.error("Splash Trigger Error:", e); }
};

// Fungsi Helper untuk Merge & Render (REFACTORED FOR CLOUD ONLY)
// [Rule #1] App lokal sudah tidak dipakai, signature fungsi tetap dipertahankan namun isinya disesuaikan
function renderAndMerge(localApps, cloudApps) {
    const markedCloudApps = cloudApps.map(app => ({ ...app, source: 'cloud' }));

    // [Rule #1]
    // let mergedApps = [...localApps, ...markedCloudApps];
    let mergedApps = [...markedCloudApps];

    const uniqueMap = new Map();
    mergedApps.forEach(item => {
        const key = item.slug || item.id;

        // [Rule #1] Logika untuk app lokal dihapus dari percabangan if
        // if (!uniqueMap.has(key) || item.source === 'local') {
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
        }
    });

    let uniqueApps = Array.from(uniqueMap.values());
    uniqueApps = uniqueApps.filter(app => app.android === 'yes');

    // [MODIFIKASI] Randomize Order (Shuffle)
    for (let i = uniqueApps.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [uniqueApps[i], uniqueApps[j]] = [uniqueApps[j], uniqueApps[i]];
    }

    installedApps = uniqueApps; // Set hasil acakan ke memori global

    if (!window.location.search.includes('src=')) { renderDashboard(installedApps); }
    updateSidebar();
}

// [FINAL FITUR] BACKGROUND PRE-FETCHER (SMART VERSION)
sys.startBackgroundPrefetch = async () => {
    if (!navigator.onLine) return;
    const essentialAssets = [
        'css/style.css', 'js/ai.js', 'js/ui.js', 'js/crypto.js', 'js/marked.js', 'js/html2pdf.js'
    ];
    console.log("🚀 Starting Smart Asset Prefetch...");
    for (const url of essentialAssets) {
        try { await fetch(url, { cache: 'no-cache' }); } catch(e) { /* Silent fail */ }
    }
    console.log("✅ Smart Asset Prefetch Complete");
};

// [ADDED] Fungsi Tampilan Error Cantik
sys.showError = (title, message, retryAction) => {
    if(!nativeRoot) return;
    nativeRoot.innerHTML = `
        <div class="sys-error-container">
            <i class="mdi mdi-wifi-off sys-error-icon"></i>
            <div class="sys-error-title">${title}</div>
            <div class="sys-error-desc">${message}</div>
            <button id="sys-retry-btn" class="sys-retry-btn">
                <i class="mdi mdi-refresh"></i> Try Again
            </button>
        </div>
    `;
    const btn = document.getElementById('sys-retry-btn');
    if(btn) btn.onclick = () => {
        nativeRoot.innerHTML = ''; // Clear error
        if(typeof retryAction === 'function') retryAction();
    };
};

// [ANTI-ZOMBIE] SYSTEM BOOTER - REFACTORED FOR SMART MANIFEST CACHING + ERROR UI
sys.boot = async (url, name) => {
    // [MODIFIED] Helper for "WebView" Mode (Pengganti Iframe agar tidak Blocked)
    const runWebView = (targetUrl) => {
        // [NEW LOGIC] DIRECT WEBVIEW NAVIGATION (FULL PAGE)
        console.log("🚀 Launching Direct Webview: " + targetUrl);
        window.location.href = targetUrl;
    };

    // Helper function untuk menjalankan Code (Eval alternative)
    const runCode = (code) => {
        if (code.trim().startsWith('<')) {
            runWebView(url); // Jika isinya HTML, lempar ke WebView mode
            return;
        }

        if(nativeRoot) nativeRoot.innerHTML = '';

        // [FIX CRITICAL 404 DOM]
        // Jika kode memiliki komentar header (//####), kata "return" di awal akan terputus karena ASI JavaScript.
        // Kita WAJIB membersihkan semua komentar baris tunggal (//) di awal file.
        // [Rule #1] Original line: const app = new Function('return ' + code)(); (dikomentari / dimodifikasi)
        const cleanCode = code.replace(/^\s*\/\/.*$/gm, '').trim();
        const app = new Function('return ' + cleanCode)();

        app.mount(sys);
        sys.activeApp = app;
        if (sys.enterFullscreenMode) sys.enterFullscreenMode();
        setupBackButton();
    };

    // Helper untuk membuat Tombol Back (Flush Design)
    const setupBackButton = () => {
        const backBtnId = 'sys-floating-back';
        let backBtn = document.getElementById(backBtnId);
        if (backBtn) backBtn.remove();

        backBtn = document.createElement('div');
        backBtn.id = backBtnId;
        document.body.appendChild(backBtn);
        // Style CSS sudah diatur di style.css untuk flush bottom-right
        backBtn.innerHTML = `<i class="mdi mdi-arrow-left" style="font-size: 22px;"></i>`;
        backBtn.onclick = () => {
             backBtn.style.transform = 'scale(0.9)';
             setTimeout(() => {
                 console.log("Closing App & Cleaning RAM...");
                 if (sys.activeApp && typeof sys.activeApp.unmount === 'function') {
                     try { sys.activeApp.unmount(); } catch(e) { console.error("Error unmounting app:", e); }
                 }
                 sys.activeApp = null;
                 if(nativeRoot) nativeRoot.innerHTML = '';
                 backBtn.remove();
                 sys.goHome();
             }, 150);
        };
    };

    try {
        // [MODIFIED] Deteksi rute /flow/ atau file .html untuk navigasi WebView (Rule #1)
        // if (url.toLowerCase().includes('.html')) { // [Rule #1] Baris asli dikomentari
        if (url.includes('/flow/') || url.toLowerCase().includes('.html')) {
            runWebView(url);
            return;
        }

        // Cleanup Zombie
        if (sys.activeApp) {
            console.log("Killing previous zombie app...");
            if (typeof sys.activeApp.unmount === 'function') {
                try { sys.activeApp.unmount(); } catch(e) { console.warn("Zombie unmount error:", e); }
            }
            sys.activeApp = null;
        }
        if (sys.aiAppInstance) {
            try { sys.aiAppInstance.unmount(); } catch (e) {}
            sys.aiAppInstance = null;
        }

        // 1. Generate ID Unik untuk Cache berdasarkan URL Logic
        const appCacheId = "fw_smart_cache_" + btoa(url);
        const metaKey = appCacheId + "_meta"; // Simpan manifest
        const codeKey = appCacheId + "_code"; // Simpan logic.js string

        // 2. Cek Local Cache
        let localMeta = null;
        let localCode = null;
        try {
            localMeta = JSON.parse(localStorage.getItem(metaKey));
            localCode = localStorage.getItem(codeKey);
        } catch(e) {}

        // 3. Tentukan Manifest URL
        const baseUrl = url.substring(0, url.lastIndexOf('/'));
        const manifestUrl = `${baseUrl}/manifest.json`;

        // 4. Logika Offline / Online & Version Check
        if (!navigator.onLine) {
            // --- MODE OFFLINE ---
            if (localCode) {
                console.log("📴 Offline Mode: Booting from Cache Instant!");
                runCode(localCode);
                return; // Sukses, berhenti di sini
            } else {
                sys.showError("No Connection", "You are offline and this app is not cached yet.", () => {
                    sys.boot(url, name); // Retry Action
                });
                return;
            }
        } else {
            // --- MODE ONLINE ---
            try {
                // Fetch Manifest TERBARU (timestamp agar tidak kena cache browser saat cek versi)
                const resManifest = await fetch(manifestUrl + '?t=' + Date.now(), { cache: "no-store" });

                if (resManifest.ok) {
                    const remoteMeta = await resManifest.json();

                    // Ambil versi (support 'ver' atau 'version')
                    const remoteVer = remoteMeta.version || remoteMeta.ver || "1.0.0";
                    const localVer = localMeta ? (localMeta.version || localMeta.ver) : null;

                    // [ADDED] SMART ENTRY POINT DETECTION (Rule #1)
                    if (remoteMeta.entry && remoteMeta.entry.includes('.html')) {
                        runWebView(`${baseUrl}/${remoteMeta.entry}`);
                        return;
                    }
                    if (remoteMeta.entry_point && remoteMeta.entry_point.includes('.html')) {
                        runWebView(`${baseUrl}/${remoteMeta.entry_point}`);
                        return;
                    }

                    // CHECK VERSION: Compare Remote vs Local
                    if (localCode && localVer === remoteVer) {
                        // VERSI SAMA -> GUNAKAN CACHE (INSTANT)
                        console.log(`✅ Version Match (${localVer}). Booting from Cache.`);
                        runCode(localCode);
                    } else {
                        // VERSI BEDA atau CACHE KOSONG -> DOWNLOAD BARU
                        console.log(`🔄 Update Found or New App (${localVer} -> ${remoteVer}). Downloading...`);

                        // Tampilkan loader hanya saat benar-benar download
                        if(loader) loader.style.display = 'flex';

                        // Memaksa fetch agar tidak kena block cache browser
                        const resCode = await fetch(url + '?t=' + Date.now(), { cache: "no-store" });

                        // [ADDED] FAIL-SAFE LOGIC (Rule #1: Add, don't delete)
                        // Jika logic.js GAGAL (404/Blocked), coba cari index.html sebagai cadangan
                        // [Rule #1] KOMENTAR: Fail-safe logic.js to index.html ini juga berpotensi menyebabkan false positive 404,
                        // tapi kita biarkan saja (karena user minta jangan dihapus), asalkan catch error utama sudah di-comment.
                        if (!resCode.ok) {
                            console.warn("⚠️ Logic.js load failed, trying Emergency Fallback to index.html...");
                            const htmlCheckUrl = `${baseUrl}/index.html`;
                            const htmlCheck = await fetch(htmlCheckUrl, { method: 'HEAD' });

                            if (htmlCheck.ok || htmlCheck.status === 200) {
                                if(loader) loader.style.display = 'none';
                                runWebView(htmlCheckUrl);
                                return;
                            }
                            throw new Error(`App Module Not Found (${resCode.status})`);
                        }

                        const newCode = await resCode.text();

                        // SIMPAN CACHE BARU SELAMANYA
                        localStorage.setItem(metaKey, JSON.stringify(remoteMeta));
                        localStorage.setItem(codeKey, newCode);

                        console.log("💾 App Cached Successfully!");
                        if(loader) loader.style.display = 'none'; // Sembunyikan loader
                        runCode(newCode);
                    }
                } else {
                    // Gagal ambil manifest (misal 404), fallback ke metode lama atau cache
                    if(localCode) runCode(localCode);
                    else {
                        // Fallback total: fetch url langsung tanpa cek manifest
                        const res = await fetch(url, { cache: "no-store" });
                        if (!res.ok) throw new Error(`App Server Response: ${res.status}`);
                        const code = await res.text();
                        // Proteksi jika ternyata isinya HTML (Unexpected token <)
                        if (code.trim().startsWith('<')) {
                             runWebView(url);
                        } else {
                             runCode(code);
                        }
                    }
                }

            } catch (err) {
                console.error("Network/Manifest Error:", err);

                // [ADDED] EMERGENCY FALLBACK IN CATCH BLOCK
                // [Rule #1] KOMENTAR: Logika fallback di bawah ini dimatikan karena MENYEBABKAN ERROR 404!
                // Jika fetch gagal (e.g. karena ngelag/CORS), memaksa redirect WebView ke index.html yang tidak ada
                // otomatis memunculkan halaman 404 server. Sebagai gantinya, tampilkan UI "Connection Failed".
                /*
                if (url.includes('logic.js')) {
                    console.log("⚠️ Crash detected on logic.js. Attempting HTML Fallback...");
                    const fallbackUrl = url.replace('logic.js', 'index.html');
                    runWebView(fallbackUrl);
                    if(loader) loader.style.display = 'none';
                    return;
                }
                */

                // Jika error network saat cek manifest, tapi punya cache, PAKAI CACHE
                if (localCode) {
                    console.log("⚠️ Network Error, using Cache fallback.");
                    runCode(localCode);
                } else {
                    sys.showError("Connection Failed", `<span style="font-size:11px; color:#888;">Gagal memuat URL: <br>${url}</span><br><br><span style="color:#ef4444; font-weight:bold;">${err.message}</span>`, () => {
                        sys.boot(url, name);
                    });
                }
                if(loader) loader.style.display = 'none';
            }
        }

    } catch(e) {
        console.error("Boot Error:", e);
        sys.showError("System Error", "Failed to load app.<br>" + e.message, () => {
            sys.boot(url, name);
        });
        if(loader) loader.style.display = 'none';
    }
};

sys.clearCache = () => {
    const confirmMsg = sys.t('confirm_clear_cache') || "Reset System Cache & Reload?";
    if (confirm(confirmMsg)) {
        try {
            localStorage.removeItem('fw_registry_cache');
            localStorage.removeItem('fw_registry_time');
            localStorage.removeItem('fw_asset_prefetch_time');
            localStorage.removeItem('fw_ads_storage');
            localStorage.removeItem('fw_splash_config');
            localStorage.removeItem('fw_splash_next_trigger');

            // CLEAR SMART APP CACHE (Hapus semua key fw_smart_cache_)
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('fw_app_cache_') || key.startsWith('fw_smart_cache_')) {
                    localStorage.removeItem(key);
                }
            });

            sys.toast(sys.t('toast_cache_cleared') || "Cache Cleared!");
            setTimeout(() => { window.location.reload(); }, 1000);
        } catch (e) {
            console.error(e);
            sys.toast("Error clearing cache");
        }
    }
};

sys.download = (data, filename, mimeType = "application/octet-stream") => {
    const sendChunks = (base64String) => {
        try {
            sys.toast("Memulai Download " + filename + "...");
            Android.startChunkDownload(filename, mimeType);
            var chunkSize = 500 * 1024;
            var totalChunks = Math.ceil(base64String.length / chunkSize);
            for (var i = 0; i < totalChunks; i++) {
                var chunk = base64String.substr(i * chunkSize, chunkSize);
                Android.appendChunk(chunk);
            }
            Android.finishChunkDownload();
        } catch (e) {
            console.error("Chunk Error:", e);
            sys.toast("Gagal Download: " + e.message);
        }
    };

    if (typeof Android !== 'undefined' && Android.startChunkDownload) {
        if (data instanceof Blob) {
            var reader = new FileReader();
            reader.readAsDataURL(data);
            reader.onloadend = function() {
                var base64data = reader.result.split(',')[1];
                sendChunks(base64data);
            };
        } else if (typeof data === 'string' && data.startsWith('data:')) {
            var parts = data.split(',');
            if (parts.length > 1) { sendChunks(parts[1]); } else { sys.toast("Format Data URI Salah"); }
        } else { sys.toast("Format file tidak didukung untuk download"); }
    } else {
        console.log("Downloading via Browser Fallback");
        let url;
        if (data instanceof Blob) { url = URL.createObjectURL(data); } else { url = data; }
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (data instanceof Blob) URL.revokeObjectURL(url);
    }
};

sys.toggleMenu = () => {
    if (typeof Android !== 'undefined' && Android.toggleMenu) {
        Android.toggleMenu();
    } else {
        console.log("Toggle Menu clicked");
        alert("Fitur Floating Menu hanya di Android App");
    }
};

window.addEventListener('load', () => {
    nativeRoot = document.getElementById('native-root');
    loader = document.getElementById('loader');
    sys.root = nativeRoot;

    const savedTheme = localStorage.getItem('flowork_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    try { favoriteIds = JSON.parse(localStorage.getItem('flowork_favs')) || []; } catch(e) { favoriteIds = []; }

    const savedLang = localStorage.getItem('flowork_lang') || 'id';
    sys.setLang(savedLang);

    const savedNet = localStorage.getItem('flowork_wallet_net');
    if(savedNet && NETWORKS[savedNet]) {
        currentWalletNetwork = savedNet;
        const netSelect = document.getElementById('wallet-network-select');
        if(netSelect) netSelect.value = savedNet;
    }

    if (sys.checkAuth) sys.checkAuth();

    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    if(src) {
        sys.boot(src, params.get('name'));
    } else {
        fetchApps();
    }
});

// =======================================================================
// TAMBAHAN FULL FITUR: MY ENGINES LOGIC (DCD Compliant & Zero Mutation)
// =======================================================================

sys.getApiUrl = () => {
    let activeUrl = localStorage.getItem('flowork_active_engine_url');
    if(activeUrl) return activeUrl.replace(/\/$/, "") + '/api/v1';

    try {
        const storedState = localStorage.getItem('flowork_gateway');
        if (storedState) {
            const parsed = JSON.parse(storedState);
            if (parsed.gatewayUrl) return parsed.gatewayUrl.replace(/\/$/, "") + '/api/v1';
        }
    } catch (e) { }

    return 'https://api.flowork.cloud/api/v1';
};

sys.getApiHeaders = async () => {
    const headers = { 'Content-Type': 'application/json' };

    let token = localStorage.getItem('flowork_gateway_token') || localStorage.getItem('flowork_token') || localStorage.getItem('token') || localStorage.getItem('fw_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-gateway-token'] = token;
    }

    const activeEngineId = localStorage.getItem('flowork_active_engine_id');
    if (activeEngineId) headers['X-Flowork-Engine-ID'] = activeEngineId;

    let pk = typeof authPrivateKey !== 'undefined' && authPrivateKey ? authPrivateKey : null;
    if (!pk) pk = localStorage.getItem('flowork_private_key') || localStorage.getItem('fw_key') || localStorage.getItem('private_key');

    if (pk && typeof window.ethers !== 'undefined') {
        try {
            const wallet = new window.ethers.Wallet(pk);
            const timestamp = Math.floor(Date.now() / 1000);
            const messageToSign = `flowork_api_auth|${wallet.address}|${timestamp}`;
            const signature = await wallet.signMessage(messageToSign);

            headers['X-User-Address'] = wallet.address;
            headers['X-Signature'] = signature;
            headers['X-Signed-Message'] = messageToSign;
            headers['X-Payload-Version'] = "2";
        } catch (e) {
            console.error("[API] Sign Error:", e);
        }
    }
    return headers;
};

// Interceptor Wallet Lock
sys.openEngines = () => {
    if(typeof closeAllSidebars === 'function') closeAllSidebars();

    let pk = typeof authPrivateKey !== 'undefined' && authPrivateKey ? authPrivateKey : null;
    if (!pk) pk = localStorage.getItem('flowork_private_key') || localStorage.getItem('fw_key') || localStorage.getItem('private_key');

    if (!pk) {
        if (localStorage.getItem('wallet_auth')) {
            const pinOverlay = document.getElementById('pin-unlock-overlay');
            if (pinOverlay) {
                pinOverlay.style.display = 'flex';
                const pinInput = document.getElementById('wallet-pin-unlock');
                if (pinInput) { pinInput.value = ''; pinInput.focus(); }

                const unlockWatcher = setInterval(() => {
                    let currentPk = typeof authPrivateKey !== 'undefined' && authPrivateKey ? authPrivateKey : null;
                    if (currentPk) {
                        clearInterval(unlockWatcher);
                        sys.openEngines();
                    }
                    if (pinOverlay.style.display === 'none' && !currentPk) {
                        clearInterval(unlockWatcher);
                    }
                }, 500);
                return;
            }
        } else {
            const isId = localStorage.getItem('flowork_lang') === 'id';
            alert(isId ? "Harap Login atau Buat Wallet Identitas terlebih dahulu!" : "Please Login or Create Identity Wallet first!");
            if(typeof sys.openRegister === 'function') sys.openRegister();
            return;
        }
    }

    const overlay = document.getElementById('engines-overlay');
    if(overlay) {
        overlay.classList.add('active');
        sys.fetchMyEngines();
    }
};

sys.closeEngines = () => {
    const overlay = document.getElementById('engines-overlay');
    if(overlay) overlay.classList.remove('active');
};

sys.fetchMyEngines = async () => {
    const container = document.getElementById('engines-list-container');
    const loader = document.getElementById('engines-loader');
    if(!container || !loader) return;

    loader.style.display = 'block';
    container.innerHTML = '';

    try {
        const headers = await sys.getApiHeaders();
        const apiUrl = sys.getApiUrl() + '/user/engines';

        const response = await fetch(apiUrl, { method: 'GET', headers: headers });

        if(!response.ok) {
            const errBody = await response.text();
            throw new Error(`Gagal (Code ${response.status}): ` + errBody);
        }

        const engines = await response.json();
        loader.style.display = 'none';

        if(!Array.isArray(engines) || engines.length === 0) {
            const isId = localStorage.getItem('flowork_lang') === 'id';
            const emptyText = isId
                ? "Belum ada Node Engine di Cluster ini.<br><br>Gunakan tombol 'Deploy Node' untuk menambahkan."
                : "No Engine Nodes found in this Cluster.<br><br>Use the 'Deploy Node' button to add one.";
            container.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color:#888; padding: 40px; background: rgba(0,0,0,0.4); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.1);">${emptyText}</div>`;
            return;
        }

        engines.forEach(engine => {
            const isOnline = engine.status === 'online';
            const statusColor = isOnline ? '#10b981' : '#ef4444';
            const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
            const cpu = engine.vitals?.cpu_percent ? engine.vitals.cpu_percent.toFixed(0) : '0';
            const ram = engine.vitals?.ram_percent ? engine.vitals.ram_percent.toFixed(0) : '0';

            const card = document.createElement('div');
            card.style.cssText = `background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px; position: relative; display: flex; flex-direction: column; transition: transform 0.2s ease, box-shadow 0.2s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.3); backdrop-filter: blur(5px);`;

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div style="overflow: hidden; padding-right: 10px;">
                        <div style="font-weight: 800; font-size: 18px; color: #fff; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; letter-spacing: 0.5px;">${engine.name}</div>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 8px;">
                            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${statusColor}; ${isOnline ? 'box-shadow: 0 0 8px '+statusColor+';' : ''}"></div>
                            <span style="font-size: 11px; color: ${statusColor}; font-family: monospace; letter-spacing: 1px;">${statusText}</span>
                        </div>
                    </div>
                    <div style="display:flex; gap: 8px; flex-shrink: 0; background: rgba(0,0,0,0.5); padding: 5px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                        <button onclick="sys.promptRenameEngine('${engine.id}', '${engine.name}')" style="background:transparent; border:none; color:#0ea5e9; cursor:pointer; font-size: 18px; display:flex; align-items:center; justify-content:center; padding: 4px; transition: transform 0.2s;" title="Rename Node" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"><i class="mdi mdi-pencil"></i></button>
                        <button onclick="sys.deleteEngine('${engine.id}', '${engine.name}')" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size: 18px; display:flex; align-items:center; justify-content:center; padding: 4px; transition: transform 0.2s;" title="Delete Node" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"><i class="mdi mdi-delete"></i></button>
                    </div>
                </div>
                <div style="margin-top: auto; padding-top: 15px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 13px; color: #aaa; display: flex; justify-content: space-between; font-family: monospace;">
                    <span style="display:flex; align-items:center; gap:5px;"><i class="mdi mdi-cpu-64-bit" style="font-size: 16px;"></i> CPU: <span style="color:#fff; font-weight:bold;">${cpu}%</span></span>
                    <span style="display:flex; align-items:center; gap:5px;"><i class="mdi mdi-memory" style="font-size: 16px;"></i> RAM: <span style="color:#fff; font-weight:bold;">${ram}%</span></span>
                </div>
            `;
            container.appendChild(card);
        });

    } catch(e) {
        loader.style.display = 'none';
        container.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color:#ef4444; padding: 30px; background: rgba(239, 68, 68, 0.05); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.2);"><i class="mdi mdi-alert-circle-outline" style="font-size:32px; display:block; margin-bottom:10px;"></i>${e.message}</div>`;
    }
};

// [UPDATE] UX Elegan Menggunakan Overlay Custom untuk Add/Rename Engine
sys.promptAddEngine = () => {
    const isId = localStorage.getItem('flowork_lang') === 'id';

    document.getElementById('engine-form-mode').value = 'add';
    document.getElementById('engine-form-target-id').value = '';
    document.getElementById('engine-form-name').value = '';

    document.getElementById('engine-form-title').innerHTML = `<i class="mdi mdi-server-plus"></i> ${isId ? 'Deploy Node Baru' : 'Deploy New Node'}`;
    document.getElementById('engine-form-desc').innerText = isId ? 'Masukkan nama pengenal yang unik untuk engine baru Anda.' : 'Enter a unique identifier for your new engine.';
    document.getElementById('engine-form-name').placeholder = isId ? 'Nama Node (contoh: Worker-01)' : 'Node Name (e.g. Worker-01)';

    document.getElementById('engine-form-overlay').style.display = 'flex';
    document.getElementById('engine-form-name').focus();
};

sys.promptRenameEngine = (id, oldName) => {
    const isId = localStorage.getItem('flowork_lang') === 'id';

    document.getElementById('engine-form-mode').value = 'rename';
    document.getElementById('engine-form-target-id').value = id;
    document.getElementById('engine-form-name').value = oldName;

    document.getElementById('engine-form-title').innerHTML = `<i class="mdi mdi-pencil"></i> ${isId ? 'Ubah Nama Node' : 'Rename Node'}`;
    document.getElementById('engine-form-desc').innerText = isId ? `Ubah nama untuk Node: ${oldName}` : `Rename your Node: ${oldName}`;

    document.getElementById('engine-form-overlay').style.display = 'flex';
    document.getElementById('engine-form-name').focus();
};

sys.submitEngineForm = async () => {
    const isId = localStorage.getItem('flowork_lang') === 'id';
    const mode = document.getElementById('engine-form-mode').value;
    const targetId = document.getElementById('engine-form-target-id').value;
    const name = document.getElementById('engine-form-name').value.trim();

    if(!name) {
        if(sys.toast) sys.toast(isId ? "Nama tidak boleh kosong!" : "Name cannot be empty!");
        return;
    }

    // Tutup Overlay Form
    document.getElementById('engine-form-overlay').style.display = 'none';

    if (mode === 'add') {
        if(sys.toast) sys.toast(isId ? "Memproses Deploy Node..." : "Deploying Node...");
        try {
            const headers = await sys.getApiHeaders();
            const apiUrl = sys.getApiUrl() + '/user/engines';

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ name: name })
            });

            const data = await res.json();
            if(!res.ok) throw new Error(data.error || "Failed to create engine");

            // Buka Popup Success Token
            document.getElementById('engine-success-id').value = data.id;
            document.getElementById('engine-success-token').value = data.raw_token;
            document.getElementById('engine-token-overlay').style.display = 'flex';

            sys.fetchMyEngines();
        } catch(e) {
            if(sys.toast) sys.toast("Error: " + e.message);
            else alert("Error: " + e.message);
        }
    } else if (mode === 'rename') {
        if(sys.toast) sys.toast(isId ? "Menyimpan perubahan nama..." : "Saving new name...");
        try {
            const headers = await sys.getApiHeaders();
            const apiUrl = sys.getApiUrl() + `/user/engines/${targetId}/update-name`;

            const res = await fetch(apiUrl, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({ name: name })
            });

            if(!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to rename engine");
            }
            if(sys.toast) sys.toast(isId ? "Nama Node berhasil diubah!" : "Node successfully renamed!");
            sys.fetchMyEngines();
        } catch(e) {
            if(sys.toast) sys.toast("Error: " + e.message);
        }
    }
};

// [FITUR] Copy Credential Engine
sys.copyEngineCredential = (type) => {
    const isId = localStorage.getItem('flowork_lang') === 'id';
    const inputElement = document.getElementById(type === 'id' ? 'engine-success-id' : 'engine-success-token');

    if(inputElement) {
        inputElement.select();
        inputElement.setSelectionRange(0, 99999); // Untuk support device jadul
        try {
            document.execCommand('copy');
            if(sys.toast) sys.toast(isId ? "Berhasil disalin ke clipboard!" : "Copied to clipboard!");
        } catch (err) {
            console.error('Gagal menyalin', err);
            if(sys.toast) sys.toast("Gagal menyalin");
        }
    }
};

sys.deleteEngine = async (id, name) => {
    const isId = localStorage.getItem('flowork_lang') === 'id';
    const warningMsg = isId
        ? `WARNING PENTING!\n\nApakah Anda yakin ingin menghapus Node "${name}" secara permanen? Aksi ini tidak dapat dibatalkan.`
        : `CRITICAL WARNING!\n\nAre you sure you want to permanently delete Node "${name}"? This action cannot be undone.`;

    if(!confirm(warningMsg)) return;

    if(sys.toast) sys.toast(isId ? "Memulai pembersihan Node..." : "Initiating Node wipe...");
    try {
        const headers = await sys.getApiHeaders();
        const apiUrl = sys.getApiUrl() + `/user/engines/${id}`;

        const res = await fetch(apiUrl, {
            method: 'DELETE',
            headers: headers
        });

        if(!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to delete engine");
        }
        if(sys.toast) sys.toast(isId ? "Node berhasil dihapus dari sistem." : "Node successfully deleted.");
        sys.fetchMyEngines();
    } catch(e) {
        if(sys.toast) sys.toast("Error: " + e.message);
    }
};

// =========================================================================
// [REBUILT] SYSTEM DASHBOARD - GOLD EDITION LOGIC
// MATCHING VUE DASHBOARD.VUE STRUCTURE & REAL DATA
// =========================================================================

sys.openSystemDashboard = () => {
    if(typeof closeAllSidebars === 'function') closeAllSidebars();

    // 1. Cek Login/Key
    let pk = typeof authPrivateKey !== 'undefined' && authPrivateKey ? authPrivateKey : null;
    if (!pk) pk = localStorage.getItem('flowork_private_key');

    if (!pk) {
        alert("Harap Login terlebih dahulu."); // Keep user flow
        return;
    }

    // 2. Buka Overlay
    const overlay = document.getElementById('system-dashboard-overlay');
    if(overlay) {
        overlay.style.display = 'flex';
        overlay.classList.add('active');
        sys.fetchSystemStats();
    }
};

sys.closeSystemDashboard = () => {
    const overlay = document.getElementById('system-dashboard-overlay');
    if(overlay) {
        overlay.classList.remove('active');
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
};

// [NEW CORE LOGIC] FETCH REAL DATA & RENDER GOLD UI
sys.fetchSystemStats = async () => {
    const overlay = document.getElementById('system-dashboard-overlay');

    // 1. Initial Skeleton (Matches Dashboard.vue structure)
    overlay.innerHTML = `
        <div class="auth-content-wrapper" style="max-width:1200px; padding-top:20px; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:20px;">
                <h2 style="margin:0; font-size:1.2rem; display:flex; align-items:center; gap:10px;">
                    <i class="mdi mdi-view-dashboard text-gold"></i>
                    <span>SYSTEM <span class="text-gold">DASHBOARD</span></span>
                </h2>
                <button class="bottom-nav-btn" style="margin:0; width:40px; height:40px; font-size:18px;" onclick="sys.fetchSystemStats()"><i class="mdi mdi-refresh"></i></button>
            </div>
            <div id="sys-dash-content" class="dashboard-grid">
                <div style="text-align:center; padding:40px; grid-column:1/-1;">
                    <div class="spinner" style="border-top-color:var(--c-gold); width:40px; height:40px; border-width:3px; margin:auto;"></div>
                    <div class="text-gold font-code" style="margin-top:15px; font-size:0.8rem;">INITIALISING SYSTEM...</div>
                </div>
            </div>
            <button class="bottom-nav-btn" onclick="sys.closeSystemDashboard()" style="margin-top:30px;"><i class="mdi mdi-close"></i></button>
        </div>
    `;

    const container = document.getElementById('sys-dash-content');

    try {
        // 2. Fetch Data Real (Engine Stats from API)
        const headers = await sys.getApiHeaders();
        const apiUrl = sys.getApiUrl() + '/user/engines';
        let engines = [];
        let systemMetrics = { cpu: 88, ram: 42, io: 12 };

        try {
            const res = await fetch(apiUrl, { method: 'GET', headers: headers });
            if(res.ok) {
                engines = await res.json();
                let activeCount = 0, totalCpu = 0, totalRam = 0;
                engines.forEach(e => {
                    if(e.status === 'online') {
                        activeCount++;
                        totalCpu += (e.vitals?.cpu_percent || 0);
                        totalRam += (e.vitals?.ram_percent || 0);
                    }
                });
                if(activeCount > 0) {
                    systemMetrics.cpu = Math.round(totalCpu / activeCount);
                    systemMetrics.ram = Math.round(totalRam / activeCount);
                }
            }
        } catch(e) { console.warn("Engine fetch error", e); }

        // 3. User & App Data (REAL DATA)
        const username = localStorage.getItem('flowork_username') || "Guest";
        const apps = (typeof installedApps !== 'undefined') ? installedApps : [];

        // 4. Render HTML Structure (Column Layout matching Vue)
        container.innerHTML = `
            <div class="col-group">
                <div class="glass-panel">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <div style="display:flex; align-items:center; gap:15px;">
                            <div class="avatar-ring-gold">
                                <span class="user-avatar-text text-gold-gradient">${username.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                                <div style="font-weight:700; font-size:1rem; color:var(--c-text-primary);">${username}</div>
                                <div class="status-chip-gold"><span class="dot"></span> PREMIUM</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mini-stats-grid">
                    <div class="stat-tile">
                        <div class="tile-icon" style="color:var(--c-text-tertiary);"><i class="mdi mdi-apps"></i></div>
                        <div class="tile-val" style="color:var(--c-text-primary);">${apps.length}</div>
                        <div class="tile-lbl">Apps</div>
                    </div>
                    <div class="stat-tile active-gold">
                        <div class="tile-icon text-gold"><i class="mdi mdi-server-network"></i></div>
                        <div class="tile-val text-gold">${engines.length}</div>
                        <div class="tile-lbl text-gold-dim">Nodes</div>
                    </div>
                </div>
            </div>

            <div class="col-group">
                <div class="glass-panel">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <div>
                            <div style="font-size:1.2rem; font-weight:700; color:var(--c-text-primary);">System Status</div>
                        </div>
                        <div class="live-pill-gold"><span class="pulse"></span> LIVE FEED</div>
                    </div>

                    <div class="health-layout">
                        <div class="gauge-container">
                            <div class="conic-gauge-gold" style="--val: ${systemMetrics.cpu};">
                                <div class="gauge-inner">
                                    <div class="val-text text-gold-gradient">${systemMetrics.cpu}<span class="percent">%</span></div>
                                    <div class="val-label">CAPACITY</div>
                                </div>
                            </div>
                        </div>

                        <div class="stats-container">
                            <div class="stat-row">
                                <div class="row-header"><span class="lbl">CPU Load</span> <span class="font-code text-gold">${systemMetrics.cpu}%</span></div>
                                <div class="bar-track"><div class="bar-fill gold-fill" style="width: ${systemMetrics.cpu}%"></div></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-group">
                <div class="glass-panel" style="flex:1;">
                    <div class="panel-header">
                        <span class="header-title">Installed Apps</span>
                    </div>
                    <div class="scroll-list custom-scrollbar">
                        ${sys.renderAppListGold(apps)}
                    </div>
                </div>
            </div>
        `;

    } catch(e) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:red;">Render Error: ${e.message}</div>`;
    }
};

sys.renderAppListGold = (apps) => {
    if (!apps || apps.length === 0) return '<div style="text-align:center; color:gray; padding:20px;">No Apps Installed</div>';

    return apps.map(app => {
        const initial = app.name.charAt(0).toUpperCase();
        const entryFile = app.entry_point || app.entry || (app.type === 'apps' ? 'index.html' : 'logic.js');

        // [MODIFIED] Handle Cloud Path (Resolve relative paths like /store/... to BASE_URL)
        let rawPath = app.path;
        if (rawPath && rawPath.startsWith('/') && !rawPath.startsWith('http')) {
             if (typeof BASE_URL !== 'undefined' && BASE_URL !== '') rawPath = BASE_URL + rawPath;
             else rawPath = "https://flowork.cloud" + rawPath;
        }

        // [MODIFIED] SMART ROUTING: index.html (Vue) lari ke /flow/, logic.js tetap di path fisik (Rule #1)
        let finalUrl = app.logic;
        const appId = app.slug || app.id;

        if (!finalUrl) {
            // Jika entry adalah HTML dan berasal dari cloud, gunakan jalur /flow/id agar Vue App jalan sempurna
            if (entryFile.toLowerCase().endsWith('.html') && app.source === 'cloud' && appId) {
                finalUrl = "https://flowork.cloud/flow/" + appId;
            } else {
                // Fallback ke path fisik asli untuk logic.js atau app lokal
                finalUrl = (rawPath.endsWith('/') ? rawPath + entryFile : rawPath + '/' + entryFile);
            }
        }

        const targetUrl = finalUrl;

        const clickAction = `sys.boot('${targetUrl}', '${app.name}')`;
        return `
        <div class="module-card-sm" onclick="${clickAction}" style="cursor:pointer; display:flex; align-items:center; padding:10px; background:rgba(255,255,255,0.02); border-radius:12px; margin-bottom:8px;">
            <div style="width:36px; height:36px; background:linear-gradient(135deg, #FCD34D, #F59E0B); color:#000; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:900; margin-right:12px;">${initial}</div>
            <span style="font-weight:700; color:#fff;">${app.name}</span>
        </div>
        `;
    }).join('');
};