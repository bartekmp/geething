import { saveAccounts } from '../shared/storage.js';
import { updateBadge } from './badge.js';

const ACCOUNTS = [
  { id: 'dev-1', email: 'alice@gmail.com', label: 'Personal', color: '#4f8cff' },
  { id: 'dev-2', email: 'alice.work@gmail.com', label: 'Work', color: '#ff7a59' },
];

function buildMessages() {
  const t = Date.now();
  return {
    'dev-1': [
      {
        id: 'dev-msg-1',
        subject: '[geething] Pull request #7 approved',
        from: { name: 'GitHub', email: 'noreply@github.com' },
        snippet:
          'Your pull request "feat: add dark mode" was approved by bartekmp. You can now merge it.',
        internalDate: t - 4 * 60_000,
      },
      {
        id: 'dev-msg-2',
        subject: 'Your Discover Weekly is ready',
        from: { name: 'Spotify', email: 'no-reply@spotify.com' },
        snippet: "This week's playlist has been handpicked just for you. 30 new tracks waiting.",
        internalDate: t - 23 * 3_600_000,
      },
      {
        id: 'dev-msg-3',
        subject: 'Re: Weekend hiking plans',
        from: { name: 'Marta Kowalczyk', email: 'marta.kowalczyk@gmail.com' },
        snippet:
          "Sounds perfect! I'll bring the map and snacks. Let's meet at the trailhead at 8am.",
        internalDate: t - 2 * 3_600_000,
      },
      {
        id: 'dev-msg-4',
        subject: 'Your package is on the way',
        from: { name: 'Amazon', email: 'shipment-tracking@amazon.com' },
        snippet: 'Your order #113-4829471 has been shipped. Expected delivery: tomorrow by 8 PM.',
        internalDate: t - 30 * 60_000,
      },
    ],
    'dev-2': [
      {
        id: 'dev-msg-5',
        subject: 'Q4 roadmap review — slides attached',
        from: { name: 'Piotr Nowak', email: 'p.nowak@acme.com' },
        snippet:
          "Please review the slides before tomorrow's meeting. Focus: infra migration and onboarding.",
        internalDate: t - 15 * 60_000,
      },
      {
        id: 'dev-msg-6',
        subject: '[PROJ-312] Performance issue on dashboard',
        from: { name: 'Jira', email: 'jira@atlassian.net' },
        snippet: 'Bartosz Pietrzak created this issue and assigned it to you. Priority: Medium.',
        internalDate: t - 45 * 60_000,
      },
      {
        id: 'dev-msg-7',
        subject: 'Code review request: auth refactor',
        from: { name: 'Karolina Wiśniewska', email: 'k.wisniewska@acme.com' },
        snippet:
          "I've opened PR #42 for the auth module refactor. Would really love your thoughts on the token refresh logic!",
        internalDate: t - 3 * 3_600_000,
      },
    ],
  };
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
