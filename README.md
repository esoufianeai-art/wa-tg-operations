<p align="center">
  <img src="banner.png" alt="WA + TG Operations" width="100%">
</p>

<h1 align="center">WA + TG Operations</h1>

<p align="center">
  <b>Industrial-Grade WhatsApp & Telegram Number Verification Engine</b><br>
  <sub>High-speed bulk validation · Tor VPN rotation · Real-time dashboard · License-protected</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.0.0-cyan?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-Proprietary-red?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/platform-Windows-blue?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/node-%3E%3D22.0-green?style=for-the-badge" alt="Node">
</p>

---

## ⚡ What Is This?

**WA + TG Operations** is a professional-grade number verification tool that checks phone numbers against WhatsApp and Telegram at industrial scale. It features a real-time SaaS-style dashboard, built-in Tor VPN rotation, automatic batching, and exports results as ready-to-use VCF contact files.

> ⚠️ **This is commercial software.** A valid license key is required to unlock full functionality (VCF export). See [Licensing](#-licensing) below.

---

## 🖥️ Dashboard Preview

<p align="center">
  <img src="ui-ableton-style-preview.png" alt="Dashboard Preview" width="90%">
</p>

---

## 🚀 Key Features

| Feature | Description |
|---|---|
| **Dual Verification** | WhatsApp (browser scraping) + Telegram (API validation) in one pipeline |
| **Industrial Mode** | Process 100K+ numbers from file with auto-batching & cursor resume |
| **Tor VPN Rotation** | Built-in SOCKS5 proxy with configurable auto-rotation intervals |
| **Speed Presets** | Quality, Balanced, Fast, Max Stable, Custom — with real-time speed metrics |
| **Smart Scroll** | Toggle auto-scroll in the live Events log panel |
| **Auto Country Detect** | Automatically identifies the dominant country prefix from loaded numbers |
| **VCF Export** | Generates ready-to-import vCard files for WhatsApp-valid & Telegram-verified numbers |
| **Session Persistence** | Browser session backup/restore for stable long-running operations |
| **Real-time Dashboard** | Live fader meters, queue stats, pipeline visualization, error tracking |
| **License Protection** | AES-256-CBC encrypted license keys with configurable expiration |
| **Silent Execution** | Compiled single executable with GUI subsystem — no console window |
| **Obfuscated Build** | Source protection via javascript-obfuscator + V8 bytecode compilation |

---

## 📋 Requirements

- **OS:** Windows 10/11 (64-bit)
- **Node.js:** v22.0.0 or later
- **Tor:** Included in the `tor/` directory (auto-configured)
- **Telegram API:** Optional — requires API credentials from [my.telegram.org](https://my.telegram.org)
- **License Key:** Required for VCF export. Contact seller for purchase.

---

## 📦 Installation

### From Source (Development)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/wa-tg-operations.git
cd wa-tg-operations

# Install dependencies
npm install

# Copy example configuration files
copy settings.example.json settings.json
copy "MY TELEGRAM API.example.txt" "MY TELEGRAM API.txt"

# Edit settings.json and add your license key
# Edit "MY TELEGRAM API.txt" with your Telegram API credentials (optional)

# Download and extract Tor for Windows into the tor/ directory
# Create a torrc file with: SocksPort 9050

# Start the application
npm start
```

### Pre-Built Release (Recommended for Users)

1. Download the latest release from the [Releases](../../releases) page
2. Extract the ZIP to any folder
3. Edit `settings.json` and paste your **license key**
4. *(Optional)* Edit `MY TELEGRAM API.txt` with your Telegram API credentials
5. Double-click **`WhatsApp Bulk Checker.vbs`** to start silently
6. Open your browser to **http://localhost:3000**

---

## 🔑 Licensing

This software requires a valid license key to unlock VCF export functionality.

### License Tiers

| Tier | Duration | Description |
|---|---|---|
| **Trial** | 1 hour | Quick evaluation — full features, limited time |
| **Daily** | 24 hours | Day-pass for short campaigns |
| **Monthly** | 30 days | Standard commercial license |
| **Custom** | Negotiable | Enterprise deployments, bulk orders |

### Activating Your License

1. Open `settings.json` in any text editor
2. Paste your license key into the `"licenseKey"` field:
   ```json
   {
     "licenseKey": "YOUR_LICENSE_KEY_HERE"
   }
   ```
3. Restart the application — the dashboard will confirm activation

> License keys are cryptographically signed with AES-256-CBC encryption and cannot be forged or extended.

**To purchase a license**, contact the repository owner via the links provided.

---

## ⚙️ Configuration

All settings are managed via `settings.json`. Key options:

```jsonc
{
  "runMode": "manual",           // "manual" or "industrial"
  "speedPreset": "balanced",     // "quality" | "balanced" | "fast" | "maxStable" | "custom"
  "concurrentChecks": 10,        // Parallel workers (1-100)
  "minDelayMs": 500,             // Minimum delay between checks (ms)
  "maxDelayMs": 1500,            // Maximum delay between checks (ms)
  "rotationIntervalMs": 30000,   // Tor IP rotation interval (ms)
  "batchSize": 5000,             // Numbers per industrial batch
  "telegramApiEnabled": false,   // Enable dual WA+TG verification
  "autoRemoveProcessed": true,   // Auto-clean processed numbers from source
  "licenseKey": ""               // Your license key
}
```

### Telegram API Setup (Optional)

For dual WA + TG verification:

1. Go to [my.telegram.org](https://my.telegram.org) and create an application
2. Copy your `api_id` and `api_hash`
3. Edit `MY TELEGRAM API.txt`:
   ```
   App api_id:
   12345678
   App api_hash:
   your_api_hash_here
   phone=+1234567890
   ```
4. In the dashboard, click **Send Code** → enter the Telegram verification code → **Save Session**

---

## 🛠️ Building from Source

To compile the protected single executable:

```bash
# Build the obfuscated, bytecode-compiled executable
node build.js
```

This produces:
- `build/checker.exe` — Single executable (SEA) with GUI subsystem patch
- `build/WhatsApp Bulk Checker.vbs` — Silent VBS launcher (no console window)
- `build/public/` — Dashboard assets
- `build/tor/` — Tor binary and config

---

## 📁 Project Structure

```
wa-tg-operations/
├── server.js              # Main backend engine
├── telegram_login.js      # Telegram session authentication
├── generate_license.js    # License key generator (ADMIN ONLY)
├── build.js               # Build pipeline (esbuild → obfuscator → bytenode → SEA)
├── package.json           # Dependencies
├── settings.example.json  # Default configuration template
├── MY TELEGRAM API.example.txt  # Telegram API credentials template
├── START.bat              # Development launcher
├── public/
│   └── index.html         # Full SaaS dashboard (single-file)
├── tor/                   # Tor binary (not included in repo)
├── data/
│   └── geoip*             # GeoIP databases for Tor
└── build/                 # Compiled output (not included in repo)
```

---

## ⚠️ Disclaimer

This software is provided for **legitimate business use only**, such as marketing list verification and contact validation. The user is solely responsible for compliance with all applicable laws and platform terms of service in their jurisdiction. The developers assume no liability for misuse.

---

## 📄 License

**Proprietary** — All rights reserved. See [LICENSE](LICENSE) for details.

Unauthorized copying, modification, or distribution is strictly prohibited.

---

<p align="center">
  <sub>Built with Node.js · Socket.IO · Tor · Baileys · Telegram MTProto</sub><br>
  <sub>© 2026 WA + TG Operations</sub>
</p>
