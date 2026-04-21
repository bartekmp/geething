# Changelog

All notable changes to Geething are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning follows [Semantic Versioning](https://semver.org/).

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
