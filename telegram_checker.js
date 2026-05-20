const fs = require('fs');
const path = require('path');
const { Api, TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const API_FILE = path.join(__dirname, 'MY TELEGRAM API.txt');
const SESSION_FILE = path.join(__dirname, 'telegram_session.txt');
const INPUT_FILE = process.argv[2] || path.join(__dirname, 'test_numbers.txt'); // Pass file as argument
const OUTPUT_VCF = path.join(__dirname, 'valid_telegram.vcf');
const DELAY_MS = 500; // Adjustable anti-ban delay between checks

function readTelegramApiFile() {
    if (!fs.existsSync(API_FILE)) {
        throw new Error(`Missing Telegram API file: ${API_FILE}`);
    }
    const text = fs.readFileSync(API_FILE, 'utf-8');
    const apiIdMatch = text.match(/(?:api|app)[_ -]?id\s*[:=]\s*(\d{4,12})/i) || text.match(/\b(\d{5,12})\b/);
    const apiHashMatch = text.match(/(?:api|app)[_ -]?hash\s*[:=]\s*([a-f0-9]{32})/i) || text.match(/\b([a-f0-9]{32})\b/i);

    const apiId = Number(apiIdMatch?.[1]);
    const apiHash = apiHashMatch?.[1];

    if (!apiId || !apiHash) {
        throw new Error('Telegram API file must contain api_id and api_hash.');
    }

    return { apiId, apiHash };
}

function appendToVcf(number) {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:TG Valid +${number}
TEL;TYPE=CELL:+${number}
URL:https://t.me/+${number}
END:VCARD
`;
    fs.appendFileSync(OUTPUT_VCF, vcard);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`[ERROR] Input file not found: ${INPUT_FILE}`);
        console.log(`Usage: node telegram_checker.js <numbers_list.txt>`);
        process.exit(1);
    }

    const { apiId, apiHash } = readTelegramApiFile();
    const savedSession = fs.existsSync(SESSION_FILE) ? fs.readFileSync(SESSION_FILE, 'utf-8').trim() : '';
    
    if (!savedSession) {
        console.error("[ERROR] No telegram_session.txt found! Please run 'npm run telegram:login' first.");
        process.exit(1);
    }

    const client = new TelegramClient(new StringSession(savedSession), apiId, apiHash, {
        connectionRetries: 5,
        requestRetries: 3,
        timeout: 20,
        // Uncomment the lines below to route MTProto through Tor if you run into IP bans:
        /*
        proxy: {
            ip: "127.0.0.1",
            port: 9050,
            socksType: 5,
        }
        */
    });

    console.log("[*] Connecting to Telegram MTProto API...");
    await client.connect();
    console.log("[+] Connected successfully!");

    const numbers = fs.readFileSync(INPUT_FILE, 'utf-8')
        .split('\n')
        .map(line => {
            let c = line.replace(/[^\d+]/g, '');
            if (c.startsWith('+')) c = c.slice(1);
            if (c.startsWith('00')) c = c.slice(2);
            return c;
        })
        .filter(n => n.length >= 7 && n.length <= 15);

    console.log(`[*] Loaded ${numbers.length} numbers to check.`);
    console.log(`[*] Valid numbers will be saved to: ${OUTPUT_VCF}`);

    for (let i = 0; i < numbers.length; i++) {
        const number = numbers[i];
        try {
            // Use ResolvePhone API to check if the number is registered on Telegram
            const result = await client.invoke(new Api.contacts.ResolvePhone({
                phone: number
            }));

            if (result && result.users && result.users.length > 0) {
                console.log(`[+] VALID (${i + 1}/${numbers.length}): +${number} has a Telegram account!`);
                appendToVcf(number);
            } else {
                console.log(`[-] INVALID (${i + 1}/${numbers.length}): +${number} has no account.`);
            }

        } catch (err) {
            const errStr = (err.errorMessage || err.message || '').toUpperCase();
            if (errStr.includes('PHONE_NOT_OCCUPIED')) {
                console.log(`[-] INVALID (${i + 1}/${numbers.length}): +${number} has no account (not occupied).`);
            } else if (errStr.includes('PHONE_NUMBER_INVALID')) {
                console.log(`[-] INVALID (${i + 1}/${numbers.length}): +${number} is an invalid phone number.`);
            } else if (err.seconds || errStr.includes('FLOOD')) {
                let waitTime = err.seconds;
                if (!waitTime) {
                    const match = errStr.match(/\d+/);
                    waitTime = match ? parseInt(match[0], 10) : 30;
                }
                console.warn(`[!] RATE LIMIT: Sleeping for ${waitTime} seconds...`);
                await sleep(waitTime * 1000);
                i--; // Retry this number
                continue;
            } else {
                console.error(`[!] ERROR (${i + 1}/${numbers.length}): +${number} - ${err.message || err}`);
            }
        }

        // Anti-ban delay (important for MTProto bulk checking)
        await sleep(DELAY_MS); 
    }

    console.log("[*] Finished checking all numbers.");
    await client.disconnect();
}

main().catch(console.error);
