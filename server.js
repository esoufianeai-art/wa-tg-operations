const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { spawn, exec } = require('child_process');
const net = require('net');
const crypto = require('crypto');
const { TelegramClient } = require('telegram');
const { Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { computeCheck } = require('telegram/Password');

const isPackaged = !path.basename(process.execPath).toLowerCase().startsWith('node');
const basePath = isPackaged ? path.dirname(process.execPath) : __dirname;

const PORT = 3000;

// Output Files
const VALID_VCF = path.join(basePath, 'output_whatsapp.vcf');
const INVALID_FILE = path.join(basePath, 'no_whatsapp.txt');
const VALID_WAME_VCF = VALID_VCF;
const VALID_TME_VCF = path.join(basePath, 'output_telegram.vcf');
const LEGACY_OUTPUT_FILES = [
    path.join(basePath, 'valid_whatsapp.vcf'),
    path.join(basePath, 'no_whatsapp.txt'),
    path.join(basePath, 'valid_wame_links.vcf'),
    path.join(basePath, 'valid_tme_links.vcf')
];
const CONFIG_FILE = path.join(basePath, 'settings.json');
const RESUME_FILE = path.join(basePath, 'resume_state.json');
const INDUSTRIAL_CURSOR_FILE = path.join(basePath, 'industrial_cursor.json');
const SESSION_BACKUP_DIR = path.join(basePath, 'data', 'session_backups');
const DEFAULT_TELEGRAM_API_FILE = path.join(basePath, 'MY TELEGRAM API.txt');
const TELEGRAM_SESSION_FILE = path.join(basePath, 'telegram_session.txt');
const SESSION_DIRS = [
    path.join(basePath, 'auth_session'),
    path.join(basePath, 'auth_session_cli'),
    path.join(basePath, 'browser_session')
];
const BROWSER_SESSION_DIR = path.join(basePath, 'browser_session');
const CACHE_CLEAN_INTERVAL_MS = 60000;
const CACHE_TARGETS = [
    path.join(BROWSER_SESSION_DIR, 'component_crx_cache'),
    path.join(BROWSER_SESSION_DIR, 'GraphiteDawnCache'),
    path.join(BROWSER_SESSION_DIR, 'GrShaderCache'),
    path.join(BROWSER_SESSION_DIR, 'ShaderCache'),
    path.join(BROWSER_SESSION_DIR, 'Default', 'blob_storage'),
    path.join(BROWSER_SESSION_DIR, 'Default', 'Cache'),
    path.join(BROWSER_SESSION_DIR, 'Default', 'Code Cache'),
    path.join(BROWSER_SESSION_DIR, 'Default', 'DawnGraphiteCache'),
    path.join(BROWSER_SESSION_DIR, 'Default', 'DawnWebGPUCache'),
    path.join(BROWSER_SESSION_DIR, 'Default', 'GPUCache'),
    path.join(BROWSER_SESSION_DIR, 'Default', 'Service Worker', 'CacheStorage'),
    path.join(BROWSER_SESSION_DIR, 'Default', 'Service Worker', 'ScriptCache'),
    path.join(BROWSER_SESSION_DIR, 'Default', 'Shared Dictionary', 'cache')
];

// Industrial Input File
const DEFAULT_INDUSTRIAL_INPUT_FILE = path.join(basePath, 'belgian_mobile_20260516_135516_shuffled.txt');
const ESTIMATED_NETWORK_MS = 2500;
const MAX_TRANSIENT_RETRIES = 4;
const MIN_MANUAL_ROTATION_GAP_MS = 20000;
const POST_ROTATION_SETTLE_MS = 8000;
const SPEED_PRESETS = {
    quality: {
        label: 'Qualite maximale',
        concurrentChecks: 5,
        minDelayMs: 1200,
        maxDelayMs: 2500,
        rotationIntervalMs: 90000,
        reliability: 'Fiabilite maximale',
        note: 'Debit reduit, retries limites, exports propres.'
    },
    balanced: {
        label: 'Equilibre business',
        concurrentChecks: 10,
        minDelayMs: 500,
        maxDelayMs: 1500,
        rotationIntervalMs: 60000,
        reliability: 'Fiabilite elevee',
        note: 'Profil recommande pour la production.'
    },
    fast: {
        label: 'Rapide controle',
        concurrentChecks: 18,
        minDelayMs: 350,
        maxDelayMs: 900,
        rotationIntervalMs: 45000,
        reliability: 'Stable si le reseau suit',
        note: 'Debit plus haut avec delais conservateurs.'
    },
    maxStable: {
        label: 'Maximum stable',
        concurrentChecks: 30,
        minDelayMs: 250,
        maxDelayMs: 700,
        rotationIntervalMs: 30000,
        reliability: 'Plafond stable',
        note: 'Vitesse maximale gardee dans les limites de qualite.'
    }
};

// Runtime settings controlled by the GUI.
let config = {
    runMode: 'manual',
    speedPreset: 'balanced',
    industrialInputFile: DEFAULT_INDUSTRIAL_INPUT_FILE,
    batchSize: 5000,
    concurrentChecks: 10,
    minDelayMs: 500,
    maxDelayMs: 1500,
    rotationIntervalMs: 60000,
    autoStartIndustrial: false,
    autoRemoveProcessed: true,
    browserSessionMode: 'stable',
    autoCacheCleaner: true,
    cacheMaxMb: 250,
    telegramLinksEnabled: true,
    telegramLinkTemplate: 'https://t.me/+{number}',
    telegramApiEnabled: true,
    telegramApiFile: DEFAULT_TELEGRAM_API_FILE,
    licenseKey: ''
};

// Cryptographic Licensing helpers
const SECRET_PASSPHRASE = 'JanusTesavekAntigravitySecuredEnginev10';
const SALT = 'WaOperationsCustomLicenceSalt';

function decryptLicense(licenseStr) {
    if (!licenseStr || !licenseStr.includes('.')) return null;
    try {
        const [ivHex, encryptedHex] = licenseStr.split('.');
        const key = crypto.scryptSync(SECRET_PASSPHRASE, SALT, 32);
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        const payload = JSON.parse(decrypted);
        if (payload && payload.tag === 'WA_OPERATIONS_LICENSE_V10' && payload.expirationDate) {
            return new Date(payload.expirationDate);
        }
    } catch (e) {}
    return null;
}

function getLicenseState() {
    if (!config.licenseKey) return { valid: false, error: 'License key is missing. Enter license to unlock VCF output.' };
    const expires = decryptLicense(config.licenseKey);
    if (!expires) return { valid: false, error: 'Invalid license key format.' };
    if (expires < new Date()) return { valid: false, error: `License expired on ${expires.toISOString().slice(0,10)}.` };
    return { valid: true, expires: expires.toISOString().slice(0, 10) };
}

function checkLicenseValid() {
    return getLicenseState().valid;
}

// Auto-shutdown tracking when all clients disconnect
let connectedClientsCount = 0;
let autoShutdownTimer = null;

function planAutoShutdown() {
    if (autoShutdownTimer) clearTimeout(autoShutdownTimer);
    autoShutdownTimer = setTimeout(() => {
        if (connectedClientsCount === 0) {
            console.log('[*] No active GUI connections detected for 15 seconds. Terminating background services...');
            try {
                if (torProcess) torProcess.kill();
            } catch (e) {}
            process.exit(0);
        }
    }, 15000);
}

// Trigger initial auto-shutdown check in case GUI doesn't connect at boot
planAutoShutdown();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(basePath, 'public')));
app.use(express.json({ limit: '50mb' }));

let isChecking = false;
let shouldStop = false;
let stats = { total: 0, checked: 0, valid: 0, invalid: 0, telegramValid: 0, errors: 0 };
let activeSession = null;
let resumeState = null;
let isTorReady = false;
let torProcess = null;
let pendingTelegramLogin = null;
let globalTelegramClient = null;
let globalTelegramClientInitPromise = null;

