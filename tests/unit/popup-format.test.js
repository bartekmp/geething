import { describe, expect, it } from 'vitest';
import { formatPlainTextEmail } from '../../src/popup/email-format.js';

describe('formatPlainTextEmail / links', () => {
  it('wraps bare URLs in anchor tags', () => {
    const html = formatPlainTextEmail('Visit https://example.com today');
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('does not double-escape URL ampersands', () => {
    const html = formatPlainTextEmail('https://example.com/search?a=1&b=2');
    expect(html).toContain('href="https://example.com/search?a=1&b=2"');
  });
});

describe('formatPlainTextEmail / markdown', () => {
  it('renders **bold** text', () => {
    expect(formatPlainTextEmail('Hello **world**')).toContain('<strong>world</strong>');
  });

  it('renders *italic* text', () => {
    expect(formatPlainTextEmail('Hello *world*')).toContain('<em>world</em>');
  });

  it('renders `inline code`', () => {
    expect(formatPlainTextEmail('Use `npm install`')).toContain('<code>npm install</code>');
  });

  it('renders ATX headings', () => {
    const html = formatPlainTextEmail('# Title\n## Sub');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<h2>Sub</h2>');
  });

  it('renders horizontal rules', () => {
    expect(formatPlainTextEmail('---')).toContain('<hr>');
    expect(formatPlainTextEmail('***')).toContain('<hr>');
  });

  it('renders unordered list items', () => {
    const html = formatPlainTextEmail('- Alpha\n- Beta');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Alpha</li>');
    expect(html).toContain('<li>Beta</li>');
    expect(html).toContain('</ul>');
  });

  it('closes list before a non-list line', () => {
    const html = formatPlainTextEmail('- Item\nDone');
    const ulClose = html.indexOf('</ul>');
    const done = html.indexOf('Done');
    expect(ulClose).toBeGreaterThan(-1);
    expect(done).toBeGreaterThan(ulClose);
  });
});

describe('formatPlainTextEmail / HTML escaping', () => {
  it('escapes < and > in non-URL text', () => {
    const html = formatPlainTextEmail('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes & outside URLs', () => {
    const html = formatPlainTextEmail('Cats & dogs');
    expect(html).toContain('&amp;');
  });
});

describe('formatPlainTextEmail / blank lines', () => {
  it('turns blank lines into <br>', () => {
    expect(formatPlainTextEmail('A\n\nB')).toContain('<br>');
  });
});
