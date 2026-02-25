// /* [ZOMBIE CODE] RULE NO 1: Fungsi dibuang tapi dikomen, dipindah ke sys */
// async function getSecureApiHeaders() { ... }

sys.getSecureApiHeaders = async () => {
    const headers = { 'Content-Type': 'application/json' };

    // [SECURITY FIX] Cek eksistensi key sebelum lanjut
    if (!authPrivateKey) return headers;

    if (window.ethers) {
        try {
            // Scope wallet sesempit mungkin
            const wallet = new ethers.Wallet(authPrivateKey);
            const timestamp = Math.floor(Date.now() / 1000);
            const messageToSign = `flowork_api_auth|${wallet.address}|${timestamp}`;
            const signature = await wallet.signMessage(messageToSign);

            headers['X-User-Address'] = wallet.address;
            headers['X-Signature'] = signature;
            headers['X-Signed-Message'] = messageToSign;
            headers['X-Payload-Version'] = "2";
        } catch (e) {
            console.error("Crypto Signature Error:", e);
        }
    }
    return headers;
};

sys.generateIdentity = () => {
    if (!window.ethers) { sys.toast(sys.t('toast_init')); return; }
    sys.toast(sys.t('toast_gen'));
    document.getElementById('btn-generate-key').style.display = 'none';
    const wallet = ethers.Wallet.createRandom();
    document.getElementById('generated-mnemonic').value = wallet.mnemonic.phrase;
    _tempWallet = wallet;
    document.getElementById('register-result-area').style.display = 'block';
};

sys.confirmRegistration = () => {
    if (!_tempWallet) return;
    document.getElementById('register-overlay').style.display = 'none';
    sys.showPinSetup();
};

sys.handleLogin = async () => {
    const val = document.getElementById('wallet-key-input').value.trim();
    if (!val) { sys.toast(sys.t('toast_empty')); return; }
    if (!window.ethers) { sys.toast(sys.t('toast_init')); return; }
    try {
        document.getElementById('wallet-key-input').disabled = true;
        sys.toast(sys.t('toast_validating'));
        let wallet;
        if (val.startsWith('0x')) wallet = new ethers.Wallet(val);
        else wallet = ethers.Wallet.fromPhrase(val);

        _tempWallet = wallet;
        document.getElementById('login-overlay').style.display = 'none';
        sys.showPinSetup();
    } catch(e) {
        document.getElementById('wallet-key-input').disabled = false;
        sys.toast(sys.t('toast_invalid'));
    }
};

sys.confirmPinSetup = async () => {
    const pin = document.getElementById('wallet-pin-create').value;
    if(pin.length !== 6) { sys.toast(sys.t('toast_pin_length')); return; }
    if (!_tempWallet) return;

    sys.toast(sys.t('toast_encrypting'));
    document.getElementById('btn-save-pin').disabled = true;

    const progressUI = document.getElementById('encrypt-progress-bar');
    const percentUI = document.getElementById('encrypt-percent');
    progressUI.style.display = 'block';

    try {
        const keystoreJson = await _tempWallet.encrypt(pin, (progress) => {
            percentUI.innerText = Math.round(progress * 100) + '%';
        });

        localStorage.setItem('flowork_keystore', keystoreJson);
        localStorage.setItem('flowork_user_identity', JSON.stringify({
            id: _tempWallet.address, username: _tempWallet.address
        }));

        authPrivateKey = _tempWallet.privateKey;
        sys.toast(sys.t('toast_created'));
        document.getElementById('pin-setup-overlay').style.display = 'none';
        _tempWallet = null;
        sys.checkAuth();
    } catch(e) {
        console.error("Encryption failed:", e);
        document.getElementById('btn-save-pin').disabled = false;
    }
};