const torAgent = new SocksProxyAgent('socks5://127.0.0.1:9050');
let validWameStream = fs.createWriteStream(VALID_WAME_VCF, { flags: 'a' });
let validTmeStream = fs.createWriteStream(VALID_TME_VCF, { flags: 'a' });
let lastRotationAt = 0;
let rotationInProgress = false;
let telegramApiWarningSent = false;

function closeOutputStreams() {
    validWameStream.end();
    validTmeStream.end();
}

function reopenOutputStreams(clearFiles = false) {
    try {
        closeOutputStreams();

        if (clearFiles) {
            [VALID_WAME_VCF, VALID_TME_VCF].forEach(f => {
                if (fs.existsSync(f)) {
                    fs.writeFileSync(f, '');
                }
            });
            LEGACY_OUTPUT_FILES.forEach(f => {
                if (fs.existsSync(f)) {
                    try { fs.unlinkSync(f); } catch (err) { fs.writeFileSync(f, ''); }
                }
            });
            console.log('[+] Active output files cleared.');
        }

        validWameStream = fs.createWriteStream(VALID_WAME_VCF, { flags: 'a' });
        validTmeStream = fs.createWriteStream(VALID_TME_VCF, { flags: 'a' });
    } catch (err) {
        console.error('[ERR] Failed to re-open output streams:', err);
    }
}

process.once('SIGINT', () => {
    closeOutputStreams();
    process.exit(0);
});

function clampInt(value, min, max, fallback) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function cleanConfigPatch(patch = {}) {
    const next = { ...config };

    if (patch.runMode === 'manual' || patch.runMode === 'industrial') next.runMode = patch.runMode;
    if (SPEED_PRESETS[patch.speedPreset]) {
        next.speedPreset = patch.speedPreset;
        Object.assign(next, {
            concurrentChecks: SPEED_PRESETS[patch.speedPreset].concurrentChecks,
            minDelayMs: SPEED_PRESETS[patch.speedPreset].minDelayMs,
            maxDelayMs: SPEED_PRESETS[patch.speedPreset].maxDelayMs,
            rotationIntervalMs: SPEED_PRESETS[patch.speedPreset].rotationIntervalMs
        });
    } else if (patch.speedPreset === 'custom') {
        next.speedPreset = 'custom';
    }
    if (typeof patch.industrialInputFile === 'string' && patch.industrialInputFile.trim()) {
        next.industrialInputFile = patch.industrialInputFile.trim();
    }

    next.batchSize = clampInt(patch.batchSize, 100, 100000, next.batchSize);
    if (next.speedPreset === 'custom') {
        next.concurrentChecks = clampInt(patch.concurrentChecks, 1, SPEED_PRESETS.maxStable.concurrentChecks, next.concurrentChecks);
        next.minDelayMs = clampInt(patch.minDelayMs, SPEED_PRESETS.maxStable.minDelayMs, 60000, next.minDelayMs);
        next.maxDelayMs = clampInt(patch.maxDelayMs, SPEED_PRESETS.maxStable.maxDelayMs, 120000, next.maxDelayMs);
        next.rotationIntervalMs = clampInt(patch.rotationIntervalMs, SPEED_PRESETS.maxStable.rotationIntervalMs, 3600000, next.rotationIntervalMs);
    }
    next.autoStartIndustrial = patch.autoStartIndustrial === true;
    next.autoRemoveProcessed = patch.autoRemoveProcessed !== false;
    if (patch.browserSessionMode === 'stable' || patch.browserSessionMode === 'resetOnStart') {
        next.browserSessionMode = patch.browserSessionMode;
    }
    next.autoCacheCleaner = patch.autoCacheCleaner !== false;
    next.cacheMaxMb = clampInt(patch.cacheMaxMb, 50, 5000, next.cacheMaxMb);
    next.telegramLinksEnabled = patch.telegramLinksEnabled !== false;
    if (typeof patch.telegramLinkTemplate === 'string' && patch.telegramLinkTemplate.trim()) {
        const template = patch.telegramLinkTemplate.trim();
        next.telegramLinkTemplate = template.includes('{number}') ? template : 'https://t.me/+{number}';
    }
    next.telegramApiEnabled = patch.telegramApiEnabled !== false;
    if (typeof patch.telegramApiFile === 'string' && patch.telegramApiFile.trim()) {
        next.telegramApiFile = patch.telegramApiFile.trim();
    }
    if (typeof patch.licenseKey === 'string') {
        next.licenseKey = patch.licenseKey.trim();
    }

    if (next.maxDelayMs < next.minDelayMs) next.maxDelayMs = next.minDelayMs;
    return next;
}

function telegramApiState() {
    const parsed = {
        apiId: null,
        apiHash: null,
        phone: null,
        botToken: null
    };
    const state = {
        enabled: config.telegramApiEnabled,
        fileName: path.basename(config.telegramApiFile || DEFAULT_TELEGRAM_API_FILE),
        exists: false,
        ready: false,
        detected: [],
        checks: {
            apiId: false,
            apiHash: false,
            phone: false,
            botToken: false,
            session: false
        },
        mode: 'not-ready',
        maskedPhone: null,
        policy: 'Telegram API is gated after WhatsApp valid only. Secrets are not exposed.'
    };

    try {
        if (!config.telegramApiFile || !fs.existsSync(config.telegramApiFile)) return state;
        const text = fs.readFileSync(config.telegramApiFile, 'utf-8');
        state.exists = true;

        const apiIdMatch = text.match(/(?:api|app)[_ -]?id\s*[:=]\s*(\d{4,12})/i) || text.match(/\b(\d{5,12})\b/);
        const apiHashMatch = text.match(/(?:api|app)[_ -]?hash\s*[:=]\s*([a-f0-9]{32})/i) || text.match(/\b([a-f0-9]{32})\b/i);
        const phoneMatch = text.match(/(?:phone|number|tel)\s*[:=]\s*(\+?\d{7,15})/i);
        const botTokenMatch = text.match(/(?:bot[_ -]?token|token)\s*[:=]\s*(\d{6,}:[A-Za-z0-9_-]{20,})/i);

        parsed.apiId = apiIdMatch?.[1] || null;
        parsed.apiHash = apiHashMatch?.[1] || null;
        parsed.phone = phoneMatch?.[1] || null;
        parsed.botToken = botTokenMatch?.[1] || null;

        state.checks.apiId = !!parsed.apiId;
        state.checks.apiHash = !!parsed.apiHash;
        state.checks.phone = !!parsed.phone;
        state.checks.botToken = !!parsed.botToken;
        if (state.checks.apiId) state.detected.push('api_id');
        if (state.checks.apiHash) state.detected.push('api_hash');
        if (state.checks.phone) state.detected.push('phone');
        if (state.checks.botToken) state.detected.push('bot_token');
        state.checks.session = fs.existsSync(TELEGRAM_SESSION_FILE) && fs.statSync(TELEGRAM_SESSION_FILE).size > 20;
        if (state.checks.session) state.detected.push('session');

        if (parsed.phone) {
            const tail = parsed.phone.replace(/\D/g, '').slice(-4);
            state.maskedPhone = `***${tail}`;
        }
        state.mode = parsed.botToken ? 'bot' : parsed.phone ? 'user' : 'credentials-only';
        state.ready = state.enabled && state.checks.apiId && state.checks.apiHash && (state.checks.botToken || (state.checks.phone && state.checks.session));
        return state;
    } catch (err) {
        state.error = err.message;
        return state;
    }
}

