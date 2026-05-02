import { saveAccounts } from '../shared/storage.js';
import { updateBadge } from './badge.js';

export const ACCOUNTS = [
  { id: 'dev-1', email: 'alice@gmail.com', label: 'Personal', color: '#4f8cff' },
  { id: 'dev-2', email: 'alice.work@gmail.com', label: 'Work', color: '#ff7a59' },
];

// ── Fake email bodies ──────────────────────────────────────────────────────
// dev-msg-1 — plain text with Markdown formatting
const BODY_TEXT_GITHUB = `\
Hey alice@gmail.com,

**bartekmp** approved your pull request **"feat: add dark mode"** in *geething*.

> Your changes look great! The CSS variable approach is clean and I especially like how you handled the auto (system) theme fallback. Left a few minor inline comments but nothing blocking.

You can now **merge** the pull request:
https://github.com/bartekmp/geething/pull/7

---

## What's next

- Squash your commits before merging
- Delete the feature branch after merge
- Consider opening a follow-up for \`prefers-color-scheme\` media-query tests

Thanks for the contribution!

— GitHub`;

// dev-msg-2 — plain text, mostly links and list
const BODY_TEXT_SPOTIFY = `\
Your Discover Weekly is ready 🎵

We picked 30 tracks based on what you've been listening to lately. Here are a few highlights:

- **Bicep** — Glue (Bicep Mix)
- **Four Tet** — Baby
- **Jon Hopkins** — Open Eye Signal
- **Floating Points** — LesAlpx

Listen now: https://open.spotify.com/playlist/37i9dQZEVXcJZyENOWUFo7

---

*You're receiving this because you have Discover Weekly enabled.*
*Manage preferences: https://www.spotify.com/account/privacy/*`;

// dev-msg-3 — plain text, conversational
const BODY_TEXT_MARTA = `\
Hey!

Sounds perfect! I'll bring the map and snacks. Let's meet at the trailhead at 8am — is that still OK for you?

Also, I checked the weather forecast and it looks like Saturday might have some afternoon showers. We could:

1. Start early and aim to be back by 1pm
2. Or push it to Sunday which looks much clearer

Either way works for me. Let me know what you prefer!

See you then,
Marta

---
Sent from my iPhone`;

// dev-msg-4 — HTML email (shipping confirmation style)
const BODY_HTML_AMAZON = `\
<!doctype html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 14px; color: #111; background: #f4f4f4; margin: 0; padding: 0; }
  .wrap { max-width: 600px; margin: 24px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
  .header { background: #232f3e; padding: 20px 24px; }
  .header img { height: 32px; }
  .body { padding: 24px; }
  h2 { margin: 0 0 12px; color: #111; font-size: 20px; }
  .status { display: inline-block; background: #067D62; color: #fff; border-radius: 4px; padding: 4px 10px; font-size: 13px; font-weight: bold; margin-bottom: 16px; }
  .item { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-top: 1px solid #eee; }
  .item img { width: 64px; height: 64px; object-fit: cover; border-radius: 4px; background: #eee; }
  .item-info { flex: 1; }
  .item-name { font-weight: bold; margin-bottom: 4px; }
  .item-meta { color: #666; font-size: 12px; }
  .cta { display: inline-block; margin-top: 20px; background: #f90; color: #111; font-weight: bold; padding: 10px 24px; border-radius: 4px; text-decoration: none; }
  .footer { background: #f4f4f4; padding: 16px 24px; font-size: 12px; color: #666; text-align: center; }
  a { color: #067D62; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <span style="color:#f90;font-size:22px;font-weight:bold;letter-spacing:1px">amazon</span>
  </div>
  <div class="body">
    <h2>Your package is on the way!</h2>
    <div class="status">📦 Shipped</div>
    <p>Hi Alice, your order <strong>#113-4829471</strong> has been handed to the carrier and is on its way to you.</p>
    <p><strong>Estimated delivery:</strong> Tomorrow, by 8:00 PM</p>
    <div class="item">
      <div style="width:64px;height:64px;background:#ddd;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:28px">📗</div>
      <div class="item-info">
        <div class="item-name">Clean Code: A Handbook of Agile Software Craftsmanship</div>
        <div class="item-meta">Sold by Amazon.com | Qty: 1</div>
      </div>
    </div>
    <a href="https://www.amazon.com/orders" class="cta">Track your package</a>
    <p style="margin-top:20px;font-size:12px;color:#666">
      Having trouble? <a href="https://www.amazon.com/help">Visit our Help Center</a> or reply to this email.
    </p>
  </div>
  <div class="footer">
    © Amazon.com, Inc. | 410 Terry Ave N, Seattle, WA 98109<br>
    <a href="https://www.amazon.com/notifications">Manage notifications</a> · <a href="https://www.amazon.com/privacy">Privacy notice</a>
  </div>
</div>
</body>
</html>`;