sys.confirmPinUnlock = async () => {
    const pin = document.getElementById('wallet-pin-unlock').value;
    if(pin.length !== 6) { sys.toast(sys.t('toast_pin_length')); return; }

    const keystoreJson = localStorage.getItem('flowork_keystore');
    if(!keystoreJson) { sys.showLogin(); return; }

    sys.toast(sys.t('toast_decrypting'));
    document.getElementById('btn-unlock-pin').disabled = true;

    const progressUI = document.getElementById('decrypt-progress-bar');
    const percentUI = document.getElementById('decrypt-percent');
    progressUI.style.display = 'block';

    try {
        const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, pin, (progress) => {
            percentUI.innerText = Math.round(progress * 100) + '%';
        });

        authPrivateKey = wallet.privateKey;
        document.getElementById('pin-unlock-overlay').style.display = 'none';

        if (sys._unlockTarget === 'wallet') {
            sys.proceedToWallet();
        }
        else if (sys._unlockTarget === 'vault') {
            sys.proceedToVault();
        }
        else if (sys._unlockTarget === 'show_key') {
            sys.openProfile();
        }
        else if (sys._unlockTarget === 'send_crypto') {
            document.getElementById('wallet-overlay').style.display = 'flex';
            sys.sendCrypto();
        }
        else {
            sys.checkAuth();
        }
    } catch(e) {
        console.error("Wrong PIN:", e);
        sys.toast(sys.t('toast_wrong_pin'));
        document.getElementById('btn-unlock-pin').disabled = false;
        progressUI.style.display = 'none';
        document.getElementById('wallet-pin-unlock').value = '';
    }
};

sys.checkAuth = () => {
    const keystoreJson = localStorage.getItem('flowork_keystore');
    const identityRaw = localStorage.getItem('flowork_user_identity');

    if (identityRaw && keystoreJson) {
        authUserIdentity = JSON.parse(identityRaw);
        document.querySelectorAll('.full-overlay').forEach(el => el.style.display = 'none');
        document.getElementById('auth-lang-container').style.display = 'none';

        const addr = authUserIdentity.id || "Unknown";
        const uname = (authUserIdentity.username && authUserIdentity.username !== addr) ? authUserIdentity.username : addr.substring(0, 8) + '...';

        if (authUserIdentity.avatar && authUserIdentity.avatar.trim() !== '') {
            document.getElementById('profile-avatar').innerHTML = `<img src="${authUserIdentity.avatar}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'; this.parentElement.innerHTML='${uname.substring(0,2).toUpperCase()}'">`;
        } else {
            document.getElementById('profile-avatar').innerHTML = uname.substring(0, 2).toUpperCase();
        }

        document.getElementById('profile-name').innerHTML = uname;
        document.getElementById('profile-status').innerHTML = 'Connected <i class="mdi mdi-check-decagram text-success"></i>';

        if (typeof fetchApps === "function") fetchApps();
    } else {
        if(loader) loader.style.display = 'none';
        sys.showLogin();
    }
};

sys.logout = () => {
    localStorage.removeItem('flowork_keystore');
    localStorage.removeItem('flowork_user_identity');
    window.location.reload();
};

sys.fetchVaultKeys = async (forceFetch = false) => {
    if (!authPrivateKey) return;
    const CACHE_LIFETIME = 7 * 24 * 60 * 60 * 1000;
    const lastFetchTimestamp = localStorage.getItem('flowork_vars_last_fetch');
    const now = Date.now();

    if (!forceFetch && lastFetchTimestamp && (now - parseInt(lastFetchTimestamp)) < CACHE_LIFETIME) {
        sys.renderVaultKeys();
        return;
    }

    try {
        const headers = await sys.getSecureApiHeaders();
        const res = await fetch(`${BASE_URL}/api/v1/variables`, { headers: headers });
        if(res.ok) {
            const data = await res.json();
            localApiVault = {};
            if(Array.isArray(data)) { data.forEach(v => { localApiVault[v.name] = v.value; }); }
            localStorage.setItem('flowork_local_vars', JSON.stringify(localApiVault));
            localStorage.setItem('flowork_vars_last_fetch', now.toString());
        }
    } catch(e) { console.error('Cloud Sync Error', e); }
    sys.renderVaultKeys();
};