function telegramApiMissingParts(state = telegramApiState()) {
    const missing = [];
    if (!state.exists) missing.push('api_file');
    if (!state.checks?.apiId) missing.push('api_id');
    if (!state.checks?.apiHash) missing.push('api_hash');
    if (!state.checks?.phone && !state.checks?.botToken) missing.push('phone_or_bot_token');
    if (state.checks?.phone && !state.checks?.botToken && !state.checks?.session) missing.push('telegram_session');
    return missing;
}

function parseTelegramApiCredentials() {
    const apiFile = config.telegramApiFile || DEFAULT_TELEGRAM_API_FILE;
    if (!fs.existsSync(apiFile)) {
        throw new Error(`Telegram API file not found: ${apiFile}`);
    }
    const text = fs.readFileSync(apiFile, 'utf-8');
    const apiIdMatch = text.match(/(?:api|app)[_ -]?id\s*[:=]\s*(\d{4,12})/i) || text.match(/\b(\d{5,12})\b/);
    const apiHashMatch = text.match(/(?:api|app)[_ -]?hash\s*[:=]\s*([a-f0-9]{32})/i) || text.match(/\b([a-f0-9]{32})\b/i);
    const phoneMatch = text.match(/(?:phone|number|tel)\s*[:=]\s*(\+?\d{7,15})/i);
    const botTokenMatch = text.match(/(?:bot[_ -]?token|token)\s*[:=]\s*(\d{6,}:[A-Za-z0-9_-]{20,})/i);

    const apiId = Number(apiIdMatch?.[1]);
    const apiHash = apiHashMatch?.[1];
    const phone = phoneMatch?.[1] || null;
    const botToken = botTokenMatch?.[1] || null;

    if (!apiId || !apiHash) throw new Error('Telegram API file must contain api_id and api_hash.');
    if (!phone && !botToken) throw new Error('Telegram API file must contain phone=+XXXXXXXX or bot_token=...');
    return { apiId, apiHash, phone, botToken };
}

function maskPhone(phone) {
    return `***${String(phone || '').replace(/\D/g, '').slice(-4)}`;
}

async function closePendingTelegramLogin() {
    if (!pendingTelegramLogin?.client) return;
    try {
        await pendingTelegramLogin.client.disconnect();
    } catch (err) {}
    pendingTelegramLogin = null;
}

function createTelegramClient(session, apiId, apiHash) {
    const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
        requestRetries: 3,
        timeout: 20,
        autoReconnect: false
    });
    client._loopStarted = true;
    return client;
}

async function initGlobalTelegramClient() {
    if (!config.telegramApiEnabled) return false;
    if (globalTelegramClient) return true;
    if (globalTelegramClientInitPromise) return globalTelegramClientInitPromise;

    globalTelegramClientInitPromise = (async () => {
        const state = telegramApiState();
        if (!state.ready) {
            if (!telegramApiWarningSent) {
                telegramApiWarningSent = true;
                io.emit('status', { type: 'warning', message: 'Telegram session non configuree. MTProto desactive.' });
            }
            return false;
        }
        try {
            io.emit('status', { type: 'info', message: 'Connexion a l\'API Telegram MTProto...' });
            const { apiId, apiHash } = parseTelegramApiCredentials();
            const savedSession = fs.readFileSync(TELEGRAM_SESSION_FILE, 'utf-8').trim();
            globalTelegramClient = createTelegramClient(new StringSession(savedSession), apiId, apiHash);
            await globalTelegramClient.connect();
            io.emit('status', { type: 'success', message: 'Telegram MTProto API connectee. Session validee, verification numero non activee.' });
            io.emit('config', publicConfig());
            return true;
        } catch (err) {
            console.error('[ERR] Global TG client failed:', err.message);
            globalTelegramClient = null;
            io.emit('status', { type: 'error', message: `Telegram connection failed: ${err.message}` });
            return false;
        }
    })();

    try {
        return await globalTelegramClientInitPromise;
    } finally {
        globalTelegramClientInitPromise = null;
    }
}

async function stopGlobalTelegramClient() {
    globalTelegramClientInitPromise = null;
    if (globalTelegramClient) {
        try { await globalTelegramClient.disconnect(); } catch(e){}
        globalTelegramClient = null;
    }
}

function publicTelegramError(err) {
    const code = err?.errorMessage || err?.message || String(err);
    if (String(code).includes('PHONE_NUMBER_INVALID')) {
        return 'Telegram rejected the phone number. Use the exact Telegram account number in international format, example +324XXXXXXXX.';
    }
    if (String(code).includes('PHONE_CODE_INVALID')) {
        return 'Telegram code is invalid. Check the latest code and try again.';
    }
    if (String(code).includes('PHONE_CODE_EXPIRED')) {
        return 'Telegram code expired. Click Send Code again.';
    }
    if (String(code).includes('TIMEOUT')) {
        return 'Telegram connection timed out. Try Send Code again; if it repeats, check network/VPN.';
    }
    return err?.message || code;
}

async function validateTelegramSessionLive(state = telegramApiState()) {
    if (!state.enabled || !state.checks.apiId || !state.checks.apiHash) {
        return { ...state, live: false };
    }
    if (state.checks.botToken && !state.checks.session) {
        return { ...state, live: true, ready: true, validation: 'bot_token' };
    }
    if (!state.checks.session) {
        return { ...state, live: false, ready: false, validation: 'missing_session' };
    }

    const { apiId, apiHash } = parseTelegramApiCredentials();
    const savedSession = fs.readFileSync(TELEGRAM_SESSION_FILE, 'utf-8').trim();
    const client = createTelegramClient(new StringSession(savedSession), apiId, apiHash);
    try {
        await client.connect();
        const authorized = await client.checkAuthorization();
        if (!authorized) {
            return { ...state, live: true, ready: false, validation: 'unauthorized_session' };
        }
        const me = await client.getMe();
        return {
            ...state,
            live: true,
            ready: true,
            validation: 'authorized_session',
            self: {
                id: me?.id ? String(me.id) : null,
                username: me?.username || null,
                firstName: me?.firstName || null
            }
        };
    } finally {
        await client.disconnect();
    }
}

function dirStats(dir) {
    if (!fs.existsSync(dir)) {
        return { path: dir, name: path.basename(dir), exists: false, files: 0, bytes: 0, updatedAt: null };
    }

    let files = 0;
    let bytes = 0;
    let newest = 0;
    const stack = [dir];
    while (stack.length) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            const stat = fs.statSync(full);
            if (entry.isDirectory()) {
                stack.push(full);
            } else {
                files++;
                bytes += stat.size;
                newest = Math.max(newest, stat.mtimeMs);
            }
        }
    }

    return {
        path: dir,
        name: path.basename(dir),
        exists: true,
        files,
        bytes,
        updatedAt: newest ? new Date(newest).toISOString() : null
    };
}

function cacheTargetStats() {
    return CACHE_TARGETS.map(dirStats);
}

function publicCacheState() {
    const targets = cacheTargetStats();
    const totalBytes = targets.reduce((sum, item) => sum + item.bytes, 0);
    return {
        enabled: config.autoCacheCleaner,
        maxMb: config.cacheMaxMb,
        totalBytes,
        totalMb: Math.round(totalBytes / 1024 / 1024 * 10) / 10,
        targets: targets.map(item => ({
            name: item.path.replace(BROWSER_SESSION_DIR + path.sep, ''),
            exists: item.exists,
            files: item.files,
            bytes: item.bytes
        })),
        safePolicy: 'Cache folders only. Cookies, local storage, IndexedDB, and auth files are preserved.'
    };
}

function ensureInsideBrowserSession(target) {
    const root = path.resolve(BROWSER_SESSION_DIR) + path.sep;
    const resolved = path.resolve(target);
    if (!resolved.startsWith(root)) {
        throw new Error(`Refusing to clean outside browser_session: ${resolved}`);
    }
}

