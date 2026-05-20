const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function runBuild() {
    console.log('[*] Starting build pipeline...');
    
    // Create folders
    fs.mkdirSync('dist', { recursive: true });
    fs.mkdirSync('build', { recursive: true });
    
    // 1. Bundle server.js and telegram_login.js using esbuild
    console.log('[*] Bundling source files using esbuild...');
    const esbuild = require('esbuild');
    
    await esbuild.build({
        entryPoints: ['server.js'],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        outfile: 'dist/server.bundled.js',
        external: ['telegram', 'socks-proxy-agent', 'express', 'socket.io', 'bytenode', 'readline/promises', 'readline']
    });
    
    await esbuild.build({
        entryPoints: ['telegram_login.js'],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        outfile: 'dist/telegram_login.bundled.js',
        external: ['telegram', 'bytenode', 'readline/promises', 'readline']
    });
    
    // 2. Obfuscate the bundled scripts
    console.log('[*] Obfuscating bundled scripts using javascript-obfuscator...');
    const JavaScriptObfuscator = require('javascript-obfuscator');
    
    const serverCode = fs.readFileSync('dist/server.bundled.js', 'utf8');
    const obfuscatedServer = JavaScriptObfuscator.obfuscate(serverCode, {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        renameGlobals: false,
        selfDefending: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75
    });
    fs.writeFileSync('dist/server.obfuscated.js', obfuscatedServer.getObfuscatedCode());
    
    const loginCode = fs.readFileSync('dist/telegram_login.bundled.js', 'utf8');
    const obfuscatedLogin = JavaScriptObfuscator.obfuscate(loginCode, {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        selfDefending: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75
    });
    fs.writeFileSync('dist/telegram_login.obfuscated.js', obfuscatedLogin.getObfuscatedCode());
    
    // 3. Compile obfuscated JS to V8 bytecode
    console.log('[*] Compiling obfuscated code to V8 bytecode using bytenode...');
    const bytenode = require('bytenode');
    
    bytenode.compileFile({
        filename: 'dist/server.obfuscated.js',
        output: 'build/server.jsc',
        compileAsModule: true
    });
    
    bytenode.compileFile({
        filename: 'dist/telegram_login.obfuscated.js',
        output: 'build/telegram_login.jsc',
        compileAsModule: true
    });
    
    // 4. Create launcher.js
    console.log('[*] Creating launcher.js...');
    const launcherCode = `
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const isPackaged = !path.basename(process.execPath).toLowerCase().startsWith('node');
const basePath = isPackaged ? path.dirname(process.execPath) : __dirname;

// Create a custom require function relative to the base directory
const diskRequire = createRequire(path.join(basePath, 'launcher.js'));

// Register bytenode (bundled in SEA)
require('bytenode');

if (process.argv.includes('--login')) {
    // Run the login bytecode
    diskRequire(path.join(basePath, 'telegram_login.jsc'));
} else {
    // Run the main app server bytecode
    diskRequire(path.join(basePath, 'server.jsc'));
}
`;
    fs.writeFileSync('dist/launcher.js', launcherCode);
    
    // 5. Bundle launcher.js with bytenode
    console.log('[*] Bundling launcher.js with esbuild...');
    await esbuild.build({
        entryPoints: ['dist/launcher.js'],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        outfile: 'dist/launcher.bundled.js',
        external: ['electron']
    });
    
    // 6. Generate sea-config.json
    console.log('[*] Generating sea-config.json...');
    const seaConfig = {
        main: 'dist/launcher.bundled.js',
        output: 'build/checker.exe'
    };
    fs.writeFileSync('sea-config.json', JSON.stringify(seaConfig, null, 2));
    
    // 7. Compile Single Executable application natively (Node 25.5.0+)
    console.log('[*] Compiling Single Executable Application using native node --build-sea...');
    execSync('node --build-sea sea-config.json', { stdio: 'inherit' });
    
    // Patch checker.exe to use GUI subsystem (Subsystem = 2) instead of Console subsystem (Subsystem = 3)
    // to prevent Windows from launching a background terminal console window when started.
    try {
        console.log('[*] Patching checker.exe to GUI subsystem to hide console window...');
        const exePath = 'build/checker.exe';
        const fd = fs.openSync(exePath, 'r+');
        const mzBuffer = Buffer.alloc(4);
        fs.readSync(fd, mzBuffer, 0, 4, 0x3C);
        const peOffset = mzBuffer.readUInt32LE(0);
        
        const peSigBuffer = Buffer.alloc(4);
        fs.readSync(fd, peSigBuffer, 0, 4, peOffset);
        if (peSigBuffer.toString('ascii') === 'PE\0\0') {
            const subsystemOffset = peOffset + 92;
            const subsystemBuffer = Buffer.alloc(2);
            subsystemBuffer.writeUInt16LE(2, 0); // 2 = IMAGE_SUBSYSTEM_WINDOWS_GUI
            fs.writeSync(fd, subsystemBuffer, 0, 2, subsystemOffset);
            console.log('[+] Successfully patched checker.exe to GUI Subsystem (Console window hidden).');
        } else {
            console.warn('[WARN] Could not patch PE subsystem: Invalid PE signature.');
        }
        fs.closeSync(fd);
    } catch (err) {
        console.error('[WARN] Failed to patch PE subsystem:', err.message);
    }
    
    // 8. Copy runtime assets to /build
    console.log('[*] Copying public, tor, torrc, settings, and node_modules to build/...');
    if (fs.existsSync('public')) {
        fs.cpSync('public', 'build/public', { recursive: true });
    }
    if (fs.existsSync('tor')) {
        fs.cpSync('tor', 'build/tor', { recursive: true });
    }
    if (fs.existsSync('torrc')) {
        fs.copyFileSync('torrc', 'build/torrc');
    }
    if (fs.existsSync('settings.json')) {
        fs.copyFileSync('settings.json', 'build/settings.json');
    }
    if (fs.existsSync('MY TELEGRAM API.txt')) {
        fs.copyFileSync('MY TELEGRAM API.txt', 'build/MY TELEGRAM API.txt');
    }
    if (fs.existsSync('node_modules')) {
        console.log('[*] Copying node_modules (this may take a minute)...');
        fs.cpSync('node_modules', 'build/node_modules', { recursive: true });
    }
    
    // Create silent VBScript launcher to run without a background console window
    console.log('[*] Generating silent Windows VBS Launcher...');
    const vbsCode = `Set objFSO = CreateObject("Scripting.FileSystemObject")
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = strPath
objShell.Run """checker.exe""", 0, False
`;
    fs.writeFileSync('build/WhatsApp Bulk Checker.vbs', vbsCode, 'utf-8');
    
    console.log('[+] Build completed successfully! Secure executable package is available in /build');
}

runBuild().catch(err => {
    console.error('[!] Build failed:', err);
    process.exit(1);
});