sys.saveVaultKey = async () => {
    const k = document.getElementById('vault-key-name').value.trim();
    const v = document.getElementById('vault-key-val').value.trim();
    if (k && v) {
        localApiVault[k] = v;
        localStorage.setItem('flowork_local_vars', JSON.stringify(localApiVault));
        document.getElementById('vault-key-name').value = '';
        document.getElementById('vault-key-val').value = '';
        sys.renderVaultKeys();

        sys.toast(sys.t('toast_syncing'));
        try {
            const headers = await sys.getSecureApiHeaders();
            const payload = { value: v, is_enabled: true, is_secret: true, mode: 'single' };
            const res = await fetch(`${BASE_URL}/api/v1/variables/${encodeURIComponent(k)}`, {
                method: 'PUT', headers: headers, body: JSON.stringify(payload)
            });
            if (res.ok) {
                sys.toast(sys.t('toast_synced'));
                localStorage.setItem('flowork_vars_last_fetch', Date.now().toString());
            }
        } catch(e) { console.error('Save to Cloud Error', e); }
    } else { sys.toast(sys.t('toast_empty')); }
};

sys.removeVaultKey = async (k) => {
    delete localApiVault[k];
    localStorage.setItem('flowork_local_vars', JSON.stringify(localApiVault));
    sys.renderVaultKeys();
    try {
        const headers = await sys.getSecureApiHeaders();
        await fetch(`${BASE_URL}/api/v1/variables/${encodeURIComponent(k)}`, { method: 'DELETE', headers: headers });
        sys.toast(sys.t('toast_deleted'));
        localStorage.setItem('flowork_vars_last_fetch', Date.now().toString());
    } catch(e) { console.error('Delete from Cloud Error', e); }
};

sys.handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    sys.toast(sys.t('toast_compressing'));
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 256;
            let width = img.width; let height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
            else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            document.getElementById('profile-avatar-base64').value = compressedBase64;
            document.getElementById('profile-avatar-preview').innerHTML = `<img src="${compressedBase64}" style="width:100%;height:100%;object-fit:cover;">`;
            document.getElementById('sys-toast').style.opacity = '0';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
};

sys.saveProfile = () => {
    const newName = document.getElementById('profile-name-input').value.trim();
    const newAvatarBase64 = document.getElementById('profile-avatar-base64').value;
    authUserIdentity.username = newName || authUserIdentity.id;
    authUserIdentity.avatar = newAvatarBase64;
    try {
        localStorage.setItem('flowork_user_identity', JSON.stringify(authUserIdentity));
        sys.checkAuth();
        sys.closeProfile();
        sys.toast(sys.t('toast_profile_saved'));
    } catch(e) { sys.toast("Error: Storage Quota Exceeded. Image too large."); }
};