function cleanBrowserCache(reason = 'manual') {
    const before = publicCacheState();
    const errors = [];

    for (const target of CACHE_TARGETS) {
        try {
            ensureInsideBrowserSession(target);
            if (fs.existsSync(target)) {
                fs.rmSync(target, { recursive: true, force: true });
            }
            fs.mkdirSync(target, { recursive: true });
        } catch (err) {
            errors.push({ target: path.basename(target), message: err.message });
        }
    }

    const after = publicCacheState();
    const result = {
        reason,
        before,
        after,
        freedBytes: Math.max(0, before.totalBytes - after.totalBytes),
        freedMb: Math.max(0, Math.round((before.totalBytes - after.totalBytes) / 1024 / 1024 * 10) / 10),
        errors,
        cleanedAt: new Date().toISOString()
    };
    io.emit('cacheState', after);
    io.emit('status', errors.length
        ? { type: 'warning', message: `Cache cleaner finished with ${errors.length} warning(s). Freed ${result.freedMb} MB.` }
        : { type: 'success', message: `Cache cleaner OK. Freed ${result.freedMb} MB.` });
    return result;
}

function publicSessionState() {
    const dirs = SESSION_DIRS.map(dirStats);
    return {
        mode: config.browserSessionMode,
        dirs,
        totalFiles: dirs.reduce((sum, item) => sum + item.files, 0),
        totalBytes: dirs.reduce((sum, item) => sum + item.bytes, 0),
        cache: publicCacheState(),
        safePolicy: 'Local reset only. No cookie injection or generated browser identity.'
    };
}

