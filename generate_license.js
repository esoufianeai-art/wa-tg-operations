const crypto = require('crypto');

// The built-in cryptographic salt/secret keys used to sign the license keys offline.
// MUST MATCH the secret key and salt inside the server's checkLicenseValid function.
const SECRET_PASSPHRASE = 'JanusTesavekAntigravitySecuredEnginev10';
const SALT = 'WaOperationsCustomLicenceSalt';

function generateLicenseKey(expiresDateStr) {
    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresDateStr)) {
        console.error('Error: Please specify the expiration date in YYYY-MM-DD format.');
        process.exit(1);
    }
    
    // Test if the expiration date is a valid date
    const expiration = new Date(expiresDateStr);
    if (isNaN(expiration.getTime())) {
        console.error('Error: Invalid date specified.');
        process.exit(1);
    }
    
    try {
        const key = crypto.scryptSync(SECRET_PASSPHRASE, SALT, 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        
        const payload = JSON.stringify({
            expirationDate: expiresDateStr,
            tag: 'WA_OPERATIONS_LICENSE_V10'
        });
        
        let encrypted = cipher.update(payload, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Output license format: iv_hex.encrypted_hex
        const licenseKey = `${iv.toString('hex')}.${encrypted}`;
        console.log('\n=============================================================');
        console.log(` LICENSE KEY GENERATED FOR EXPIRATION: ${expiresDateStr}`);
        console.log('=============================================================');
        console.log(licenseKey);
        console.log('=============================================================\n');
    } catch (e) {
        console.error('Failed to generate license key:', e.message);
    }
}

// Read arguments
const args = process.argv.slice(2);
if (args.length < 1) {
    console.log('Usage: node generate_license.js <YYYY-MM-DD>');
    console.log('Example: node generate_license.js 2026-12-31');
    process.exit(0);
}

generateLicenseKey(args[0]);