sys.fetchBalance = async (forceReload = false) => {
    if (!authUserIdentity || !window.ethers) return;

    const net = NETWORKS[currentWalletNetwork];
    document.getElementById('wallet-symbol-display').innerText = net.symbol;

    const tokenListContainer = document.getElementById('wallet-token-list');
    const sendAssetSelect = document.getElementById('wallet-send-asset');

    const cacheKey = `fw_bal_${currentWalletNetwork}_${authUserIdentity.id}`;
    const timeKey = `fw_time_${currentWalletNetwork}_${authUserIdentity.id}`;
    const CACHE_LIMIT = 60 * 60 * 1000;

    if (!forceReload) {
        const lastTime = localStorage.getItem(timeKey);
        if (lastTime && (Date.now() - parseInt(lastTime) < CACHE_LIMIT)) {
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
                try {
                    const parsed = JSON.parse(cachedData);
                    document.getElementById('wallet-balance-display').innerText = parsed.nativeBalance;
                    sendAssetSelect.innerHTML = parsed.selectHtml;
                    tokenListContainer.innerHTML = parsed.tokenHtml;
                    return;
                } catch(e) { console.error("Cache parsing error", e); }
            }
        }
    }

    document.getElementById('wallet-balance-display').innerText = "...";
    tokenListContainer.innerHTML = '<div style="text-align:center; color:#555; font-size:11px; padding: 10px;">Loading assets...</div>';

    if(forceReload) { sys.toast(sys.t('toast_refreshing')); }

    try {
        const provider = new ethers.JsonRpcProvider(net.rpc);

        const balanceBigInt = await provider.getBalance(authUserIdentity.id);
        const balanceFormatted = ethers.formatEther(balanceBigInt);
        const nativeBalanceStr = parseFloat(balanceFormatted).toFixed(4);

        document.getElementById('wallet-balance-display').innerText = nativeBalanceStr;
        let selectHtmlStr = `<option value="native">${net.name} Native (${net.symbol})</option>`;

        let tokenHtmlStr = '';
        if(net.tokens && net.tokens.length > 0) {
            for (const token of net.tokens) {
                try {
                    const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
                    const bal = await contract.balanceOf(authUserIdentity.id);
                    const dec = await contract.decimals();
                    const formattedBal = ethers.formatUnits(bal, dec);

                    tokenHtmlStr += `
                        <div style="display: flex; justify-content: space-between; background: #222; padding: 10px; border-radius: 8px; margin-bottom: 8px; align-items: center;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="width:24px; height:24px; background:#333; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; border: 1px solid #555;">${token.symbol[0]}</div>
                                <span style="font-size: 13px; font-weight: bold; color: #fff;">${token.name}</span>
                            </div>
                            <span style="font-size: 13px; color: #0ea5e9;">${parseFloat(formattedBal).toFixed(4)} ${token.symbol}</span>
                        </div>
                    `;
                    selectHtmlStr += `<option value="${token.address}">Token: ${token.symbol}</option>`;
                } catch(err) { console.error(`Gagal ambil data token ${token.symbol}: `, err); }
            }
        }

        tokenHtmlStr = tokenHtmlStr || '<div style="text-align:center; color:#555; font-size:11px; padding: 10px;">No tokens in this network.</div>';

        sendAssetSelect.innerHTML = selectHtmlStr;
        tokenListContainer.innerHTML = tokenHtmlStr;

        const dataToCache = { nativeBalance: nativeBalanceStr, selectHtml: selectHtmlStr, tokenHtml: tokenHtmlStr };
        localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
        localStorage.setItem(timeKey, Date.now().toString());

    } catch(e) {
        console.error("Gagal ngecek saldo: ", e);
        document.getElementById('wallet-balance-display').innerText = "ERROR";
        tokenListContainer.innerHTML = '<div style="text-align:center; color:#ff4757; font-size:11px; padding: 10px;">Connection failed! Click reload icon to retry.</div>';
    }
};

sys.requestSendCrypto = () => {
    const toAddress = document.getElementById('wallet-send-to').value.trim();
    const amount = document.getElementById('wallet-send-amount').value.trim();
    if (!toAddress || !amount) { sys.toast(sys.t('toast_empty')); return; }
    if (!ethers.isAddress(toAddress)) { sys.toast(sys.t('toast_invalid_address')); return; }
    sys.showPinUnlock('send_crypto');
};

sys.sendCrypto = async () => {
    if (!authPrivateKey || !window.ethers) return;
    const toAddress = document.getElementById('wallet-send-to').value.trim();
    const amount = document.getElementById('wallet-send-amount').value.trim();
    const selectedAsset = document.getElementById('wallet-send-asset').value;

    sys.toast(sys.t('toast_tx_processing'));

    try {
        const btn = document.querySelector('#wallet-overlay .vault-btn.primary');
        btn.disabled = true; btn.style.opacity = '0.5';

        const net = NETWORKS[currentWalletNetwork];
        const provider = new ethers.JsonRpcProvider(net.rpc);
        const wallet = new ethers.Wallet(authPrivateKey, provider);

        let tx;
        if (selectedAsset === 'native') {
            tx = await wallet.sendTransaction({ to: toAddress, value: ethers.parseEther(amount) });
        } else {
            const contract = new ethers.Contract(selectedAsset, ERC20_ABI, wallet);
            const dec = await contract.decimals();
            const parsedAmount = ethers.parseUnits(amount, dec);
            tx = await contract.transfer(toAddress, parsedAmount);
        }

        sys.toast(sys.t('toast_tx_wait'));
        await tx.wait();
        sys.toast(sys.t('toast_tx_success'));

        document.getElementById('wallet-send-to').value = '';
        document.getElementById('wallet-send-amount').value = '';
        btn.disabled = false; btn.style.opacity = '1';

        sys.fetchBalance(true);
    } catch (e) {
        console.error("Transaksi gagal: ", e);
        sys.toast(sys.t('toast_tx_failed'));
        const btn = document.querySelector('#wallet-overlay .vault-btn.primary');
        btn.disabled = false; btn.style.opacity = '1';
    }
};