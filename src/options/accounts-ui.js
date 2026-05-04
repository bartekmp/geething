import { ACCOUNT_COLORS } from '../shared/constants.js';
import { clearNode, els, flashSaved, sendMessage, showStatus, state } from './state.js';

// Injected via initAccountsUi() to break the circular dependency with options.js entry point.
let _loadState;

export function initAccountsUi({ loadState }) {
  _loadState = loadState;
}

function makeGripIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 10 16');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  for (const [cx, cy] of [
    [3, 3],
    [7, 3],
    [3, 8],
    [7, 8],
    [3, 13],
    [7, 13],
  ]) {
    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', '1.5');
    svg.appendChild(circle);
  }
  return svg;
}

function buildColorPicker(account, swatch, onSelect) {
  const picker = document.createElement('div');
  picker.className = 'color-picker';
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-label', 'Pick a color');

  const RADIUS = 36;
  const N = ACCOUNT_COLORS.length;
  ACCOUNT_COLORS.forEach((color, i) => {
    const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
    const x = Math.round(RADIUS * Math.cos(angle));
    const y = Math.round(RADIUS * Math.sin(angle));

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `color-chip${color === account.color ? ' selected' : ''}`;
    chip.style.background = color;
    chip.style.setProperty('--tx', `${x}px`);
    chip.style.setProperty('--ty', `${y}px`);
    chip.style.transitionDelay = `${i * 18}ms`;
    chip.setAttribute('aria-label', `Color ${color}`);

    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      picker.querySelectorAll('.color-chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
      closePicker(picker, swatch);
      onSelect(color);
    });

    picker.appendChild(chip);
  });
  return picker;
}

function openPicker(picker, swatch) {
  document.querySelectorAll('.color-picker.open').forEach((p) => {
    if (p !== picker) {
      const sw = p.closest('.color-picker-wrap')?.querySelector('.color-swatch');
      p.classList.remove('open');
      sw?.classList.remove('open');
    }
  });
  swatch.classList.add('open');
  picker.classList.add('open');

  const handler = (e) => {
    if (!picker.contains(e.target) && e.target !== swatch) {
      closePicker(picker, swatch);
      document.removeEventListener('click', handler, true);
    }
  };
  setTimeout(() => document.addEventListener('click', handler, true), 0);
}

function closePicker(picker, swatch) {
  swatch.classList.remove('open');
  picker.classList.remove('open');
}

function setupDragSort(list) {
  let dragging = null;
  let dragFromHandle = false;

  list.addEventListener('mousedown', (e) => {
    dragFromHandle = !!e.target.closest('.drag-handle');
  });

  for (const wrap of list.querySelectorAll('.account-row-wrap')) {
    wrap.draggable = true;

    wrap.addEventListener('dragstart', (e) => {
      if (!dragFromHandle) {
        e.preventDefault();
        return;
      }
      dragging = wrap;
      e.dataTransfer.effectAllowed = 'move';
      requestAnimationFrame(() => wrap.classList.add('dragging'));
    });

    wrap.addEventListener('dragend', async () => {
      wrap.classList.remove('dragging');
      dragging = null;
      const orderedIds = [...list.querySelectorAll('.account-row-wrap')].map(
        (w) => w.dataset.accountId,
      );
      state.accounts.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
      await sendMessage({ type: 'geething.reorderAccounts', orderedIds }).catch(() => {});
    });

    wrap.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragging || dragging === wrap) {
        return;
      }
      const rect = wrap.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        list.insertBefore(dragging, wrap);
      } else {
        list.insertBefore(dragging, wrap.nextSibling);
      }
    });
  }
}

