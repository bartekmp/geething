import { buildPlainTextDoc, formatPlainTextEmail, processEmailHtml } from './email-format.js';
import { downloadAttachment, openInGmail, openReply, performAction } from './actions.js';
import { ICONS, makeIconBtn, makeMarkReadToggleBtn, makeStarBtn, makeSvgIcon } from './icons.js';
import { els, dimmedMessages, state } from './state.js';
import {
  clearNode,
  flashCopied,
  formatFileSize,
  formatRelativeTime,
  getFileIconKey,
  sendMessage,
} from './utils.js';

// Tracks the mark-read toggle in the currently open detail view so openDetail
// can flip it after autoMarkReadOnOpen fires.
let detailMarkReadBtn = null;

export function renderLoadingInto(node) {
  clearNode(node);
  const wrap = document.createElement('div');
  wrap.className = 'loading';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  const text = document.createElement('span');
  text.textContent = 'Loading…';
  wrap.append(spinner, text);
  node.appendChild(wrap);
}

function makeEmailIframe(srcdoc) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-popups');
  iframe.srcdoc = srcdoc;
  return iframe;
}

function renderAttachmentList(accountId, messageId, attachments) {
  const section = document.createElement('div');
  section.className = 'attachment-list';
  for (const att of attachments) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'attachment-item';
    item.title = `Download ${att.filename}`;

    const icon = makeSvgIcon(ICONS[getFileIconKey(att.mimeType)], 16);
    icon.setAttribute('class', 'attachment-icon');

    const info = document.createElement('span');
    info.className = 'attachment-info';

    const name = document.createElement('span');
    name.className = 'attachment-name';
    name.textContent = att.filename;

    const size = document.createElement('span');
    size.className = 'attachment-size';
    size.textContent = att.size ? formatFileSize(att.size) : '';

    info.append(name, size);
    item.append(icon, info);

    item.addEventListener('click', async () => {
      item.disabled = true;
      try {
        await downloadAttachment(accountId, messageId, att);
      } catch {
        // Silently fail — the file icon just stays enabled on next click.
      } finally {
        item.disabled = false;
      }
    });

    section.appendChild(item);
  }
  return section;
}

function renderThreadContext(account, currentId, threadMessages) {
  const section = document.createElement('div');
  section.className = 'thread-context';

  const header = document.createElement('div');
  header.className = 'thread-context-header';
  header.setAttribute('role', 'button');
  header.tabIndex = 0;
  header.setAttribute('aria-expanded', 'true');

  const headerLabel = document.createElement('span');
  headerLabel.textContent = `Thread · ${threadMessages.length} messages`;

  const chevron = makeSvgIcon('M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z', 14);
  chevron.classList.add('thread-context-chevron');

  header.append(headerLabel, chevron);
  section.appendChild(header);

  const list = document.createElement('ul');
  list.className = 'thread-context-list';
  for (const msg of threadMessages) {
    const li = document.createElement('li');
    const isCurrent = msg.id === currentId;
    li.className = `thread-context-item${isCurrent ? ' current' : ''}`;

    const row = document.createElement('div');
    row.className = 'thread-context-item-row';

    const sender = document.createElement('span');
    sender.className = 'thread-context-sender';
    sender.textContent = msg.from?.name || msg.from?.email || 'Unknown';

    const time = document.createElement('span');
    time.className = 'thread-context-time';
    time.textContent = formatRelativeTime(msg.internalDate);

    row.append(sender, time);

    const snippet = document.createElement('div');
    snippet.className = 'thread-context-snippet';
    snippet.textContent = msg.snippet || '';

    li.append(row, snippet);

    if (!isCurrent) {
      li.tabIndex = 0;
      li.addEventListener('click', () => openDetail(account, msg, threadMessages));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail(account, msg, threadMessages);
        }
      });
    }

    list.appendChild(li);
  }
  section.appendChild(list);

  function toggleContext() {
    const nowHidden = !list.hidden;
    list.hidden = nowHidden;
    chevron.style.transform = nowHidden ? 'rotate(-90deg)' : '';
    header.setAttribute('aria-expanded', String(!nowHidden));
  }
  header.addEventListener('click', toggleContext);
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleContext();
    }
  });

  return section;
}

