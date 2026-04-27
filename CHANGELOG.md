# Changelog

All notable changes to Geething are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning follows [Semantic Versioning](https://semver.org/).

## [0.3.0](https://github.com/bartekmp/geething/compare/geething-v0.2.2...geething-v0.3.0) (2026-04-27)


### Features

* remove faulty sound notifications, add trademarks, hide test button ([#10](https://github.com/bartekmp/geething/issues/10)) ([43c8ffd](https://github.com/bartekmp/geething/commit/43c8ffd24cc904e5ba723a805e5dc7030378b882))

## [0.2.2](https://github.com/bartekmp/geething/compare/geething-v0.2.1...geething-v0.2.2) (2026-04-25)


### Bug Fixes

* released Firefox add-on ([f3e9768](https://github.com/bartekmp/geething/commit/f3e9768fe11aa458df68809e6c8088a596faaffb))

## [0.2.1](https://github.com/bartekmp/geething/compare/geething-v0.2.0...geething-v0.2.1) (2026-04-22)


### Bug Fixes

* **ci:** use PAT for release-please so publish workflow fires on release ([#7](https://github.com/bartekmp/geething/issues/7)) ([9735684](https://github.com/bartekmp/geething/commit/97356840bf1d749cd597c8371076586f5cb6e8da))

## [0.2.0](https://github.com/bartekmp/geething/compare/geething-v0.1.0...geething-v0.2.0) (2026-04-22)


### Features

* **accounts:** per-account label monitoring, mute toggle, and unread badges ([#5](https://github.com/bartekmp/geething/issues/5)) ([a96ca91](https://github.com/bartekmp/geething/commit/a96ca910a02d4a10c85b5df3f4fc3c73a045c5bd))
* **ci:** release-please, AMO publish workflow, and dev seed tooling ([8978f49](https://github.com/bartekmp/geething/commit/8978f496f9a61f6de9011d0bfcbbe5dc4d7caa06))
* **ci:** release-please, AMO publish workflow, and dev seed tooling ([16e7e1b](https://github.com/bartekmp/geething/commit/16e7e1b5246ea9a71502f22c4215e5911d3816b2))
* initial release - multi-account Gmail notifications extension ([475d3c2](https://github.com/bartekmp/geething/commit/475d3c2e53baf17ffb4cbf178c8dd160d8b54758))
* notifications, keyboard nav, onboarding ([#6](https://github.com/bartekmp/geething/issues/6)) ([c91fab1](https://github.com/bartekmp/geething/commit/c91fab1f707229b865667f2103eb079a3e5c9d29))
* state persistence ([#4](https://github.com/bartekmp/geething/issues/4)) ([d39aef5](https://github.com/bartekmp/geething/commit/d39aef55ca940113c2e2488059fea3de09ea9fbd))


### Bug Fixes

* **ci:** add checkout step so prettier can format release-please PR branch ([97e7c95](https://github.com/bartekmp/geething/commit/97e7c95990baff67b7c562d33eafc95093b549ad))
* **ci:** write stub credentials.js before running tests ([a0130f1](https://github.com/bartekmp/geething/commit/a0130f1f2c1e2714973e980dfe2673883fe81822))
* **docs:** add section about OAuth ([#3](https://github.com/bartekmp/geething/issues/3)) ([06c94da](https://github.com/bartekmp/geething/commit/06c94da78bebd0c2fc43b74274269d457bf09fc3))
* release configuration ([68234e9](https://github.com/bartekmp/geething/commit/68234e902abe7c4f99880dd12d9865f77b7deea0))

## [Unreleased]

## [0.1.0] — 2026-04-20

### Added

- Multi-account Gmail support via OAuth 2.0 Authorization Code Flow with PKCE
- Toolbar badge showing total unread count across all accounts (capped at 99+)
- Desktop notifications for new emails with configurable content mode (title only / title + snippet)
- Notification sound via Web Audio API (no bundled binary required)
- Popup with per-account tabs, email list, and inline full-message preview
- Quick actions per email: mark as read, archive, spam, trash, open in Gmail
- Options page: account management, notification settings, poll interval (1–30 min), theme
- Dark / light / auto theme support with system theme tracking
- Auto mark-as-read when opening email preview (configurable)
- Relative timestamps ("2m ago", "1h ago") in email list
- Teal→blue-violet gradient icon at 16, 32, 48, 96, 128 px
- CI workflow: lint, format check, unit tests, web-ext lint, build
- Publish workflow: sign and upload to AMO on GitHub Release