function resetBrowserSessions(reason = 'manual') {
    fs.mkdirSync(SESSION_BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupRoot = path.join(SESSION_BACKUP_DIR, stamp);
    fs.mkdirSync(backupRoot, { recursive: true });

    const moved = [];
    for (const dir of SESSION_DIRS) {
        fs.mkdirSync(path.dirname(dir), { recursive: true });
        if (fs.existsSync(dir)) {
            const stat = dirStats(dir);
            const backupTarget = path.join(backupRoot, path.basename(dir));
            fs.renameSync(dir, backupTarget);
            moved.push({ name: path.basename(dir), files: stat.files, bytes: stat.bytes, backup: backupTarget });
        }
        fs.mkdirSync(dir, { recursive: true });
    }

    const result = { reason, backupRoot, moved, resetAt: new Date().toISOString(), state: publicSessionState() };
    io.emit('browserSession', result.state);
    io.emit('status', { type: 'success', message: `Browser session reset complete. Backup: ${path.basename(backupRoot)}` });
    return result;
}

function estimateThroughput(settings) {
    const avgDelayMs = (settings.minDelayMs + settings.maxDelayMs) / 2;
    const avgCycleMs = ESTIMATED_NETWORK_MS + avgDelayMs;
    const resultsPerMinute = Math.max(1, Math.floor(settings.concurrentChecks * 60000 / avgCycleMs));
    const batchMinutes = Math.max(1, Math.ceil(settings.batchSize / resultsPerMinute));
    return {
        estimatedNetworkMs: ESTIMATED_NETWORK_MS,
        avgDelayMs: Math.round(avgDelayMs),
        avgCycleMs: Math.round(avgCycleMs),
        resultsPerMinute,
        batchMinutes
    };
}

function speedOptions() {
    return Object.fromEntries(Object.entries(SPEED_PRESETS).map(([key, preset]) => [
        key,
        {
            ...preset,
            estimate: estimateThroughput({ ...config, ...preset })
        }
    ]));
}

function listInputFiles() {
    try {
        return fs.readdirSync(basePath, { withFileTypes: true })
            .filter(entry => entry.isFile() && /\.(txt|csv)$/i.test(entry.name))
            .map(entry => {
                const fullPath = path.join(basePath, entry.name);
                const stat = fs.statSync(fullPath);
                return {
                    name: entry.name,
                    path: fullPath,
                    size: stat.size,
                    updatedAt: stat.mtime.toISOString()
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
        console.error('[WARN] Failed to list input files:', err.message);
        return [];
    }
}

function loadSavedConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            config = cleanConfigPatch(saved);
        }
    } catch (err) {
        console.error('[WARN] Failed to load settings.json:', err.message);
    }
}

function saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function loadResumeState() {
    try {
        if (!fs.existsSync(RESUME_FILE)) return null;
        const saved = JSON.parse(fs.readFileSync(RESUME_FILE, 'utf-8'));
        if (!Array.isArray(saved.remaining) || saved.remaining.length === 0) return null;
        return saved;
    } catch (err) {
        console.error('[WARN] Failed to load resume_state.json:', err.message);
        return null;
    }
}

function saveResumeState(state, emit = true) {
    resumeState = state && state.remaining?.length ? state : null;
    if (resumeState) {
        fs.writeFileSync(RESUME_FILE, JSON.stringify(resumeState, null, 2), 'utf-8');
    } else if (fs.existsSync(RESUME_FILE)) {
        fs.unlinkSync(RESUME_FILE);
    }
    if (emit) io.emit('resume', publicResumeState());
}

function publicResumeState() {
    return {
        available: !!(resumeState && resumeState.remaining?.length),
        mode: resumeState?.mode || null,
        remaining: resumeState?.remaining?.length || 0,
        total: resumeState?.stats?.total || 0,
        checked: resumeState?.stats?.checked || 0,
        stoppedAt: resumeState?.stoppedAt || null
    };
}

function loadIndustrialCursor(filePath) {
    try {
        if (!fs.existsSync(INDUSTRIAL_CURSOR_FILE)) return { filePath, offset: 0 };
        const cursor = JSON.parse(fs.readFileSync(INDUSTRIAL_CURSOR_FILE, 'utf-8'));
        if (cursor.filePath !== filePath) return { filePath, offset: 0 };
        if (!fs.existsSync(filePath)) return { filePath, offset: 0 };
        const size = fs.statSync(filePath).size;
        return { filePath, offset: Math.min(cursor.offset || 0, size) };
    } catch (err) {
        console.error('[WARN] Failed to load industrial cursor:', err.message);
        return { filePath, offset: 0 };
    }
}

function saveIndustrialCursor(filePath, offset) {
    fs.writeFileSync(INDUSTRIAL_CURSOR_FILE, JSON.stringify({
        filePath,
        offset,
        updatedAt: new Date().toISOString()
    }, null, 2), 'utf-8');
}

function publicConfig() {
    return {
        ...config,
        mode: 'WA Scraper + Business Account signals',
        network: 'Tor with automatic IP rotation',
        speedOptions: speedOptions(),
        speedEstimate: estimateThroughput(config),
        maxStableResultsPerMinute: estimateThroughput({ ...config, ...SPEED_PRESETS.maxStable }).resultsPerMinute,
        outputs: {
            whatsapp: path.basename(VALID_WAME_VCF),
            telegram: path.basename(VALID_TME_VCF)
        },
        telegramLinkPolicy: 'No Telegram number is marked valid unless a real Telegram verification signal exists.',
        telegramApi: telegramApiState(),
        industrialInputAvailable: fs.existsSync(config.industrialInputFile),
        inputFiles: listInputFiles(),
        browserSession: publicSessionState(),
        cacheState: publicCacheState(),
        licenseState: getLicenseState()
    };
}

loadSavedConfig();
resumeState = loadResumeState();

// ── Tor Management ───────────────────────────────────────────────
function launchTor() {
    console.log('[*] Starting Open Source VPN (Tor)...');
    const torPath = path.join(basePath, 'tor', 'tor.exe');
    const torrcPath = path.join(basePath, 'torrc');
    
    try {
        require('child_process').execSync('powershell -Command "Get-Process -Name tor -ErrorAction SilentlyContinue | Stop-Process -Force"', { windowsHide: true });
    } catch (e) {}
    
    torProcess = spawn(torPath, ['-f', torrcPath], { windowsHide: true });
    
    torProcess.stdout.on('data', (data) => {
        const line = data.toString().trim();
        console.log(`[Tor Log] ${line}`);
        if (line.includes('Bootstrapped 100%')) {
            console.log('[+] Tor Network Connection Established! Open Source VPN is Active.');
            isTorReady = true;
            io.emit('status', { type: 'success', message: 'VPN connecte. Pret pour le traitement.' });
        }
    });

    torProcess.stderr.on('data', () => {});

    torProcess.on('close', (code) => {
        console.log(`[!] Tor exited with code ${code}`);
        isTorReady = false;
    });
}

function rotateTorIP(force = false) {
    if (!isTorReady || rotationInProgress) return false;
    if (!force && Date.now() - lastRotationAt < MIN_MANUAL_ROTATION_GAP_MS) return false;
    lastRotationAt = Date.now();
    rotationInProgress = true;
    console.log('[*] ROTATION TRIGGERED: Requesting new Tor IP...');
    io.emit('status', { type: 'info', message: 'Rotation IP VPN en cours.' });
    
    const client = net.connect({ port: 9051, host: '127.0.0.1' }, () => {
        client.write('AUTHENTICATE ""\r\n');
        client.write('SIGNAL NEWNYM\r\n');
        client.write('QUIT\r\n');
    });

    client.on('data', (data) => {
        if (data.toString().includes('250 OK')) {
            console.log('[+] IP Rotated successfully.');
            io.emit('status', { type: 'success', message: 'IP VPN remplacee.' });
        }
    });

    client.on('error', (err) => {
        console.error('[ERR] Failed to rotate IP:', err.message);
    });

    client.on('close', () => {
        rotationInProgress = false;
    });

    return true;
}

setInterval(() => {
    if (!isChecking) return;
    if (Date.now() - lastRotationAt < config.rotationIntervalMs) return;
    rotateTorIP();
}, 1000);

setInterval(() => {
    if (!config.autoCacheCleaner) return;
    const state = publicCacheState();
    if (state.totalMb < config.cacheMaxMb) return;
    cleanBrowserCache('auto-threshold');
}, CACHE_CLEAN_INTERVAL_MS);

function normalizeNumber(raw) {
    let c = raw.replace(/[^\d+]/g, '');
    if (c.startsWith('+')) c = c.slice(1);
    if (c.startsWith('00')) c = c.slice(2);
    return c;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomSleep() { return sleep(Math.floor(Math.random() * (config.maxDelayMs - config.minDelayMs + 1) + config.minDelayMs)); }
function resetStats(total = 0) {
    stats = { total, checked: 0, valid: 0, invalid: 0, telegramValid: 0, errors: 0 };
    io.emit('stats', stats);
}

function normalizeStats(value = stats) {
    return {
        total: value.total || 0,
        checked: value.checked || 0,
        valid: value.valid || 0,
        invalid: value.invalid || 0,
        telegramValid: value.telegramValid || 0,
        errors: value.errors || 0
    };
}

function appendToFile(f, line) {
    // No separate invalid output file: the user requested only WhatsApp and Telegram outputs.
}
function appendToVCF(f, number) {
    if (!checkLicenseValid()) return;
    appendLinkVCF(validWameStream, '', number, '');
}

function waLink(number) {
    return '';
}

function telegramLink(number) {
    return '';
}

function vcfText(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

function appendLinkVCF(stream, label, number, url) {
    if (!checkLicenseValid()) return;
    // Strict format: Numbers only in both FN and TEL. No labels, no URLs.
    stream.write([
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:+${number}`,
        `TEL;TYPE=CELL:+${number}`,
        'END:VCARD',
        ''
    ].join('\n'));
}

async function appendValidDirectLinkVCFs(number, whatsappStatus = 'valid') {
    if (whatsappStatus !== 'valid') return { wa: false, tme: false };
    if (checkLicenseValid()) {
        appendLinkVCF(validWameStream, '', number, '');
    }
    if (!config.telegramLinksEnabled) return { wa: true, tme: false };

    const telegramState = telegramApiState();
    if (config.telegramApiEnabled && telegramState.ready) {
        const connected = await initGlobalTelegramClient();
        if (!connected || !globalTelegramClient) return { wa: true, tme: false };
        if (!telegramApiWarningSent) {
            telegramApiWarningSent = true;
            io.emit('status', { type: 'warning', message: 'Telegram session OK, validation API activee.' });
        }
        return { wa: true, tme: false };
    }

    if (config.telegramApiEnabled && !telegramApiWarningSent) {
        telegramApiWarningSent = true;
        const missing = telegramState.missing?.length ? telegramState.missing.join(', ') : 'session';
        io.emit('status', { type: 'warning', message: `Telegram API non activee (${missing}). Verification Telegram ignoree, verification WhatsApp conservee.` });
        return { wa: true, tme: false };
    }


    return { wa: true, tme: false };
}

// ── wa.me HTTP Checker (Business Account Detection) ──────────────
// IMPORTANT: wa.me only reveals Business Accounts reliably.
// Personal accounts look identical to non-existent numbers.
// The only signal: business accounts have og:title with custom name
// and description="Business Account" in meta tags.
function checkOfflineMethod(number, redirectUrl = null) {
    return new Promise((resolve) => {
        const url = redirectUrl || `https://wa.me/${number}`;
        const options = {
            agent: torAgent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive'
            }
        };

        const req = https.get(url, options, (res) => {
            if (res.statusCode === 429) {
                resolve('rate_limit');
                return;
            }

            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(checkOfflineMethod(number, res.headers.location));
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const html = data.toLowerCase();
                
                // Business account signals (reliable)
                const isBusiness = html.includes('business account') || html.includes('action__viewm');
                
                // Custom og:title means it's a real account with a profile name
                const ogTitleMatch = data.match(/property="og:title"\s+content="([^"]+)"/i);
                const ogTitle = ogTitleMatch ? ogTitleMatch[1] : '';
                const hasCustomTitle = ogTitle && ogTitle !== 'Share on WhatsApp' && ogTitle !== '';
                
                if (isBusiness || hasCustomTitle) {
                    resolve('valid');
                } else {
                    resolve('invalid');
                }
            });
        });

        req.on('error', (err) => resolve('error'));
        req.setTimeout(12000, () => {
            req.abort();
            resolve('error');
        });
    });
}