// dev-msg-5 — HTML email (internal work email style)
const BODY_HTML_ROADMAP = `\
<!doctype html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; color: #1a1a1a; background: #fff; margin: 0; padding: 20px; }
  h2 { color: #1a5276; font-size: 18px; margin-top: 0; }
  h3 { color: #2874a6; font-size: 15px; margin-bottom: 4px; }
  .chip { display: inline-block; background: #d6eaf8; color: #1a5276; border-radius: 3px; padding: 2px 8px; font-size: 12px; margin-right: 4px; }
  .chip.red { background: #fadbd8; color: #922b21; }
  .chip.green { background: #d5f5e3; color: #1e8449; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th { background: #2874a6; color: #fff; padding: 8px 12px; text-align: left; font-size: 13px; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
  tr:nth-child(even) td { background: #f8f9fa; }
  .sig { margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; color: #666; font-size: 13px; }
  a { color: #2874a6; }
</style>
</head>
<body>
  <h2>📊 Q4 Roadmap Review — Pre-meeting slides</h2>
  <p>Hi team,</p>
  <p>I've attached the slide deck for tomorrow's roadmap review. Please take 15 minutes to read through it before 10am. We'll skip the intro during the call and go straight to discussion.</p>

  <h3>Focus areas for the meeting</h3>
  <span class="chip red">🔴 Infra migration</span>
  <span class="chip">🔵 Onboarding flow redesign</span>
  <span class="chip green">🟢 Auth service (complete)</span>

  <table>
    <tr><th>Initiative</th><th>Owner</th><th>Status</th><th>ETA</th></tr>
    <tr><td>DB migration to Aurora</td><td>Karolina W.</td><td>In progress</td><td>Nov 30</td></tr>
    <tr><td>Onboarding v2</td><td>Michał T.</td><td>Design review</td><td>Dec 15</td></tr>
    <tr><td>Auth service rewrite</td><td>Piotr N.</td><td>✅ Done</td><td>—</td></tr>
    <tr><td>API rate limiting</td><td>TBD</td><td>Not started</td><td>Q1</td></tr>
  </table>

  <p>Slides: <a href="https://docs.google.com/presentation/d/example">Q4 Roadmap Review (Google Slides)</a></p>
  <p>Meeting link: <a href="https://meet.google.com/abc-defg-hij">meet.google.com/abc-defg-hij</a></p>

  <p>See you tomorrow!</p>
  <div class="sig">
    <strong>Piotr Nowak</strong><br>
    Head of Engineering · ACME Corp<br>
    <a href="mailto:p.nowak@acme.com">p.nowak@acme.com</a>
  </div>
</body>
</html>`;

// dev-msg-6 — plain text, Jira-style notification
const BODY_TEXT_JIRA = `\
[PROJ-312] Performance issue on dashboard

**Bartosz Pietrzak** created this issue and assigned it to you.

Type:    Bug
Priority: Medium
Project:  PROJ — Customer Portal
Reporter: Bartosz Pietrzak <b.pietrzak@acme.com>

---

## Description

The main dashboard takes **8–12 seconds** to load for accounts with more than 500 projects. The issue is consistently reproducible in production but not in staging.

Steps to reproduce:
1. Log in as a user with 500+ projects (use test account \`qa-heavy@acme.com\`)
2. Navigate to /dashboard
3. Observe the loading spinner

Expected: Load in < 2s
Actual: 8-12s, sometimes timeout

## Notes

Possibly related to PROJ-287 (N+1 query issue from last sprint). Check the \`ProjectRepository.findAll()\` call.

---

View issue: https://acme.atlassian.net/browse/PROJ-312
Manage notifications: https://acme.atlassian.net/secure/ViewProfile.jspa`;

// dev-msg-7 — plain text, PR review request
const BODY_TEXT_KAROLINA = `\
Hey,

I've opened **PR #42** for the auth module refactor — would really love your thoughts before I request a formal review from Piotr.

Branch: \`feature/auth-refactor\`
PR: https://github.com/acme/customer-portal/pull/42

---

## What changed

- Replaced the old JWT helper with the new \`auth-service\` client
- Token refresh logic is now handled centrally (no more per-component refresh loops)
- Added \`useAuth()\` hook for React components

## What I'm unsure about

The token refresh logic in \`src/auth/tokenManager.js\` — specifically the *retry-on-401* behaviour. I'm not sure if we should retry once silently or immediately redirect to login. I went with silent retry + redirect, but open to other approaches.

Also: should we keep the old \`legacyAuth.js\` around for the transition period or just rip it out? It's only used in two places now.

Let me know what you think!
Karolina`;

// ── 20 extra personal-account bodies ──────────────────────────────────────

const BODY_TEXT_PRAGMATIC = `\
**Issue #312 — The Pragmatic Engineer**
*The best reads in software engineering this week*

Hey,

Here's what caught my attention this week:

---

## 1. The Boring Technology Club

A great essay making the rounds again. The core argument: **choose boring technology** for the moving parts of your system, and save your innovation tokens for things that genuinely differentiate your product.

> "Every piece of technology you choose is a bet. Some bets pay off. Most don't."

Worth reading even if you've seen it: https://boringtechnology.club/

---

## 2. "Staff Engineer" by Will Larson — a summary

If you haven't read the book, here are the key mental models:
- The **four archetypes**: Tech lead, Architect, Solver, Right hand
- Staff engineers operate at the intersection of technical work and organisational context
- The biggest trap: being technically excellent but **invisible** to the people who make decisions

Full summary: https://lethain.com/staff-engineer/

---

## 3. Quick links

- \`git worktree\` — probably the most underused git feature: https://git-scm.com/docs/git-worktree
- Why database migrations are hard: https://planetscale.com/blog/backward-compatible-migrations
- SQLite is not a toy: https://www.sqlite.org/whentouse.html

---

See you next week,
Gergely Orosz

*Unsubscribe: https://newsletter.pragmaticengineer.com/unsubscribe*`;

