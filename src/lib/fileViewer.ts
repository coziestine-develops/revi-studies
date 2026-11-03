/** What the viewer can show for a stored file. `null` means download only. */
export type ViewerKind = 'pdf' | 'image' | 'docx' | 'pptx' | 'text';

export function viewerKindOf(mime: string): ViewerKind | null {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  if (mime === 'text/plain') return 'text';
  return null;
}

export const VIEWER_KIND_LABEL: Record<ViewerKind, string> = {
  pdf: 'PDF',
  image: 'Image',
  docx: 'Word document',
  pptx: 'PowerPoint',
  text: 'Text',
};

/* ---------- Word (.docx) ---------- */

const ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 's', 'sup', 'sub', 'br',
  'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'blockquote',
]);

/** Removed together with everything inside them, never shown as text. */
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'noscript', 'template', 'form', 'input', 'button', 'select', 'textarea']);

function safeHref(value: string): string | null {
  const trimmed = value.trim();
  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : null;
}

/**
 * Keeps only the markup a Word document needs. Scripts, event handlers, unknown tags,
 * and links to anything other than web or mail addresses are dropped. Images must be
 * embedded data, never remote URLs.
 */
export function sanitizeHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;

  const clean = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.parentNode?.removeChild(child);
        continue;
      }
      const element = child as HTMLElement;
      const tag = element.tagName.toLowerCase();

      if (DROP_WITH_CONTENT.has(tag)) {
        element.parentNode?.removeChild(element);
        continue;
      }

      if (!ALLOWED_TAGS.has(tag)) {
        // Keep the text of unknown wrappers, drop everything else.
        clean(element);
        const parent = element.parentNode;
        while (element.firstChild) parent?.insertBefore(element.firstChild, element);
        parent?.removeChild(element);
        continue;
      }

      // Read the link before the other attributes are removed.
      const href = tag === 'a' ? safeHref(element.getAttribute('href') ?? '') : null;

      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        const keep =
          (tag === 'a' && name === 'title') ||
          (tag === 'img' && (name === 'alt' || name === 'src')) ||
          ((tag === 'td' || tag === 'th') && (name === 'colspan' || name === 'rowspan'));
        if (!keep) element.removeAttribute(attribute.name);
      }

      if (tag === 'a' && href) {
        element.setAttribute('href', href);
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
      }

      if (tag === 'img') {
        const src = element.getAttribute('src') ?? '';
        if (!/^data:image\/(png|jpe?g|gif|webp);/i.test(src)) {
          element.parentNode?.removeChild(element);
          continue;
        }
      }

      clean(element);
    }
  };

  clean(template.content);
  return template.innerHTML;
}

export async function docxToHtml(buffer: ArrayBuffer): Promise<string> {
  // Loaded on first use so Word support doesn't slow down the rest of the app.
  const mammoth = await import('mammoth');
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return sanitizeHtml(result.value);
}

/* ---------- PowerPoint (.pptx) ---------- */

export interface SlideText {
  number: number;
  paragraphs: string[];
}

/**
 * The text of each slide, in order. Images, charts, and layout are not read, so this is a
 * text view, not a full rendering. The download always has the complete slides.
 */
export async function pptxSlideTexts(buffer: ArrayBuffer): Promise<SlideText[]> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .map((name) => ({ name, match: /^ppt\/slides\/slide(\d+)\.xml$/.exec(name) }))
    .filter((entry): entry is { name: string; match: RegExpExecArray } => entry.match !== null)
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]));

  const slides: SlideText[] = [];
  for (const entry of slideFiles) {
    const xml = await zip.files[entry.name].async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const paragraphs: string[] = [];
    for (const paragraph of Array.from(doc.getElementsByTagName('a:p'))) {
      const text = Array.from(paragraph.getElementsByTagName('a:t'))
        .map((run) => run.textContent ?? '')
        .join('')
        .trim();
      if (text) paragraphs.push(text);
    }
    slides.push({ number: Number(entry.match[1]), paragraphs });
  }
  return slides;
}