// ── Batch Process Engine ────────────────────────────────────────
async function processBatch(numbers, mode = 'manual') {
    const pendingQueue = [...numbers];
    const inFlight = new Set();
    const deferredQueue = [];
    activeSession = { mode, pendingQueue, inFlight, deferredQueue };

    function checkpointRemaining() {
        return [...inFlight, ...pendingQueue, ...deferredQueue];
    }

    async function worker() {
        while (pendingQueue.length > 0) {
            if (shouldStop) break;

            const number = pendingQueue.shift();
            inFlight.add(number);

            let success = false;
            let finalStatus = 'invalid';
            let transientRetries = 0;
            let deferNumber = false;
            while (!success && !shouldStop) {
                if (!isTorReady) {
                    await sleep(2000);
                    continue;
                }

                let result = await checkOfflineMethod(number);

                if (result === 'rate_limit' || result === 'error') {
                    transientRetries++;
                    const retryLabel = result === 'rate_limit' ? 'IP Blocked, waiting for rotation' : 'VPN Timeout';
                    io.emit('result', { number, status: 'retry', info: `${retryLabel} (${transientRetries}/${MAX_TRANSIENT_RETRIES})`, quiet: transientRetries < MAX_TRANSIENT_RETRIES });
                    
                    if (result === 'rate_limit') {
                        const rotated = rotateTorIP();
                        await sleep(rotated ? POST_ROTATION_SETTLE_MS : 5000);
                    } else if (result === 'error') {
                        const rotated = transientRetries >= 2 ? rotateTorIP() : false;
                        await sleep(rotated ? POST_ROTATION_SETTLE_MS : 3000); 
                    }

                    if (transientRetries >= MAX_TRANSIENT_RETRIES) {
                        deferNumber = true;
                        break;
                    }
                    continue; 
                }

                if (result === 'valid') {
                    stats.valid++;
                    const linkResult = await appendValidDirectLinkVCFs(number, 'valid');
                    success = true;
                    finalStatus = 'valid';
                } else if (result === 'invalid') {
                    stats.invalid++;
                    appendToFile(INVALID_FILE, number);
                    success = true;
                    finalStatus = 'invalid';
                }
            }

            inFlight.delete(number);

            if (success) {
                stats.checked++;
                io.emit('queue', {
                    mode,
                    remaining: checkpointRemaining().length,
                    removed: stats.checked,
                    autoRemoveProcessed: config.autoRemoveProcessed
                });
                if (stats.checked % 100 === 0) {
                    const remaining = checkpointRemaining();
                    if (remaining.length) saveResumeState(buildResumeState(mode, remaining), false);
                }
                io.emit('result', { number, status: finalStatus });
                io.emit('stats', stats);
            } else {
                if (deferNumber) {
                    deferredQueue.push(number);
                    saveResumeState(buildResumeState(mode, checkpointRemaining()), false);
                    io.emit('status', { type: 'warning', message: `VPN timeout persistant sur +${number}. Numero garde pour reprise.` });
                    io.emit('queue', {
                        mode,
                        remaining: checkpointRemaining().length,
                        removed: stats.checked,
                        autoRemoveProcessed: config.autoRemoveProcessed
                    });
                    continue;
                }
                pendingQueue.unshift(number);
                break;
            }

            await randomSleep(); 
        }
    }

    const workers = [];
    for (let i = 0; i < config.concurrentChecks; i++) {
        workers.push(worker());
    }
    await Promise.all(workers);

    const remaining = checkpointRemaining();
    activeSession = null;
    return { remaining };
}

// ── Industrial Auto-Runner ──────────────────────────────────────
async function extractChunk(filePath, chunkSize) {
    if (!fs.existsSync(filePath)) return { numbers: [], nextOffset: 0, eof: true };

    const cursor = loadIndustrialCursor(filePath);
    const fileSize = fs.statSync(filePath).size;
    if (cursor.offset >= fileSize) return { numbers: [], nextOffset: cursor.offset, eof: true };

    return new Promise((resolve, reject) => {
        const numbers = [];
        let buffer = '';
        let consumedBytes = 0;
        let settled = false;
        const stream = fs.createReadStream(filePath, {
            start: cursor.offset,
            encoding: 'utf8',
            highWaterMark: 1024 * 1024
        });

        function finish(eof = false) {
            if (settled) return;
            settled = true;
            stream.destroy();
            resolve({
                numbers,
                nextOffset: cursor.offset + consumedBytes,
                eof
            });
        }

        stream.on('data', (chunk) => {
            buffer += chunk;
            while (numbers.length < chunkSize) {
                const newlineIndex = buffer.indexOf('\n');
                if (newlineIndex === -1) break;

                const consumed = buffer.slice(0, newlineIndex + 1);
                const line = buffer.slice(0, newlineIndex).replace(/\r$/, '').trim();
                consumedBytes += Buffer.byteLength(consumed, 'utf8');
                buffer = buffer.slice(newlineIndex + 1);

                if (line) numbers.push(normalizeNumber(line));
            }

            if (numbers.length >= chunkSize) finish(false);
        });

        stream.on('end', () => {
            if (buffer.trim() && numbers.length < chunkSize) {
                consumedBytes += Buffer.byteLength(buffer, 'utf8');
                numbers.push(normalizeNumber(buffer.trim()));
            }
            finish(true);
        });

        stream.on('error', reject);
    });
}

function buildResumeState(mode, remaining) {
    return {
        mode,
        remaining: [...new Set(remaining.map(normalizeNumber).filter(n => n.length >= 7 && n.length <= 15))],
        stats: normalizeStats(stats),
        config: { ...config },
        stoppedAt: new Date().toISOString()
    };
}

