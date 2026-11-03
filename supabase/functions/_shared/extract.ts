import { strFromU8, unzipSync } from 'npm:fflate@0.8.2';
import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1';

export const TEXT_MIME = 'text/plain';
export const PDF_MIME = 'application/pdf';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** File types whose text the AI tools can read. Images need OCR, which isn't available yet. */
export const READABLE_MIMES = new Set<string>([TEXT_MIME, PDF_MIME, DOCX_MIME, PPTX_MIME]);

/**
 * Returns the plain text of a reviewer file. Returns an empty string for types that
 * have no text layer (images). Throws when a file is damaged or unreadable.
 */
export async function extractFileText(data: Blob, mime: string): Promise<string> {
  if (!READABLE_MIMES.has(mime)) return '';
  const bytes = new Uint8Array(await data.arrayBuffer());

  switch (mime) {
    case TEXT_MIME:
      return normalize(new TextDecoder().decode(bytes));
    case PDF_MIME:
      return extractPdf(bytes);
    case DOCX_MIME:
      return extractDocx(bytes);
    case PPTX_MIME:
      return extractPptx(bytes);
    default:
      return '';
  }
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  // With mergePages the library returns one string. Guard against an array anyway.
  const merged: unknown = text;
  const joined = typeof merged === 'string' ? merged : (merged as string[]).join('\n\n');
  return normalize(joined);
}

function extractDocx(bytes: Uint8Array): string {
  const files = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' });
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('This Word file has no document body.');
  return normalize(xmlText(strFromU8(xml), 'w'));
}

function extractPptx(bytes: Uint8Array): string {
  const files = unzipSync(bytes, { filter: (f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.name) });
  const slides = Object.keys(files).sort((a, b) => slideNumber(a) - slideNumber(b));
  if (slides.length === 0) throw new Error('This presentation has no slides.');
  return normalize(
    slides
      .map((name) => {
        const text = normalize(xmlText(strFromU8(files[name]), 'a'));
        return text ? `Slide ${slideNumber(name)}\n${text}` : '';
      })
      .filter(Boolean)
      .join('\n\n'),
  );
}

function slideNumber(name: string): number {
  const match = /slide(\d+)\.xml$/.exec(name);
  return match ? Number(match[1]) : 0;
}

/**
 * Pulls text out of WordprocessingML (ns "w") or DrawingML (ns "a") XML.
 * Paragraph ends become newlines, tabs and line breaks are kept, and text runs are decoded.
 */
function xmlText(xml: string, ns: 'w' | 'a'): string {
  const pattern = new RegExp(
    `</${ns}:p>|<${ns}:br\\b[^>]*/>|<${ns}:tab\\b[^>]*/>|<${ns}:t(?:\\s[^>]*)?>([^<]*)</${ns}:t>`,
    'g',
  );
  let out = '';
  for (const match of xml.matchAll(pattern)) {
    if (match[1] !== undefined) {
      out += decodeEntities(match[1]);
    } else if (match[0].includes(':tab')) {
      out += '\t';
    } else {
      out += '\n';
    }
  }
  return out;
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, entity: string) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    switch (entity) {
      case 'amp': return '&';
      case 'lt': return '<';
      case 'gt': return '>';
      case 'quot': return '"';
      default: return "'";
    }
  });
}

function normalize(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
