const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const isPackaged = !path.basename(process.execPath).toLowerCase().startsWith('node');
const basePath = isPackaged ? path.dirname(process.execPath) : __dirname;

const API_FILE = path.join(basePath, 'MY TELEGRAM API.txt');
const SESSION_FILE = path.join(basePath, 'telegram_session.txt');

function readTelegramApiFile() {
    if (!fs.existsSync(API_FILE)) {
        throw new Error(`Missing Telegram API file: ${API_FILE}`);
    }
    const text = fs.readFileSync(API_FILE, 'utf-8');
    const apiIdMatch = text.match(/(?:api|app)[_ -]?id\s*[:=]\s*(\d{4,12})/i) || text.match(/\b(\d{5,12})\b/);
    const apiHashMatch = text.match(/(?:api|app)[_ -]?hash\s*[:=]\s*([a-f0-9]{32})/i) || text.match(/\b([a-f0-9]{32})\b/i);
    const phoneMatch = text.match(/(?:phone|number|tel)\s*[:=]\s*(\+?\d{7,15})/i);

    const apiId = Number(apiIdMatch?.[1]);
    const apiHash = apiHashMatch?.[1];
    const phone = phoneMatch?.[1] || null;

    if (!apiId || !apiHash) {
        throw new Error('Telegram API file must contain api_id and api_hash.');
    }
    if (!phone) {
        throw new Error('Telegram user login requires phone=+XXXXXXXX in MY TELEGRAM API.txt.');
    }

    return { apiId, apiHash, phone };
}

async function main() {
    const { apiId, apiHash, phone } = readTelegramApiFile();
    const savedSession = fs.existsSync(SESSION_FILE) ? fs.readFileSync(SESSION_FILE, 'utf-8').trim() : '';
    const client = new TelegramClient(new StringSession(savedSession), apiId, apiHash, {
        connectionRetries: 5,
        requestRetries: 3,
        timeout: 20,
        autoReconnect: false
    });
    client._loopStarted = true;
    const rl = readline.createInterface({ input, output });

    console.log('Telegram session activation');
    console.log(`Phone: ***${phone.replace(/\D/g, '').slice(-4)}`);
    console.log('Enter the login code sent by Telegram when requested.');

    await client.start({
        phoneNumber: async () => phone,
        password: async () => rl.question('Two-step password, if enabled: '),
        phoneCode: async () => rl.question('Telegram code: '),
        onError: (err) => console.error('Telegram login error:', err.message)
    });

    fs.writeFileSync(SESSION_FILE, client.session.save(), 'utf-8');
    rl.close();
    await client.disconnect();
    console.log(`Telegram session saved: ${SESSION_FILE}`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