function autoSaveOutputFiles(status = 'finished') {
    try {
        const outputDir = path.join(basePath, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
        const runFolder = path.join(outputDir, `run_${timestamp}_${status}`);
        fs.mkdirSync(runFolder, { recursive: true });

        const filesToSave = [
            { src: VALID_WAME_VCF, dest: 'output_whatsapp.vcf' },
            { src: VALID_TME_VCF, dest: 'output_telegram.vcf' }
        ];

        let filesCopied = 0;
        filesToSave.forEach(file => {
            if (fs.existsSync(file.src)) {
                const stat = fs.statSync(file.src);
                if (stat.size > 0) {
                    fs.copyFileSync(file.src, path.join(runFolder, file.dest));
                    filesCopied++;
                }
            }
        });

        if (filesCopied > 0) {
            const report = {
                timestamp: new Date().toISOString(),
                status: status,
                config: {
                    runMode: config.runMode,
                    speedPreset: config.speedPreset,
                    telegramApiEnabled: config.telegramApiEnabled,
                    telegramLinksEnabled: config.telegramLinksEnabled
                },
                stats: {
                    total: stats.total,
                    checked: stats.checked,
                    valid: stats.valid,
                    invalid: stats.invalid,
                    telegramValid: stats.telegramValid,
                    errors: stats.errors
                }
            };
            fs.writeFileSync(path.join(runFolder, 'report.json'), JSON.stringify(report, null, 2));
            console.log(`[+] Auto-saved outputs to ${runFolder}`);
            io.emit('status', { type: 'success', message: `Outputs auto-saved to output/run_${timestamp}_${status}/` });
        } else {
            try { fs.rmdirSync(runFolder); } catch (e) {}
        }
    } catch (err) {
        console.error('[ERR] Failed to auto-save outputs:', err);
    }
}

async function startIndustrialPipeline(resumeRemaining = null) {
    if (isChecking) return;
    if (!resumeRemaining && !fs.existsSync(config.industrialInputFile)) {
        console.log(`[WARN] Target file not found: ${config.industrialInputFile}`);
        io.emit('status', { type: 'error', message: `Industrial file not found: ${config.industrialInputFile}` });
        return;
    }

    if (!isTorReady) {
        console.log(`[!] Waiting for Tor VPN to connect before starting pipeline...`);
        while (!isTorReady) {
            await sleep(1000);
        }
    }

    isChecking = true;
    shouldStop = false;
    io.emit('checking', true);

    console.log(`\n[*] STARTING INDUSTRIAL PIPELINE...`);
    console.log(`[*] Target: ${config.industrialInputFile}`);
    console.log(`[*] Method: Scraper (Business Account detection)`);
    console.log(`[*] Removing Checked Numbers: ENABLED`);
    console.log(`[*] VCF Strike Package Output: ENABLED\n`);

    let resumedBatch = Array.isArray(resumeRemaining) ? resumeRemaining : null;

    while (!shouldStop) {
        let batch;
        if (resumedBatch) {
            batch = resumedBatch;
            resumedBatch = null;
            io.emit('status', { type: 'info', message: `Reprise du checkpoint: ${batch.length} numeros restants.` });
        } else {
            io.emit('status', { type: 'info', message: `Extraction de ${config.batchSize} numeros depuis le fichier industriel.` });
            console.log(`[+] Extracting next ${config.batchSize} numbers...`);
            const extracted = await extractChunk(config.industrialInputFile, config.batchSize);
            batch = extracted.numbers;
            saveIndustrialCursor(config.industrialInputFile, extracted.nextOffset);
            saveResumeState(buildResumeState('industrial', batch), false);
            stats.total += batch.length;
            io.emit('stats', stats);
        }

        if (batch.length === 0) {
            console.log(`[+] File is completely empty. Processing finished!`);
            io.emit('status', { type: 'success', message: 'Pipeline termine. Tous les numeros disponibles ont ete traites.' });
            break;
        }

        io.emit('status', { type: 'info', message: `Traitement du lot: ${batch.length} numeros.` });

        const result = await processBatch(batch, 'industrial');
        if (shouldStop && result.remaining.length) {
            saveResumeState(buildResumeState('industrial', result.remaining));
            io.emit('status', { type: 'warning', message: `Traitement arrete. Reprise disponible: ${result.remaining.length} numeros.` });
            break;
        }
        console.log(`[+] Batch done. Valid so far: ${stats.valid}`);
    }

    if (!shouldStop) {
        saveResumeState(null);
        autoSaveOutputFiles('finished');
    } else {
        autoSaveOutputFiles('stopped');
    }
    isChecking = false;
    await stopGlobalTelegramClient();
    io.emit('checking', false);
}

// ── API ─────────────────────────────────────────────────────────
app.get('/api/download/:type', (req, res) => {
    if (!checkLicenseValid()) {
        return res.status(403).send('Verification reserved by License Code. File outputs are locked. Please input a valid License Key.');
    }
    const file = req.params.type === 'valid' || req.params.type === 'whatsapp' || req.params.type === 'wame-vcf'
        ? VALID_WAME_VCF
        : req.params.type === 'tme-vcf' || req.params.type === 'telegram'
            ? VALID_TME_VCF
            : null;
    if (!file) return res.status(404).send('Only WhatsApp and Telegram output files are available.');
    if (!fs.existsSync(file)) return res.status(404).send('Not found');
    res.download(file);
});

app.get('/api/config', (req, res) => {
    res.json(publicConfig());
});

app.post('/api/vpn/rotate', (req, res) => {
    const rotated = rotateTorIP(true);
    if (rotated) {
        res.json({ success: true, message: 'IP rotation triggered.' });
    } else {
        res.status(429).json({ error: 'IP rotation already in progress or cooling down.' });
    }
});


app.post('/api/config', (req, res) => {
    if (isChecking) {
        return res.status(409).json({ error: 'Settings cannot be changed while a run is active.' });
    }
    config = cleanConfigPatch(req.body);
    saveConfig();
    io.emit('config', publicConfig());
    res.json(publicConfig());
});

app.post('/api/telegram/validate', async (req, res) => {
    const body = req.body || {};
    const hasConfigChange = typeof body.telegramApiFile === 'string' || typeof body.telegramApiEnabled === 'boolean';
    if (hasConfigChange && isChecking) {
        return res.status(409).json({ error: 'Telegram API settings cannot be changed while a run is active.' });
    }
    if (typeof body.telegramApiFile === 'string' && body.telegramApiFile.trim()) {
        config.telegramApiFile = body.telegramApiFile.trim();
    }
    if (typeof body.telegramApiEnabled === 'boolean') {
        config.telegramApiEnabled = body.telegramApiEnabled;
    }
    if (hasConfigChange) saveConfig();
    try {
        const state = await validateTelegramSessionLive(telegramApiState());
        io.emit('config', publicConfig());
        res.json(state);
    } catch (err) {
        console.error('[ERR] Telegram live validation failed:', err.message);
        const state = telegramApiState();
        res.status(500).json({ ...state, ready: false, live: false, validation: 'live_error', error: publicTelegramError(err) });
    }
});

app.post('/api/telegram/phone', (req, res) => {
    if (isChecking) {
        return res.status(409).json({ error: 'Telegram phone cannot be changed while a run is active.' });
    }
    const rawPhone = String(req.body?.phone || '').trim();
    const phone = rawPhone.replace(/[^\d+]/g, '');
    if (!/^\+\d{7,15}$/.test(phone)) {
        return res.status(400).json({ error: 'Phone must be international format, example: +324XXXXXXXX.' });
    }

    const apiFile = config.telegramApiFile || DEFAULT_TELEGRAM_API_FILE;
    try {
        let text = fs.existsSync(apiFile) ? fs.readFileSync(apiFile, 'utf-8') : '';
        if (/(?:phone|number|tel)\s*[:=]\s*\+?\d{7,15}/i.test(text)) {
            text = text.replace(/(?:phone|number|tel)\s*[:=]\s*\+?\d{7,15}/i, `phone=${phone}`);
        } else {
            const suffix = text.endsWith('\n') || text.length === 0 ? '' : '\n';
            text = `${text}${suffix}phone=${phone}\n`;
        }
        fs.writeFileSync(apiFile, text, 'utf-8');
        const state = telegramApiState();
        io.emit('config', publicConfig());
        res.json({ saved: true, maskedPhone: maskPhone(phone), telegramApi: state });
    } catch (err) {
        console.error('[ERR] Failed to save Telegram phone:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/telegram/session/start', (req, res) => {
    if (!fs.existsSync(config.telegramApiFile || DEFAULT_TELEGRAM_API_FILE)) {
        return res.status(404).json({ error: 'Telegram API file not found.' });
    }
    try {
        if (isPackaged) {
            spawn('cmd.exe', [
                '/c',
                `start cmd.exe /k ""${process.execPath}" --login"`
            ], {
                detached: true,
                stdio: 'ignore',
                windowsHide: false
            }).unref();
        } else {
            spawn('powershell.exe', [
                '-NoExit',
                '-Command',
                `Set-Location -LiteralPath ${JSON.stringify(basePath)}; npm.cmd run telegram:login`
            ], {
                cwd: basePath,
                detached: true,
                stdio: 'ignore',
                windowsHide: false
            }).unref();
        }
        res.json({ started: true, message: 'Telegram login window opened. Enter the code from Telegram there.' });
    } catch (err) {
        console.error('[ERR] Failed to start Telegram login:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/telegram/login/request-code', async (req, res) => {
    if (isChecking) {
        return res.status(409).json({ error: 'Telegram login cannot start while a run is active.' });
    }
    try {
        await closePendingTelegramLogin();
        const { apiId, apiHash, phone, botToken } = parseTelegramApiCredentials();
        const client = createTelegramClient(new StringSession(''), apiId, apiHash);
        await client.connect();

        if (botToken) {
            await client.invoke(new Api.auth.ImportBotAuthorization({
                apiId,
                apiHash,
                botAuthToken: botToken,
                flags: 0
            }));
            fs.writeFileSync(TELEGRAM_SESSION_FILE, client.session.save(), 'utf-8');
            await client.disconnect();
            pendingTelegramLogin = null;
            io.emit('config', publicConfig());
            return res.json({ ready: true, bot: true, message: 'Bot session saved.' });
        }

        const sent = await client.sendCode({ apiId, apiHash }, phone);
        pendingTelegramLogin = {
            client,
            apiId,
            apiHash,
            phone,
            phoneCodeHash: sent.phoneCodeHash,
            createdAt: Date.now()
        };
        res.json({
            codeRequested: true,
            isCodeViaApp: sent.isCodeViaApp === true,
            maskedPhone: maskPhone(phone),
            message: 'Telegram code sent. Enter it in the GUI.'
        });
    } catch (err) {
        await closePendingTelegramLogin();
        console.error('[ERR] Telegram code request failed:', err.message);
        res.status(500).json({ error: publicTelegramError(err) });
    }
});

app.post('/api/telegram/login/submit-code', async (req, res) => {
    if (!pendingTelegramLogin?.client) {
        return res.status(409).json({ error: 'No pending Telegram login. Click Send Code first.' });
    }
    try {
        const code = String(req.body?.code || '').replace(/\s+/g, '');
        const password = String(req.body?.password || '');
        if (!code && !pendingTelegramLogin.needsPassword) {
            return res.status(400).json({ error: 'Telegram code is required.' });
        }

        if (pendingTelegramLogin.needsPassword) {
            if (!password) return res.status(400).json({ error: 'Two-step password is required.' });
            const pwd = await pendingTelegramLogin.client.invoke(new Api.account.GetPassword());
            const passwordCheck = await computeCheck(pwd, password);
            await pendingTelegramLogin.client.invoke(new Api.auth.CheckPassword({ password: passwordCheck }));
        } else {
            await pendingTelegramLogin.client.invoke(new Api.auth.SignIn({
                phoneNumber: pendingTelegramLogin.phone,
                phoneCodeHash: pendingTelegramLogin.phoneCodeHash,
                phoneCode: code
            }));
        }

        fs.writeFileSync(TELEGRAM_SESSION_FILE, pendingTelegramLogin.client.session.save(), 'utf-8');
        await closePendingTelegramLogin();
        io.emit('config', publicConfig());
        res.json({ ready: true, message: 'Telegram session saved.' });
    } catch (err) {
        if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
            pendingTelegramLogin.needsPassword = true;
            return res.status(401).json({ needsPassword: true, error: 'Two-step password required.' });
        }
        console.error('[ERR] Telegram login submit failed:', err.message);
        res.status(500).json({ error: publicTelegramError(err) || 'Telegram login failed.' });
    }
});

app.get('/api/session', (req, res) => {
    res.json(publicSessionState());
});

app.get('/api/cache', (req, res) => {
    res.json(publicCacheState());
});

app.post('/api/cache/clean', (req, res) => {
    try {
        const result = cleanBrowserCache(req.body?.reason || 'manual');
        res.json(result);
    } catch (err) {
        console.error('[ERR] Cache cleaner failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/session/reset', (req, res) => {
    if (isChecking) {
        return res.status(409).json({ error: 'Browser session cannot be reset while a run is active.' });
    }
    try {
        const result = resetBrowserSessions(req.body?.reason || 'manual');
        res.json(result);
    } catch (err) {
        console.error('[ERR] Browser session reset failed:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Socket.IO ───────────────────────────────────────────────────
io.on('connection', (socket) => {
    socket.emit('checking', isChecking);
    socket.emit('stats', stats);
    socket.emit('config', publicConfig());
    socket.emit('resume', publicResumeState());
    socket.emit('browserSession', publicSessionState());
    socket.emit('cacheState', publicCacheState());

    socket.on('start', async (data) => {
        if (isChecking) return socket.emit('status', { type: 'warning', message: 'Already running.' });
        const requestedMode = data?.mode === 'industrial' ? 'industrial' : config.runMode;
        
        // Wipe active output files at start of a fresh batch run
        reopenOutputStreams(true);

        saveResumeState(null);
        telegramApiWarningSent = false;
        if (config.autoCacheCleaner && publicCacheState().totalMb >= config.cacheMaxMb) {
            cleanBrowserCache('run-start-threshold');
        }
        if (config.browserSessionMode === 'resetOnStart') {
            try {
                resetBrowserSessions('run-start');
            } catch (err) {
                return socket.emit('status', { type: 'error', message: `Browser session reset failed: ${err.message}` });
            }
        }
        if (requestedMode === 'industrial') {
            startIndustrialPipeline();
        } else {
            let numbers = [];
            if (data?.numbers?.length) {
                numbers = [...new Set(data.numbers.map(n => normalizeNumber(n)).filter(n => n.length >= 7 && n.length <= 15))];
            }
            if (!numbers.length) return socket.emit('status', { type: 'error', message: 'No numbers to check.' });

            if (!isTorReady) return socket.emit('status', { type: 'error', message: 'Tor VPN is still booting up...' });

            isChecking = true;
            shouldStop = false;
            resetStats(numbers.length);
            io.emit('checking', true);
            
            const result = await processBatch(numbers, 'manual');
            isChecking = false;
            await stopGlobalTelegramClient();
            io.emit('checking', false);
            if (shouldStop && result.remaining.length) {
                saveResumeState(buildResumeState('manual', result.remaining));
                autoSaveOutputFiles('stopped');
                io.emit('status', { type: 'warning', message: `Traitement arrete. Reprise disponible: ${result.remaining.length} numeros.` });
            } else {
                saveResumeState(null);
                autoSaveOutputFiles('finished');
                io.emit('status', { type: 'success', message: 'Checking finished. Downloads are ready.' });
            }
        }
    });

    socket.on('resume', async () => {
        if (isChecking) return socket.emit('status', { type: 'warning', message: 'Already running.' });
        if (!resumeState?.remaining?.length) return socket.emit('status', { type: 'warning', message: 'No checkpoint to resume.' });

        const state = resumeState;
        stats = normalizeStats(state.stats);
        io.emit('stats', stats);
        shouldStop = false;

        if (state.mode === 'industrial') {
            startIndustrialPipeline(state.remaining);
            return;
        }

        if (!isTorReady) return socket.emit('status', { type: 'error', message: 'Tor VPN is still booting up...' });

        isChecking = true;
        io.emit('checking', true);
        io.emit('status', { type: 'info', message: `Reprise du checkpoint: ${state.remaining.length} numeros restants.` });
        
        const result = await processBatch(state.remaining, 'manual');
        isChecking = false;
        await stopGlobalTelegramClient();
        io.emit('checking', false);
        if (shouldStop && result.remaining.length) {
            saveResumeState(buildResumeState('manual', result.remaining));
            autoSaveOutputFiles('stopped');
            io.emit('status', { type: 'warning', message: `Traitement arrete. Reprise disponible: ${result.remaining.length} numeros.` });
        } else {
            saveResumeState(null);
            autoSaveOutputFiles('finished');
            io.emit('status', { type: 'success', message: 'Checking finished. Downloads are ready.' });
        }
    });

    connectedClientsCount++;
    if (autoShutdownTimer) {
        clearTimeout(autoShutdownTimer);
        autoShutdownTimer = null;
    }

    socket.on('disconnect', () => {
        connectedClientsCount--;
        if (connectedClientsCount <= 0) {
            planAutoShutdown();
        }
    });

    socket.on('stop', () => {
        shouldStop = true;
        if (activeSession) {
            const remaining = [...activeSession.inFlight, ...activeSession.pendingQueue, ...(activeSession.deferredQueue || [])];
            if (remaining.length) saveResumeState(buildResumeState(activeSession.mode, remaining));
        }
        io.emit('status', { type: 'warning', message: 'Arret demande. Checkpoint en cours.' });
    });
});

// ── Start ───────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`  WhatsApp Bulk Checker v10 - TOR VPN MODE`);
    console.log(`  Method: Scraper (no login)`);
    console.log(`  Dashboard: http://localhost:${PORT}`);
    console.log(`${'='.repeat(50)}\n`);
    
    launchTor();

    // Auto-open GUI window (Microsoft Edge in application wrapper mode)
    setTimeout(() => {
        const appUrl = `http://localhost:${PORT}`;
        const cmd = `start msedge --app=${appUrl}`;
        console.log(`[*] Launching native Windows 11 GUI: ${cmd}`);
        exec(cmd, (err) => {
            if (err) {
                console.error('[WARN] Failed to automatically launch Edge in app mode. Please open http://localhost:3000 manually.');
            }
        });
    }, 1500);

    setTimeout(() => {
        if (config.autoStartIndustrial && fs.existsSync(config.industrialInputFile)) {
            config.runMode = 'industrial';
            startIndustrialPipeline();
        }
    }, 2000);
});
