export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';

  const allowedTags = new Set([
    'h1','h2','h3','h4','h5','h6','p','br','hr','strong','em','b','i','u','s',
    'ul','ol','li','blockquote','code','pre','a','img','span','div',
    'table','thead','tbody','tr','th','td',
  ]);
  const allowedAttrs = new Set(['href','target','rel','src','alt','title','class','colspan','rowspan']);

  return input
    .replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (match, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!allowedTags.has(tag)) return '';
      if (match.startsWith('</')) return `</${tag}>`;

      const attrs = Array.from(rawAttrs.matchAll(/([a-zA-Z:-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g))
        .map(([, rawName, rawValue = '']) => {
          const name = rawName.toLowerCase();
          if (!allowedAttrs.has(name) || name.startsWith('on')) return '';
          const value = rawValue.replace(/^['"]|['"]$/g, '').trim();
          if ((name === 'href' || name === 'src') && !/^(?:(?:https?|mailto|tel):|\/|#)/i.test(value)) return '';
          if (name === 'target' && value !== '_blank') return '';
          const escaped = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
          return value ? ` ${name}="${escaped}"` : ` ${name}`;
        })
        .join('');

      return `<${tag}${attrs}>`;
    });
}
