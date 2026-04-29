function escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Splits on URLs so we can linkify without double-escaping &<>" in surrounding text.
const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

function renderInline(text) {
  return text
    .split(URL_RE)
    .map((part, i) => {
      if (i % 2 === 1) {
        const url = part;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${escHtml(url)}</a>`;
      }
      return escHtml(part)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
    })
    .join('');
}

export function formatPlainTextEmail(text) {
  const lines = text.split('\n');
  const out = [];
  let inList = false;

  for (const line of lines) {
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push('<hr>');
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${renderInline(listItem[1])}</li>`);
      continue;
    }

    if (inList) {
      out.push('</ul>');
      inList = false;
    }

    if (!line.trim()) {
      out.push('<br>');
      continue;
    }

    out.push(`<p>${renderInline(line)}</p>`);
  }

  if (inList) {
    out.push('</ul>');
  }
  return out.join('');
}

export function buildPlainTextDoc(formattedHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:system-ui,sans-serif;font-size:14px;color:#202124;margin:16px;line-height:1.6;word-break:break-word}
a{color:#1a73e8}h1,h2,h3{margin:12px 0 4px}
code{background:#f5f5f5;padding:2px 4px;border-radius:3px;font-family:monospace;font-size:13px}
ul{margin:4px 0;padding-left:20px}hr{border:none;border-top:1px solid #e0e0e0;margin:10px 0}
p{margin:4px 0}
</style></head><body>${formattedHtml}</body></html>`;
}

// Adds target="_blank" / rel="noopener noreferrer" to all links in an HTML email string.
export function processEmailHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}
