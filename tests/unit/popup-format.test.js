import { describe, expect, it } from 'vitest';
import {
  buildPlainTextDoc,
  formatPlainTextEmail,
  processEmailHtml,
} from '../../src/popup/email-format.js';

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

describe('processEmailHtml / CSP', () => {
  it('injects a Content-Security-Policy meta tag', () => {
    const result = processEmailHtml('<html><head></head><body><p>hi</p></body></html>');
    expect(result).toContain('Content-Security-Policy');
  });

  it('allows external images by default', () => {
    const result = processEmailHtml('<html><head></head><body></body></html>');
    expect(result).toContain('img-src https:');
  });

  it('blocks external images when blockExternalImages is true', () => {
    const result = processEmailHtml('<html><head></head><body></body></html>', {
      blockExternalImages: true,
    });
    expect(result).not.toContain('img-src https:');
    expect(result).toContain('img-src data: cid:');
  });

  it('blocks default-src in all modes', () => {
    const open = processEmailHtml('<html><head></head><body></body></html>');
    const strict = processEmailHtml('<html><head></head><body></body></html>', {
      blockExternalImages: true,
    });
    expect(open).toContain("default-src 'none'");
    expect(strict).toContain("default-src 'none'");
  });

  it('still rewrites links to open in a new tab', () => {
    const result = processEmailHtml(
      '<html><head></head><body><a href="https://evil.com">click</a></body></html>',
    );
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('works when the input HTML has no explicit head element', () => {
    const result = processEmailHtml('<p>bare body</p>');
    expect(result).toContain('Content-Security-Policy');
  });
});

describe('buildPlainTextDoc / CSP', () => {
  it('includes a Content-Security-Policy meta tag', () => {
    const result = buildPlainTextDoc('<p>hello</p>');
    expect(result).toContain('Content-Security-Policy');
  });

  it('allows external images by default', () => {
    const result = buildPlainTextDoc('');
    expect(result).toContain('img-src https:');
  });

  it('blocks external images when blockExternalImages is true', () => {
    const result = buildPlainTextDoc('', { blockExternalImages: true });
    expect(result).not.toContain('img-src https:');
    expect(result).toContain('img-src data: cid:');
  });

  it('blocks default-src in all modes', () => {
    expect(buildPlainTextDoc('')).toContain("default-src 'none'");
    expect(buildPlainTextDoc('', { blockExternalImages: true })).toContain("default-src 'none'");
  });
});
