# Changelog

All notable changes to WA + TG Operations will be documented in this file.

## [3.0.0] - 2026-05-20

### Added
- **Industrial Mode** — Process 100,000+ numbers from file with auto-batching, resume support, and cursor tracking
- **Telegram API Verification** — Dual WA + TG checking: WhatsApp browser scraping + Telegram API validation in a single pipeline
- **Smart Scroll** — Toggle auto-scroll on/off in the Events panel during live processing
- **Auto Country Detector** — Automatically detects the dominant country prefix (BE, FR, DE, NL, UK, etc.) from loaded number lists
- **VPN/Tor Integration** — Built-in Tor proxy rotation with manual IP rotation button and latency monitoring
- **Speed Presets** — Quality, Balanced, Fast, Max Stable, and Custom speed profiles with real-time metrics
- **License Key System** — AES-256-CBC encrypted license keys with expiration dates for commercial distribution
- **VCF Export** — Automatic vCard export for WhatsApp-valid and Telegram-verified numbers
- **Session Persistence** — Browser session backup/restore system for stable long-running sessions
- **Silent Build** — Single executable (SEA) compilation with GUI subsystem patching for zero-console deployment
- **Real-time Dashboard** — Professional SaaS-style UI with live fader meters, queue stats, and pipeline visualization

### Security
- Source code obfuscation via javascript-obfuscator
- V8 bytecode compilation via bytenode
- PE subsystem patching for silent Windows execution

## [2.0.0] - 2026-05-18

### Added
- Browser-based WhatsApp validation engine
- Socket.IO real-time result streaming
- Basic file upload and manual input support

## [1.0.0] - 2026-05-16

### Added
- Initial release with basic number checking