const BODY_HTML_BANK = `\
<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;font-size:14px;color:#222;background:#f4f4f4;margin:0;padding:0}
  .wrap{max-width:560px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .hdr{background:#003087;padding:18px 24px;color:#fff}
  .hdr h1{margin:0;font-size:20px;font-weight:bold}
  .body{padding:24px}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px}
  .row:last-child{border:none}
  .label{color:#666}
  .cta{display:inline-block;margin-top:18px;background:#003087;color:#fff;padding:10px 22px;border-radius:4px;text-decoration:none;font-weight:bold}
  .footer{background:#f0f0f0;padding:14px 24px;font-size:11px;color:#888;text-align:center}
</style>
</head><body>
<div class="wrap">
  <div class="hdr"><h1>PKO Bank Polski</h1></div>
  <div class="body">
    <p>Your <strong>October 2024</strong> account statement is ready.</p>
    <div class="row"><span class="label">Account</span><span>•••• •••• •••• 4821</span></div>
    <div class="row"><span class="label">Opening balance</span><span>12 450,32 PLN</span></div>
    <div class="row"><span class="label">Credits</span><span style="color:#067D62">+8 200,00 PLN</span></div>
    <div class="row"><span class="label">Debits</span><span style="color:#c00">−5 834,17 PLN</span></div>
    <div class="row"><span class="label">Closing balance</span><span><strong>14 816,15 PLN</strong></span></div>
    <a href="https://www.pkobp.pl/ipko" class="cta">View full statement</a>
    <p style="margin-top:18px;font-size:12px;color:#666">
      Log in to iPKO to download your statement as PDF.<br>
      Questions? Call <strong>800 302 302</strong> (free, 24/7).
    </p>
  </div>
  <div class="footer">PKO Bank Polski SA | ul. Puławska 15, 02-515 Warszawa | <a href="https://www.pkobp.pl/privacy" style="color:#888">Privacy</a></div>
</div>
</body></html>`;

const BODY_TEXT_MEETUP = `\
Hi Alice,

**Python Warsaw Meetup #38** is happening next Thursday and there are still a few spots left.

## Event details

- **Date**: Thursday, 7 November 2024
- **Time**: 18:30 – 21:00
- **Venue**: Google Warsaw, ul. Emilii Plater 53 (10th floor)
- **Free entry** — just RSVP below

## Talks

1. *Type hints at scale* — Michał Tkaczyk (45 min)
2. *Pydantic v2 internals* — lightning talk by Agnieszka Lewandowska (15 min)
3. Open Q&A + networking

RSVP: https://www.meetup.com/python-warsaw/events/298471234/

Hope to see you there!

— Python Warsaw organiser team`;

const BODY_TEXT_LINKEDIN = `\
Hi Alice,

Your profile is getting noticed.

**3 people** viewed your profile in the last week, including someone from **Google** and a recruiter from **JetBrains**.

You appeared in **7 searches** this week. Upgrade to Premium to see who's looking.

Also: your connection **Tomasz Wierzbicki** just started a new position at Allegro as Senior Backend Engineer.

---

Check your profile: https://www.linkedin.com/in/alice/

— LinkedIn`;

const BODY_TEXT_DUOLINGO = `\
🦉 Heads up, Alice!

You're on a **47-day streak** — don't lose it today!

You haven't practised Spanish yet today. It only takes 5 minutes to keep your streak alive.

Your current level: **B1 · Intermediate**
Lessons completed this week: 6 / 7

Practice now: https://www.duolingo.com/

— Duo the Owl`;

const BODY_TEXT_GRANDMA = `\
Cześć Ala,

Jak się czujesz? U mnie wszystko dobrze, tylko kolano daje mi trochę w kość przy tej pogodzie.

Przesyłam Ci obiecany przepis na pierogi z kapustą i grzybami, takie jak robiła Twoja prababcia:

---

**Pierogi z kapustą i grzybami (na ok. 50 sztuk)**

*Ciasto:*
- 500g mąki pszennej
- 1 jajko
- 200ml ciepłej wody
- szczypta soli

*Farsz:*
- 500g kiszonej kapusty
- 30g suszonych grzybów (najlepiej borowiki)
- 1 duża cebula
- sól, pieprz, majeranek do smaku

*Przygotowanie:*
1. Grzyby namoczyć przez noc, ugotować w tej samej wodzie. Odcedzić i zachować wywar.
2. Kapustę odcisnąć i pokroić drobno. Podsmażyć z cebulą na oleju aż zmięknie.
3. Dodać posiekane grzyby, doprawić. Farsz powinien być suchy — inaczej ciasto namoknie.
4. Ciasto zagnieść, odstawić pod ściereczką na 20 minut.
5. Wałkować cienko, wykrawać kółka, nakładać farsz, zlepiać.
6. Gotować w osolonej wodzie ok. 4-5 minut od wypłynięcia.

Można podsmażyć na maśle z cebulką — wtedy są najlepsze! 😊

Napisz jak wyszły. Całuję,
Babcia Halina

PS. Wywar z grzybów nie wylewaj — do zupy albo bigosu!`;