async function renderAccountRow(account) {
  const row = document.createElement('div');
  row.className = 'account-row';

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.title = 'Drag to reorder';
  handle.appendChild(makeGripIcon());

  const swatchWrap = document.createElement('div');
  swatchWrap.className = 'color-picker-wrap';

  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'color-swatch';
  swatch.style.background = account.color || ACCOUNT_COLORS[0];
  swatch.title = 'Pick color';
  swatch.setAttribute('aria-label', 'Pick color');

  const picker = buildColorPicker(account, swatch, async (color) => {
    await sendMessage({
      type: 'geething.updateAccount',
      accountId: account.id,
      patch: { color },
    });
    account.color = color;
    swatch.style.background = color;
    flashSaved();
  });

  swatch.addEventListener('click', (e) => {
    e.stopPropagation();
    if (picker.classList.contains('open')) {
      closePicker(picker, swatch);
    } else {
      openPicker(picker, swatch);
    }
  });

  swatchWrap.append(swatch, picker);

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.value = account.label || account.email;
  labelInput.setAttribute('aria-label', `Label for ${account.email}`);
  let debounceHandle = null;
  labelInput.addEventListener('input', () => {
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(async () => {
      await sendMessage({
        type: 'geething.updateAccount',
        accountId: account.id,
        patch: { label: labelInput.value },
      });
      account.label = labelInput.value;
      flashSaved();
    }, 400);
  });

  const email = document.createElement('span');
  email.className = 'email';
  email.textContent = account.email;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-danger';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', async () => {
    const confirmed = window.confirm(`Remove ${account.email}?`);
    if (!confirmed) {
      return;
    }
    removeBtn.disabled = true;
    try {
      const result = await sendMessage({ type: 'geething.removeAccount', accountId: account.id });
      await _loadState();
      if (result?.revokeWarning) {
        showStatus(result.revokeWarning);
      }
    } catch (err) {
      showStatus(err.message || String(err));
      removeBtn.disabled = false;
    }
  });

  const muteLabel = document.createElement('label');
  muteLabel.className = 'mute-toggle';
  muteLabel.title = 'Mute notifications for this account';
  const muteInput = document.createElement('input');
  muteInput.type = 'checkbox';
  muteInput.checked = !!account.muted;
  muteInput.setAttribute('aria-label', `Mute notifications for ${account.email}`);
  muteInput.addEventListener('change', async () => {
    await sendMessage({
      type: 'geething.updateAccount',
      accountId: account.id,
      patch: { muted: muteInput.checked },
    });
    account.muted = muteInput.checked;
    flashSaved();
  });
  const muteText = document.createElement('span');
  muteText.textContent = 'Mute';
  muteLabel.append(muteInput, muteText);

  row.append(handle, swatchWrap, labelInput, email, muteLabel, removeBtn);

  const labelsRow = document.createElement('div');
  labelsRow.className = 'account-labels-row';
  const labelsCaption = document.createElement('span');
  labelsCaption.className = 'labels-caption';
  labelsCaption.textContent = 'Watch:';
  labelsRow.appendChild(labelsCaption);

  const currentLabels = account.watchedLabels?.length ? account.watchedLabels : ['INBOX'];

  const FALLBACK_LABELS = [
    { id: 'INBOX', name: 'Inbox' },
    { id: 'STARRED', name: 'Starred' },
    { id: 'IMPORTANT', name: 'Important' },
  ];
  let availableLabels;
  try {
    const result = await sendMessage({ type: 'geething.getLabels', accountId: account.id });
    availableLabels = Array.isArray(result) ? result : FALLBACK_LABELS;
  } catch {
    availableLabels = FALLBACK_LABELS;
  }

  function addLabelChip(labelId, labelName) {
    const chip = document.createElement('label');
    chip.className = 'label-chip';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = currentLabels.includes(labelId);
    cb.dataset.labelId = labelId;
    cb.addEventListener('change', async () => {
      const allCbs = labelsRow.querySelectorAll('input[type=checkbox]');
      const selected = Array.from(allCbs)
        .filter((c) => c.checked)
        .map((c) => c.dataset.labelId);
      if (!selected.length) {
        cb.checked = true;
        return;
      }
      await sendMessage({
        type: 'geething.updateAccount',
        accountId: account.id,
        patch: { watchedLabels: selected },
      });
      account.watchedLabels = selected;
      flashSaved();
    });
    const chipText = document.createElement('span');
    chipText.textContent = labelName;
    chip.append(cb, chipText);
    labelsRow.appendChild(chip);
  }

  const LABELS_INITIAL = 10;
  const LABELS_COLLAPSE_THRESHOLD = 15;
  const hidden =
    availableLabels.length > LABELS_COLLAPSE_THRESHOLD ? availableLabels.slice(LABELS_INITIAL) : [];
  const visible = hidden.length ? availableLabels.slice(0, LABELS_INITIAL) : availableLabels;

  for (const { id: labelId, name: labelName } of visible) {
    addLabelChip(labelId, labelName);
  }

  if (hidden.length) {
    const hasSelectedHidden = hidden.some(({ id }) => currentLabels.includes(id));
    const expandPill = document.createElement('button');
    expandPill.type = 'button';
    expandPill.className = 'label-expand-pill';
    expandPill.textContent = `+${hidden.length} more`;
    expandPill.addEventListener('click', () => {
      for (const { id: labelId, name: labelName } of hidden) {
        addLabelChip(labelId, labelName);
      }
      expandPill.remove();
    });
    labelsRow.appendChild(expandPill);
    if (hasSelectedHidden) {
      expandPill.click();
    }
  }

  const wrap = document.createElement('div');
  wrap.className = 'account-row-wrap';
  wrap.dataset.accountId = account.id;
  wrap.append(row, labelsRow);
  return wrap;
}

export async function renderAccounts() {
  clearNode(els.accountsList);
  if (!state.accounts.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'No accounts connected yet.';
    els.accountsList.appendChild(p);
    return;
  }
  for (const account of state.accounts) {
    els.accountsList.appendChild(await renderAccountRow(account));
  }
  setupDragSort(els.accountsList);
}
