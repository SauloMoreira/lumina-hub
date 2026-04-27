import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      'h1','h2','h3','h4','h5','h6','p','br','hr','strong','em','b','i','u','s',
      'ul','ol','li','blockquote','code','pre','a','img','span','div',
      'table','thead','tbody','tr','th','td',
    ],
    ALLOWED_ATTR: ['href','target','rel','src','alt','title','class','colspan','rowspan'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/|#)/i,
  });
}