const BODY_HTML_STEAM = `\
<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body{font-family:'Motiva Sans',Arial,sans-serif;background:#1b2838;color:#c6d4df;margin:0;padding:20px;font-size:14px}
  .wrap{max-width:600px;margin:0 auto;background:#171a21;border-radius:6px;overflow:hidden}
  .hdr{background:linear-gradient(135deg,#1b2838,#2a475e);padding:24px;text-align:center}
  .hdr h1{color:#66c0f4;margin:0;font-size:24px;letter-spacing:1px}
  .hdr p{color:#8f98a0;margin:6px 0 0}
  .body{padding:24px}
  .game{display:flex;gap:16px;padding:12px;background:#1e2837;border-radius:4px;margin-bottom:12px;align-items:center}
  .game-img{width:96px;height:44px;background:#2a475e;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#8f98a0;flex-shrink:0}
  .game-name{font-weight:bold;color:#c6d4df;font-size:13px}
  .game-price{color:#8f98a0;font-size:12px;margin-top:3px}
  .game-sale{color:#4c6b22;font-size:12px}
  .badge{display:inline-block;background:#4c6b22;color:#a4d007;padding:2px 7px;border-radius:3px;font-size:11px;font-weight:bold;margin-right:6px}
  .cta{display:block;text-align:center;background:#4c6b22;color:#a4d007;padding:12px;border-radius:4px;text-decoration:none;font-weight:bold;margin-top:20px;font-size:15px}
  a{color:#66c0f4}
</style>
</head><body>
<div class="wrap">
  <div class="hdr">
    <h1>STEAM WINTER SALE</h1>
    <p>Ends January 2nd — up to 90% off thousands of games</p>
  </div>
  <div class="body">
    <p>Based on your wishlist and playtime, we picked these for you:</p>

    <div class="game">
      <div class="game-img">🎮</div>
      <div>
        <div class="game-name">Cyberpunk 2077</div>
        <div class="game-price"><s>249,00 PLN</s> → <strong style="color:#a4d007">99,60 PLN</strong></div>
        <div class="game-sale"><span class="badge">-60%</span>Includes Phantom Liberty</div>
      </div>
    </div>

    <div class="game">
      <div class="game-img">🧠</div>
      <div>
        <div class="game-name">Disco Elysium — The Final Cut</div>
        <div class="game-price"><s>129,00 PLN</s> → <strong style="color:#a4d007">19,35 PLN</strong></div>
        <div class="game-sale"><span class="badge">-85%</span>Award-winning RPG</div>
      </div>
    </div>

    <div class="game">
      <div class="game-img">🗡️</div>
      <div>
        <div class="game-name">Hollow Knight</div>
        <div class="game-price"><s>49,99 PLN</s> → <strong style="color:#a4d007">12,49 PLN</strong></div>
        <div class="game-sale"><span class="badge">-75%</span>On your wishlist</div>
      </div>
    </div>

    <a href="https://store.steampowered.com/sale/wintersale" class="cta">Browse all deals →</a>
    <p style="text-align:center;font-size:11px;color:#8f98a0;margin-top:12px">
      <a href="https://store.steampowered.com/account/emailoptout">Unsubscribe from sale emails</a>
    </p>
  </div>
</div>
</body></html>`;

const BODY_TEXT_NOTION = `\
Hey Alice,

**Tomasz Wierzbicki** shared a Notion page with you:

📄 **"2024 Retrospective Template"**
https://www.notion.so/tw/2024-retrospective-template

---

*From Tomasz:*
> Hey! I'm using this for our team retro next week. Thought you might want to adapt it for your own end-of-year review — it worked really well last year. Let me know if you have questions.

---

You've been granted **comment** access. Open the page to view or leave comments.

— Notion`;

const BODY_TEXT_GH_SECURITY = `\
[GitHub Security Alert] geething/geething

## Dependabot alert #3

**Severity: Moderate**
Package: \`web-ext\` (devDependency)
Current version: 7.11.0
Patched version: 7.12.1

### Details

A moderate severity vulnerability was found in \`web-ext\` affecting versions < 7.12.1. A malformed \`manifest.json\` in a loaded extension could cause the CLI to read arbitrary files from the filesystem during the build step.

**Impact**: Dev tooling only — not present in production builds or the distributed extension. No user data is at risk.

### Recommended action

Run:
\`\`\`
npm update web-ext
\`\`\`

Or update your \`package.json\` manually and re-lock.

---

View alert: https://github.com/bartekmp/geething/security/dependabot/3
Dismiss alert: https://github.com/bartekmp/geething/security/dependabot/3/dismiss`;

const BODY_TEXT_JAN = `\
Hej Ala!

Słuchaj, wpadłam na taki pomysł — może byś wpadła w sobotę wieczór? Organizuję małe urodzinowe zbieranie się, nieformalne, max 12 osób.

Szczegóły:
- **Kiedy**: sobota 9 listopada, od 19:00
- **Gdzie**: u mnie — Mokotów, Puławska 118/7 (domofon: 47)
- **Co przynieść**: jeśli chcesz to cokolwiek do picia, ale absolutnie nie musisz

Będzie Marta, Kacper, Zosia z Wrocławia (pamiętasz ją z Erasmusa?), kilku znajomych z pracy. Luźna atmosfera, może jakieś planszówki na koniec.

Daj znać czy możesz! Bardzo się cieszę na Twój widok 🥳

Buziaki,
Ania`;

const BODY_TEXT_BOOKING = `\
Your trip is coming up!

**Kraków City Break**
Check-in: Friday, 15 November 2024 (2 nights)

---

## Reservation details

**Hotel Stary**
ul. Szczepańska 5, Kraków Old Town
⭐⭐⭐⭐⭐

- Room: Superior Double, Old Town view
- Check-in: 15 Nov from 15:00
- Check-out: 17 Nov by 12:00
- Confirmation number: **BK-92847561**

**Free cancellation** until 13 November 23:59.

---

Getting there: Kraków Główny train station is a 15-minute walk.
Parking: Available in the hotel garage, 80 PLN/day.

View booking: https://www.booking.com/mybookings/BK-92847561

Have a great trip!
— Booking.com`;

const BODY_TEXT_PAYPAL = `\
Hello Alice,

You received a payment.

**+150,00 PLN** from Marta Kowalczyk (marta.kowalczyk@gmail.com)

Note: "za bilety na koncert 🎵"

---

Your current balance: **487,32 PLN**

Transaction ID: 8VX29104XB384726L
Date: 4 November 2024, 14:32

---

View transaction: https://www.paypal.com/activity/payment/8VX29104XB384726L

— PayPal`;

const BODY_TEXT_MEDIUM = `\
**Your weekly reading from Medium**

---

## Staff picks this week

**1. I quit my FAANG job after 6 months. Here's what I learned.**
*by Sarah Chen · 8 min read*
A refreshingly honest take on the gap between the prestige of big tech and the actual day-to-day reality. The section on "golden handcuffs" is worth the read alone.
https://medium.com/@sarahchen/faang-quit

---

**2. Why Rust is eating C++'s lunch (and what C++ devs think about it)**
*by Aleksei Volkov · 12 min read*
Not a language war piece — actually a nuanced look at where Rust is being adopted, which workloads benefit, and where C++ still wins.
https://medium.com/@avolkov/rust-vs-cpp-2024

---

**3. The silent crisis in open-source maintenance**
*by Priya Nair · 6 min read*
After the XZ Utils incident, a serious look at how we as an industry rely on software maintained by one or two people in their spare time.
https://medium.com/@priyanair/oss-maintenance-crisis

---

Manage your recommendations: https://medium.com/me/settings/notifications`;

