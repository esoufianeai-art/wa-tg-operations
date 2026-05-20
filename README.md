<p align="center">
  <img src="banner.png" alt="WA + TG Operations" width="100%">
</p>

<h1 align="center">WA + TG Operations</h1>

<p align="center">
  <b>Industrial-Grade WhatsApp & Telegram Number Verification Engine</b><br>
  <sub>Verify thousands of numbers per hour · Built-in VPN rotation · VCF export · License-protected</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.0.0-cyan?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-Commercial-red?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-blue?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/status-Production%20Ready-brightgreen?style=for-the-badge" alt="Status">
</p>

---

## ⚡ What Is This?

**WA + TG Operations** is a professional number verification tool that checks phone numbers against **WhatsApp** and **Telegram** at industrial scale. It features a real-time dashboard, built-in Tor VPN rotation, automatic batching with resume, and exports results as ready-to-use **VCF contact files**.

> 💰 **This is commercial software.** A valid license key is required. See [Pricing](#-pricing) below.

---

## 🚀 Features

| Feature | Description |
|---|---|
| 🔍 **Dual Verification** | WhatsApp + Telegram checking in one pipeline |
| 🏭 **Industrial Mode** | Process **100,000+** numbers with auto-batching & resume |
| 🔒 **Built-in VPN** | Tor SOCKS5 proxy with automatic IP rotation |
| ⚡ **Speed Presets** | Quality · Balanced · Fast · Max Stable · Custom |
| 📊 **Live Dashboard** | Real-time meters, queue stats, error tracking |
| 📱 **VCF Export** | Ready-to-import contact files for WhatsApp & Telegram valid numbers |
| 🌍 **Auto Country Detect** | Automatically identifies country from number prefixes |
| 🔄 **Smart Scroll** | Toggle auto-scroll in live event logs |
| 💾 **Session Persistence** | Resume interrupted sessions without losing progress |
| 🖥️ **Silent Execution** | Runs in background — no console window |
| 🛡️ **Protected Binary** | Obfuscated + bytecode compiled executable |

---

## 🖥️ Dashboard

<p align="center">
  <img src="ui-ableton-style-preview.png" alt="Dashboard" width="90%">
</p>

---

## 📋 System Requirements

- **OS:** Windows 10 or Windows 11 (64-bit)
- **RAM:** 4 GB minimum
- **Internet:** Stable connection required
- **License Key:** Required — purchase below

---

## 📦 Download & Install

### Step 1 — Download
Go to the [**Releases**](../../releases) page and download the latest `.zip` file.

### Step 2 — Extract
Extract the ZIP to any folder on your computer.

### Step 3 — Configure
1. Open `settings.json` in any text editor
2. Paste your license key:
   ```json
   {
     "licenseKey": "PASTE_YOUR_KEY_HERE"
   }
   ```

### Step 4 — Launch
Double-click **`WhatsApp Bulk Checker.vbs`** to start silently, then open:
```
http://localhost:3000
```

### Optional — Telegram API
For dual WA + TG verification:
1. Get API credentials from [my.telegram.org](https://my.telegram.org)
2. Edit `MY TELEGRAM API.txt` with your `api_id`, `api_hash`, and phone
3. In the dashboard: **Send Code** → enter code → **Save Session**

---

## 💰 Pricing

| Plan | Duration | Price |
|---|---|---|
| ⏱️ **Trial** | 1 hour | Free (on request) |
| 📅 **Daily** | 24 hours | Contact seller |
| 📆 **Monthly** | 30 days | Contact seller |
| 🏢 **Custom** | Negotiable | Contact seller |

### How to Purchase

📩 **Contact:** DM the repository owner for pricing and license key delivery.

> License keys are cryptographically signed (AES-256-CBC) with built-in expiration. Keys cannot be forged, shared, or extended.

---

## ❓ FAQ

<details>
<summary><b>How fast is it?</b></summary>
With Max Stable preset and 30 threads: approximately <b>600 numbers/minute</b>. Speed depends on your internet connection and VPN rotation settings.
</details>

<details>
<summary><b>Is a VPN included?</b></summary>
Yes. Tor proxy is bundled — no extra VPN software needed. IP rotates automatically at configurable intervals.
</details>

<details>
<summary><b>Can I check Telegram too?</b></summary>
Yes. Enable Telegram API mode in the dashboard. Numbers validated on WhatsApp are then cross-checked against Telegram for dual verification.
</details>

<details>
<summary><b>What output formats are supported?</b></summary>
VCF (vCard) files — ready to import into your phone, CRM, or messaging tools. Separate files for WhatsApp-valid and Telegram-verified numbers.
</details>

<details>
<summary><b>Can I resume interrupted sessions?</b></summary>
Yes. Industrial mode tracks progress with cursor files. If the process stops, click Resume to continue from where you left off.
</details>

<details>
<summary><b>Does it work with any country?</b></summary>
Yes. The auto-detector supports all international prefixes. Tested with BE, FR, DE, NL, UK, US, MA, and more.
</details>

---

## ⚠️ Disclaimer

This software is provided for **legitimate business use only** (marketing list verification, contact validation). The user is solely responsible for compliance with applicable laws and platform terms of service. The developers assume no liability for misuse.

---

## 📄 License

**Proprietary** — All rights reserved. See [LICENSE](LICENSE).

Unauthorized copying, modification, redistribution, or reverse engineering is strictly prohibited.

---

<p align="center">
  <sub>© 2026 WA + TG Operations · v3.0.0</sub>
</p>
