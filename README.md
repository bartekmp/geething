# Geething

A browser extension for multi-account Gmail notifications. Get a badge counter, desktop notifications with action buttons, and a full-featured popup — all without a backend server. Your data never leaves your device.


## Features

- **Free and open source** — no ads, no tracking, no paywalls; licensed under GPL-3.0
- **Multiple Gmail accounts** — add as many as you need, each with its own color and label
- **Badge counter** — total unread count across all accounts, shown on the toolbar icon
- **Desktop notifications** — notified the moment new mail arrives; click to open, or use the built-in **Mark as Read** / **Archive** buttons directly in the notification
- **Popup** — tabbed per-account view with sender, subject, and snippet; click any email to read it inline
- **Quick actions** — mark as read, archive, move to spam, delete, reply, or open in Gmail, all without leaving the extension
- **Notification sound** — built-in chime or upload your own (MP3/WAV/OGG, max 5 s)
- **Themes** — light, dark, or auto (follows system preference)
- **Configurable** — poll interval (1–30 min), max messages shown, popup width, and more

## Installation

### Firefox Add-ons (recommended)

> Firefox Browser Add-Ons listing coming soon. Star this repo to be notified.

### Manual installation (developer mode)

1. Download the latest `.zip` from [Releases](https://github.com/bartekmp/geething/releases) and unzip it, **or** clone this repository.
2. Open Firefox and go to `about:debugging`.
3. Click **This Firefox** → **Load Temporary Add-on…**
4. Select `src/manifest.json` from the unzipped folder.

The extension is now active until you restart Firefox. For permanent installation, wait for the AMO listing or self-sign the extension.

## Building from source

The published AMO release has credentials embedded — you only need this if you're building the extension yourself (e.g. to contribute or fork).

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project, enable the **Gmail API**, and create an OAuth 2.0 client ID (type: **Web application**).
2. Add an Authorised redirect URI: `https://<your-extension-id>.extensions.allizom.org/`  
   (Load the extension in `about:debugging` first to find your extension ID.)
3. Copy `src/shared/credentials.example.js` → `src/shared/credentials.js` and fill in your Client ID and Secret.
4. Run `npm run dev` to launch Firefox with the extension loaded.

> While your OAuth app is in "Testing" mode you need to add yourself as a test user in the consent screen. For personal use this is fine — no Google verification required.

## Development

```bash
npm install
npm run dev          # launches Firefox with the extension loaded
npm test             # unit tests (single run)
npm run test:watch   # watch mode
npm run test:coverage
npm run lint
npm run format:check
npx web-ext lint --source-dir=src
npm run build        # produces a .zip in web-ext-artifacts/
```

## Privacy

- No backend server, no analytics, no telemetry.
- OAuth tokens are stored only in your browser's local extension storage (encrypted at rest by Firefox).
- Email content is fetched directly from Google's API and never transmitted anywhere else.

## License

GPL-3.0 — see [LICENSE](LICENSE).