const BODY_HTML_APPLE = `\
<!doctype html>
<html><head><meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#1d1d1f;background:#fff;margin:0;padding:0}
  .wrap{max-width:520px;margin:0 auto;padding:32px 24px}
  .logo{text-align:center;margin-bottom:24px}
  h2{font-size:20px;font-weight:600;margin:0 0 4px}
  .sub{color:#6e6e73;font-size:13px;margin-bottom:24px}
  .item{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #e5e5ea;font-size:13px}
  .item-name{flex:1}
  .item-price{white-space:nowrap;padding-left:16px}
  .total{display:flex;justify-content:space-between;padding:14px 0;font-weight:600}
  .footer{margin-top:28px;font-size:11px;color:#6e6e73;text-align:center;line-height:1.6}
  a{color:#0070c9}
</style>
</head><body>
<div class="wrap">
  <div class="logo">
    <svg width="22" height="27" viewBox="0 0 22 27" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.07 14.3c-.03-3.05 2.49-4.52 2.6-4.59-1.42-2.07-3.63-2.36-4.41-2.39-1.87-.19-3.66 1.1-4.61 1.1-.96 0-2.43-1.08-4-.05C5.5 9.22 3.1 11.2 3.1 15.24c0 4.06 2.84 11.76 4.05 11.73 1.18-.03 1.65-1.1 3.09-1.1 1.44 0 1.87 1.1 3.14 1.07 1.28-.03 3.44-4.1 3.44-4.1s-.84-2.98-.75-3z" fill="#1d1d1f"/>
    </svg>
  </div>

  <h2>Your receipt from Apple</h2>
  <p class="sub">4 November 2024 · Apple ID: alice@gmail.com</p>

  <div class="item">
    <span class="item-name">iCloud+ 200 GB<br><span style="color:#6e6e73;font-size:12px">Monthly subscription</span></span>
    <span class="item-price">12,99 PLN</span>
  </div>
  <div class="item">
    <span class="item-name">Fantastical — Calendar &amp; Tasks<br><span style="color:#6e6e73;font-size:12px">Annual subscription renewal</span></span>
    <span class="item-price">159,99 PLN</span>
  </div>
  <div class="total">
    <span>Total</span>
    <span>172,98 PLN</span>
  </div>

  <p style="font-size:12px;color:#6e6e73;margin-top:4px">Charged to Visa •••• 4821</p>

  <div class="footer">
    <a href="https://reportaproblem.apple.com">Report a Problem</a> ·
    <a href="https://appleid.apple.com">Apple ID</a> ·
    <a href="https://www.apple.com/legal/privacy">Privacy Policy</a><br><br>
    Apple Distribution International Ltd., Hollyhill Industrial Estate, Cork, Ireland
  </div>
</div>
</body></html>`;

const BODY_TEXT_EVENTBRITE = `\
This is a reminder about your event tomorrow!

🎸 **Taco Hemingway — Trójkąt Tour 2024**
Tomorrow · Wednesday, 6 November · Doors open 19:00

**COS Torwar, Warsaw**
ul. Łazienkowska 6a

---

Your ticket:
- Type: Standard GA
- Quantity: 2
- Order: #EB-7849201

**Important**:
- Bring photo ID
- No re-entry after leaving the venue
- Bag check available at Gate C

View tickets: https://www.eventbrite.com/mytickets/EB-7849201

Have fun! 🎶
— Eventbrite`;

const BODY_TEXT_GOOGLE_PHOTOS = `\
Hi Alice 👋

We found some memories from **3 years ago** that you might want to revisit.

📸 **"Weekend in Gdańsk"** — November 2021
17 photos · Long Wharf, Westerplatte, Old Town

📸 **"Marta's housewarming"** — November 2021
34 photos and 2 videos

These photos are stored in your Google Photos library.

View memories: https://photos.google.com/memories

— Google Photos team`;

const BODY_TEXT_STACKOVERFLOW = `\
Your question got some activity on Stack Overflow!

**"Why does my Firefox WebExtension service worker get killed after 30s?"**
https://stackoverflow.com/questions/77841623

---

**Answer by user mozdev_contributor** (12 upvotes)

> Firefox MV3 background service workers are subject to the same lifetime rules as Chrome MV3: the SW is terminated after ~30 seconds of inactivity. You need to keep it alive using a keepalive ping or restructure your code to not rely on long-running background state.
>
> The standard workaround is to use \`browser.alarms\` for periodic work — alarms wake the SW, do the work, and let it die again. Avoid \`setInterval\` in the SW.

---

**Answer by anna_webext** (3 upvotes)

> Also worth noting: any \`await\` chain that takes longer than ~5s without yielding can also get the SW killed mid-execution in some browser versions. For long async chains, use \`chrome.runtime.getPersistentBackground\` workarounds or break the work into alarm-driven chunks.

---

View all answers: https://stackoverflow.com/questions/77841623`;

const BODY_TEXT_PIOTR_FRIEND = `\
Hej!

Długo się nie odzywałem, ale mam news — **przeprowadzam się!**

Znalazłem w końcu mieszkanie na Pradze-Północ, 2 pokoje, blisko Centrum Praskiego Koneser. Klucze dostaję 15 listopada.

Szukam do pomocy przy przeprowadzce w weekend 16-17 listopada — mam trochę mebli do wniesienia na 3. piętro (winda jest, ale mała). W zamian oczywiście pizza i piwo 🍕🍺

Daj znać czy możesz podskoczyć! Nawet na parę godzin by pomogło.

Pozdro,
Piotr

PS. Stare mieszkanie na Woli sprzedaję — jeśli znasz kogoś kto szuka to pisz!`;