export function renderDetail(account, detail, threadMessages = null) {
  clearNode(els.detailContent);
  clearNode(els.detailActions);

  detailMarkReadBtn = makeMarkReadToggleBtn(account.id, detail.id, dimmedMessages.has(detail.id), {
    onMarkRead: () => {
      els.detail.hidden = true;
    },
    onAction: performAction,
  });

  els.detailActions.append(
    makeIconBtn('reply', 'Reply', () => openReply(account, detail)),
    makeStarBtn(account.id, detail.id, (detail.labelIds || []).includes('STARRED'), performAction),
    detailMarkReadBtn,
    makeIconBtn('archive', 'Archive', () =>
      performAction(account.id, detail.id, 'archive').then(() => {
        els.detail.hidden = true;
      }),
    ),
    makeIconBtn(
      'spam',
      'Spam',
      () =>
        performAction(account.id, detail.id, 'spam').then(() => {
          els.detail.hidden = true;
        }),
      { danger: true },
    ),
    makeIconBtn(
      'trash',
      'Delete',
      () =>
        performAction(account.id, detail.id, 'trash').then(() => {
          els.detail.hidden = true;
        }),
      { danger: true },
    ),
    makeIconBtn('open', 'Open in Gmail™', () => openInGmail(account, detail.id)),
  );

  const subject = document.createElement('h2');
  subject.className = 'detail-subject';
  subject.textContent = detail.subject || '(no subject)';

  const from = document.createElement('div');
  from.className = 'detail-from';
  const fromName = detail.from?.name || detail.from?.email || '';
  const fromEmail = detail.from?.email || '';

  const fromEmailSpan = document.createElement('span');
  fromEmailSpan.textContent = fromEmail;

  const fromLabel = document.createElement('span');
  if (fromName && fromName !== fromEmail) {
    fromLabel.appendChild(document.createTextNode(`${fromName} <`));
    fromLabel.appendChild(fromEmailSpan);
    fromLabel.appendChild(document.createTextNode('>'));
  } else {
    fromLabel.appendChild(fromEmailSpan);
  }
  from.appendChild(fromLabel);

  if (fromEmail) {
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'copy-email-btn';
    copyBtn.title = 'Copy email address';
    copyBtn.setAttribute('aria-label', 'Copy sender email address');
    copyBtn.appendChild(
      makeSvgIcon(
        'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z',
        13,
      ),
    );
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(fromEmail).then(() => {
        flashCopied(fromEmailSpan);
      });
    });
    from.appendChild(copyBtn);
  }

  const body = document.createElement('div');
  body.className = 'detail-body';
  if (detail.bodyHtml) {
    body.appendChild(
      makeEmailIframe(
        processEmailHtml(detail.bodyHtml, {
          blockExternalImages: !!state.settings?.blockExternalImages,
        }),
      ),
    );
  } else {
    const rawText = detail.bodyText || detail.snippet || '';
    body.appendChild(
      makeEmailIframe(
        buildPlainTextDoc(formatPlainTextEmail(rawText), {
          blockExternalImages: !!state.settings?.blockExternalImages,
        }),
      ),
    );
  }

  const date = document.createElement('div');
  date.className = 'detail-date';
  date.textContent = detail.internalDate
    ? new Date(detail.internalDate).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  const nodes = [subject, from, date];
  if (threadMessages && threadMessages.length > 1) {
    nodes.push(renderThreadContext(account, detail.id, threadMessages));
  }
  if (detail.attachments?.length > 0) {
    nodes.push(renderAttachmentList(account.id, detail.id, detail.attachments));
  }
  nodes.push(body);
  els.detailContent.append(...nodes);
}

export async function openDetail(account, message, threadMessages = null) {
  els.detail.hidden = false;
  clearNode(els.detailActions);
  renderLoadingInto(els.detailContent);
  try {
    const detail = await sendMessage({
      type: 'geething.getMessageDetail',
      accountId: account.id,
      messageId: message.id,
    });
    renderDetail(account, detail, threadMessages);
    if (state.settings?.autoMarkReadOnOpen) {
      performAction(account.id, message.id, 'markRead');
      detailMarkReadBtn?.setRead(true);
    }
  } catch (err) {
    clearNode(els.detailContent);
    const p = document.createElement('p');
    p.className = 'error-banner';
    p.textContent = err.message || String(err);
    els.detailContent.appendChild(p);
  }
}
