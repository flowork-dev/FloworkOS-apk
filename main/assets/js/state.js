var installedApps = [];
var favoriteIds = [];
var globalAds = []; // [BARU] Container untuk Ads
var currentWalletNetwork = 'polygon';

var authPrivateKey = null;
var authUserIdentity = null;
var localApiVault = {};
var _tempWallet = null;

var nativeRoot = null;
var loader = null;

window.sys = {
    root: null,
    lang: 'en',
    _unlockTarget: 'auth'
};