const BODY_TEXT_DOCTOR = `\
Dear Alice,

This is a reminder of your upcoming appointment:

**Appointment confirmation**

- Doctor: Dr. Katarzyna Malinowska (General Practice)
- Date: Thursday, 14 November 2024
- Time: 10:15 AM
- Location: Medicover, ul. Złota 59, Warsaw (2nd floor, reception B)

**Please arrive 10 minutes early** to complete any paperwork.

If you need to cancel or reschedule, please do so at least 24 hours in advance:
- Online: https://www.medicover.pl/appointments
- Phone: 500 900 500

We look forward to seeing you.

Kind regards,
Medicover Patient Services`;

// ── Dev attachment helpers ─────────────────────────────────────────────────
// Encodes a short text label into base64url so dev attachments are actually
// downloadable (the file contains the label text — good enough for UI testing).
function devAttachData(label) {
  return btoa(`[Geething dev seed - ${label}]`)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ── Message map ────────────────────────────────────────────────────────────

// Flat map of messageId → full detail object (including bodies).
export const DEV_MESSAGE_DETAILS = new Map([
  [
    'dev-msg-1',
    {
      id: 'dev-msg-1',
      subject: '[geething] Pull request #7 approved',
      from: { name: 'GitHub', email: 'noreply@github.com' },
      snippet: 'Your pull request "feat: add dark mode" was approved by bartekmp.',
      bodyHtml: null,
      bodyText: BODY_TEXT_GITHUB,
    },
  ],
  [
    'dev-msg-2',
    {
      id: 'dev-msg-2',
      subject: 'Your Discover Weekly is ready',
      from: { name: 'Spotify', email: 'no-reply@spotify.com' },
      snippet: "This week's playlist has been handpicked just for you.",
      bodyHtml: null,
      bodyText: BODY_TEXT_SPOTIFY,
    },
  ],
  [
    'dev-msg-3',
    {
      id: 'dev-msg-3',
      subject: 'Re: Weekend hiking plans',
      from: { name: 'Marta Kowalczyk', email: 'marta.kowalczyk@gmail.com' },
      snippet: "Sounds perfect! I'll bring the map and snacks.",
      bodyHtml: null,
      bodyText: BODY_TEXT_MARTA,
    },
  ],
  [
    'dev-msg-4',
    {
      id: 'dev-msg-4',
      subject: 'Your package is on the way',
      from: { name: 'Amazon', email: 'shipment-tracking@amazon.com' },
      snippet: 'Your order #113-4829471 has been shipped. Expected delivery: tomorrow by 8 PM.',
      bodyHtml: BODY_HTML_AMAZON,
      bodyText: null,
    },
  ],
  [
    'dev-msg-5',
    {
      id: 'dev-msg-5',
      subject: 'Q4 roadmap review — slides attached',
      from: { name: 'Piotr Nowak', email: 'p.nowak@acme.com' },
      snippet: "Please review the slides before tomorrow's meeting.",
      bodyHtml: BODY_HTML_ROADMAP,
      bodyText: null,
      attachments: [
        {
          filename: 'Q4_Roadmap_Review.pdf',
          mimeType: 'application/pdf',
          size: 2_451_208,
          attachmentId: null,
          inlineData: devAttachData('Q4 Roadmap Review'),
        },
        {
          filename: 'initiative_tracker.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 93_440,
          attachmentId: null,
          inlineData: devAttachData('initiative tracker'),
        },
      ],
    },
  ],
  [
    'dev-msg-6',
    {
      id: 'dev-msg-6',
      subject: '[PROJ-312] Performance issue on dashboard',
      from: { name: 'Jira', email: 'jira@atlassian.net' },
      snippet: 'Bartosz Pietrzak created this issue and assigned it to you. Priority: Medium.',
      bodyHtml: null,
      bodyText: BODY_TEXT_JIRA,
    },
  ],
  [
    'dev-msg-7',
    {
      id: 'dev-msg-7',
      subject: 'Code review request: auth refactor',
      from: { name: 'Karolina Wiśniewska', email: 'k.wisniewska@acme.com' },
      snippet: "I've opened PR #42 for the auth module refactor.",
      bodyHtml: null,
      bodyText: BODY_TEXT_KAROLINA,
    },
  ],
  // ── 20 extra personal-account messages ──────────────────────────────────
  [
    'dev-p-01',
    {
      id: 'dev-p-01',
      subject: 'Issue #312 — The Pragmatic Engineer',
      from: { name: 'Gergely Orosz', email: 'hi@pragmaticengineer.com' },
      snippet:
        'The best reads in software engineering this week — boring tech, staff eng, git worktrees.',
      bodyHtml: null,
      bodyText: BODY_TEXT_PRAGMATIC,
    },
  ],
  [
    'dev-p-02',
    {
      id: 'dev-p-02',
      subject: 'Your October statement is available',
      from: { name: 'PKO Bank Polski', email: 'noreply@pkobp.pl' },
      snippet: 'Your account statement for October 2024 is ready. Closing balance: 14 816,15 PLN.',
      bodyHtml: BODY_HTML_BANK,
      bodyText: null,
      attachments: [
        {
          filename: 'wyciag_pazdziernik_2024.pdf',
          mimeType: 'application/pdf',
          size: 159_744,
          attachmentId: null,
          inlineData: devAttachData('PKO account statement October 2024'),
        },
      ],
    },
  ],
  [
    'dev-p-03',
    {
      id: 'dev-p-03',
      subject: 'Python Warsaw Meetup #38 — spots still available',
      from: { name: 'Meetup', email: 'info@meetup.com' },
      snippet: 'Thursday 7 Nov · Google Warsaw · Type hints at scale + Pydantic v2 internals.',
      bodyHtml: null,
      bodyText: BODY_TEXT_MEETUP,
    },
  ],
  [
    'dev-p-04',
    {
      id: 'dev-p-04',
      subject: '3 people viewed your profile this week',
      from: { name: 'LinkedIn', email: 'messages-noreply@linkedin.com' },
      snippet: 'Including someone from Google and a recruiter from JetBrains.',
      bodyHtml: null,
      bodyText: BODY_TEXT_LINKEDIN,
    },
  ],
  [
    'dev-p-05',
    {
      id: 'dev-p-05',
      subject: "You're on a 47-day streak! Don't lose it 🔥",
      from: { name: 'Duolingo', email: 'reminder@duolingo.com' },
      snippet: "You haven't practiced Spanish yet today. 5 minutes is all it takes.",
      bodyHtml: null,
      bodyText: BODY_TEXT_DUOLINGO,
    },
  ],
  [
    'dev-p-06',
    {
      id: 'dev-p-06',
      subject: 'Przepis na pierogi z kapustą i grzybami',
      from: { name: 'Babcia Halina', email: 'halina.kowalska52@wp.pl' },
      snippet: 'Cześć Ala, przesyłam Ci obiecany przepis na pierogi takie jak robiła prababcia.',
      bodyHtml: null,
      bodyText: BODY_TEXT_GRANDMA,
      attachments: [
        {
          filename: 'przepis_babci_haliny.jpg',
          mimeType: 'image/jpeg',
          size: 487_312,
          attachmentId: null,
          inlineData: devAttachData('babcia Halina recipe scan'),
        },
      ],
    },
  ],
  [
    'dev-p-07',
    {
      id: 'dev-p-07',
      subject: 'Steam Winter Sale — picks from your wishlist',
      from: { name: 'Steam', email: 'noreply@steampowered.com' },
      snippet: 'Up to 90% off — Cyberpunk 2077, Disco Elysium, Hollow Knight and more.',
      bodyHtml: BODY_HTML_STEAM,
      bodyText: null,
    },
  ],
  [
    'dev-p-08',
    {
      id: 'dev-p-08',
      subject: 'Tomasz shared "2024 Retrospective Template" with you',
      from: { name: 'Notion', email: 'notify@notionmail.com' },
      snippet: 'Tomasz Wierzbicki shared a page with you — comment access granted.',
      bodyHtml: null,
      bodyText: BODY_TEXT_NOTION,
    },
  ],
  [
    'dev-p-09',
    {
      id: 'dev-p-09',
      subject: '[Security] Dependabot alert for geething',
      from: { name: 'GitHub', email: 'security@github.com' },
      snippet: 'Moderate severity in web-ext < 7.12.1. Recommended: npm update web-ext.',
      bodyHtml: null,
      bodyText: BODY_TEXT_GH_SECURITY,
    },
  ],
  [
    'dev-p-10',
    {
      id: 'dev-p-10',
      subject: 'Urodziny w sobotę — wpadniesz? 🎉',
      from: { name: 'Ania Jabłońska', email: 'ania.jablonska@gmail.com' },
      snippet: 'Organizuję małe zbieranie się — Mokotów, sobota 9 listopada od 19:00.',
      bodyHtml: null,
      bodyText: BODY_TEXT_JAN,
    },
  ],
  [
    'dev-p-11',
    {
      id: 'dev-p-11',
      subject: 'Your Kraków trip is in 11 days',
      from: { name: 'Booking.com', email: 'noreply@booking.com' },
      snippet: 'Hotel Stary · Check-in 15 Nov · Confirmation: BK-92847561.',
      bodyHtml: null,
      bodyText: BODY_TEXT_BOOKING,
    },
  ],
  [
    'dev-p-12',
    {
      id: 'dev-p-12',
      subject: 'You received 150,00 PLN from Marta Kowalczyk',
      from: { name: 'PayPal', email: 'service@paypal.com' },
      snippet: '"za bilety na koncert 🎵" — your balance is now 487,32 PLN.',
      bodyHtml: null,
      bodyText: BODY_TEXT_PAYPAL,
    },
  ],
  [
    'dev-p-13',
    {
      id: 'dev-p-13',
      subject: 'Your weekly reading from Medium',
      from: { name: 'Medium', email: 'noreply@medium.com' },
      snippet: "I quit my FAANG job, why Rust is eating C++'s lunch, the OSS maintenance crisis.",
      bodyHtml: null,
      bodyText: BODY_TEXT_MEDIUM,
    },
  ],
  [
    'dev-p-14',
    {
      id: 'dev-p-14',
      subject: 'Your receipt from Apple',
      from: { name: 'Apple', email: 'no_reply@email.apple.com' },
      snippet: 'iCloud+ 200 GB + Fantastical annual renewal — total: 172,98 PLN.',
      bodyHtml: BODY_HTML_APPLE,
      bodyText: null,
    },
  ],
  [
    'dev-p-15',
    {
      id: 'dev-p-15',
      subject: 'Tomorrow: Taco Hemingway — Trójkąt Tour 2024',
      from: { name: 'Eventbrite', email: 'noreply@eventbrite.com' },
      snippet: 'Doors open 19:00 · COS Torwar, Warsaw · 2 tickets · Order EB-7849201.',
      bodyHtml: null,
      bodyText: BODY_TEXT_EVENTBRITE,
    },
  ],
  [
    'dev-p-16',
    {
      id: 'dev-p-16',
      subject: 'Memories from 3 years ago 📸',
      from: { name: 'Google Photos', email: 'no-reply@photos.google.com' },
      snippet: "Weekend in Gdańsk · Marta's housewarming — 51 photos from November 2021.",
      bodyHtml: null,
      bodyText: BODY_TEXT_GOOGLE_PHOTOS,
    },
  ],
  [
    'dev-p-17',
    {
      id: 'dev-p-17',
      subject: 'Re: Why does my Firefox WebExtension SW get killed?',
      from: { name: 'Stack Overflow', email: 'noreply@stackoverflow.com' },
      snippet:
        '2 new answers — 12 upvotes on the top answer. Use browser.alarms for periodic work.',
      bodyHtml: null,
      bodyText: BODY_TEXT_STACKOVERFLOW,
    },
  ],
  [
    'dev-p-18',
    {
      id: 'dev-p-18',
      subject: 'Przeprowadzka! Pomoc potrzebna 🏠',
      from: { name: 'Piotr Malinowski', email: 'piotr.malinowski91@gmail.com' },
      snippet:
        'Znalazłem mieszkanie na Pradze-Północ. Przeprowadzka 16-17 listopada — pizza i piwo w zamian.',
      bodyHtml: null,
      bodyText: BODY_TEXT_PIOTR_FRIEND,
    },
  ],
  [
    'dev-p-19',
    {
      id: 'dev-p-19',
      subject: 'Appointment reminder — Dr. Malinowska, 14 Nov 10:15',
      from: { name: 'Medicover', email: 'noreply@medicover.pl' },
      snippet: 'Thursday 14 November 10:15 AM · Medicover Złota 59 · Please arrive 10 min early.',
      bodyHtml: null,
      bodyText: BODY_TEXT_DOCTOR,
    },
  ],
  [
    'dev-p-20',
    {
      id: 'dev-p-20',
      subject: 'No new emails? That was the last one.',
      from: { name: 'Alice (yourself)', email: 'alice@gmail.com' },
      snippet:
        "If you're reading this, you scrolled all the way down. Pagination test complete! 🎉",
      bodyHtml: null,
      bodyText: `You made it to the bottom!\n\n**Pagination test:** ✅ passed\n\nThat's all 24 seed emails. If they all fit without pagination, the extension shows more than 20 messages — check the \`maxMessagesPerAccount\` setting in options.\n\nGood luck with the rest of the build! 🚀`,
    },
  ],
]);

// Explicit account assignment — avoids string-comparison hacks.
const ACCOUNT_MESSAGES = {
  'dev-1': [
    'dev-msg-1',
    'dev-msg-2',
    'dev-msg-3',
    'dev-msg-4',
    'dev-p-01',
    'dev-p-02',
    'dev-p-03',
    'dev-p-04',
    'dev-p-05',
    'dev-p-06',
    'dev-p-07',
    'dev-p-08',
    'dev-p-09',
    'dev-p-10',
    'dev-p-11',
    'dev-p-12',
    'dev-p-13',
    'dev-p-14',
    'dev-p-15',
    'dev-p-16',
    'dev-p-17',
    'dev-p-18',
    'dev-p-19',
    'dev-p-20',
  ],
  'dev-2': ['dev-msg-5', 'dev-msg-6', 'dev-msg-7'],
};

export function buildMessages() {
  const t = Date.now();
  // Ages: original messages spread over the last day; new ones spread over 30 days.
  const ages = {
    'dev-msg-1': t - 4 * 60_000,
    'dev-msg-2': t - 23 * 3_600_000,
    'dev-msg-3': t - 2 * 3_600_000,
    'dev-msg-4': t - 30 * 60_000,
    'dev-msg-5': t - 15 * 60_000,
    'dev-msg-6': t - 45 * 60_000,
    'dev-msg-7': t - 3 * 3_600_000,
    'dev-p-01': t - 6 * 3_600_000,
    'dev-p-02': t - 18 * 3_600_000,
    'dev-p-03': t - 1 * 86_400_000,
    'dev-p-04': t - 2 * 86_400_000,
    'dev-p-05': t - 2 * 86_400_000 - 3_600_000,
    'dev-p-06': t - 3 * 86_400_000,
    'dev-p-07': t - 4 * 86_400_000,
    'dev-p-08': t - 5 * 86_400_000,
    'dev-p-09': t - 6 * 86_400_000,
    'dev-p-10': t - 7 * 86_400_000,
    'dev-p-11': t - 9 * 86_400_000,
    'dev-p-12': t - 11 * 86_400_000,
    'dev-p-13': t - 13 * 86_400_000,
    'dev-p-14': t - 15 * 86_400_000,
    'dev-p-15': t - 17 * 86_400_000,
    'dev-p-16': t - 19 * 86_400_000,
    'dev-p-17': t - 21 * 86_400_000,
    'dev-p-18': t - 24 * 86_400_000,
    'dev-p-19': t - 27 * 86_400_000,
    'dev-p-20': t - 30 * 86_400_000,
  };
  const byAccount = { 'dev-1': [], 'dev-2': [] };
  for (const [accountId, ids] of Object.entries(ACCOUNT_MESSAGES)) {
    for (const id of ids) {
      const detail = DEV_MESSAGE_DETAILS.get(id);
      if (detail) {
        byAccount[accountId].push({ ...detail, internalDate: ages[id] ?? t });
      }
    }
  }
  return byAccount;
}

export async function seedDevData(setAccountState) {
  const messagesByAccount = buildMessages();
  await saveAccounts(ACCOUNTS);
  const t = Date.now();
  for (const [accountId, messages] of Object.entries(messagesByAccount)) {
    setAccountState(accountId, {
      messages,
      unreadCount: messages.length,
      error: null,
      lastPolledAt: t,
    });
  }
  const total = Object.values(messagesByAccount).reduce((sum, msgs) => sum + msgs.length, 0);
  await updateBadge(total);
}
