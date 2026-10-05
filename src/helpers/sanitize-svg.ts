import * as cheerio from 'cheerio';
import Boom from '@hapi/boom';

/**
 * Elements that can run script or pull in a document of their own. `svg` is
 * served as `image/svg+xml`, so when it is opened directly it runs in the
 * origin that serves it: whatever survives here is same-origin script.
 */
const FORBIDDEN_ELEMENTS = [
  'script',
  'foreignobject',
  'iframe',
  'embed',
  'object',
  'audio',
  'video',
  'handler',
  'set',
  'animate',
  'animatetransform',
  'animatemotion'
];

/** Attributes that take a URL and are therefore worth looking into. */
const URL_ATTRIBUTES = ['href', 'xlink:href', 'src', 'from', 'to', 'values'];

const SCRIPT_URL = /^\s*(?:javascript|vbscript|data:text\/html)/i;

/** Allow inline raster data (common for embedded bitmaps) and local anchors. */
const SAFE_URL = /^\s*(?:#|data:image\/(?:png|jpe?g|gif|webp);base64,)/i;

/**
 * Strip scripting out of an uploaded SVG.
 *
 * Removes script-capable elements, every `on*` handler, `javascript:` style
 * URLs, processing instructions and references to other documents, keeping the
 * drawing itself intact. Returns the cleaned markup and whether anything had to
 * be removed.
 *
 * Throws `Boom.badRequest` for a file that declares XML entities: that is not
 * a drawing feature, and rewriting such a file is riskier than refusing it.
 */
export function sanitizeSvg(source: string): {
  svg: string;
  changed: boolean;
} {
  let changed = false;
  let text = source;

  // `<!ENTITY …>` declarations are how XML files smuggle content past a reader
  // that only looks at elements, and they are never needed by a drawing.
  if (/<!ENTITY/i.test(text)) {
    throw Boom.badRequest('SVG with entity declarations is not allowed');
  }

  // `<?xml-stylesheet href="…"?>` pulls in a stylesheet, which can carry script
  // in some renderers. Processing instructions other than the XML declaration
  // have no place in an uploaded image.
  const withoutInstructions = text.replace(
    /<\?(?!xml\s)[\s\S]*?\?>/gi,
    () => {
      changed = true;
      return '';
    }
  );

  text = withoutInstructions;

  const $ = cheerio.load(text, { xml: { xmlMode: true } });

  // SVG is parsed as XML, where tag names keep their case and selectors are
  // case-sensitive: `foreignObject` is camelCase in every real document, and
  // an attacker can spell `SCRIPT` any way they like. Compare by hand instead.
  $('*').each((_, element) => {
    if (element.type !== 'tag') {
      return;
    }

    if (FORBIDDEN_ELEMENTS.includes(element.tagName.toLowerCase())) {
      changed = true;
      $(element).remove();
    }
  });

  $('*').each((_, element) => {
    if (element.type !== 'tag') {
      return;
    }

    for (const name of Object.keys(element.attribs)) {
      const lower = name.toLowerCase();
      const value = element.attribs[name] ?? '';

      if (lower.startsWith('on')) {
        changed = true;
        $(element).removeAttr(name);
        continue;
      }

      if (!URL_ATTRIBUTES.includes(lower)) {
        continue;
      }

      if (SAFE_URL.test(value)) {
        continue;
      }

      // Anything that is not an inline image or an anchor inside the same file
      // is dropped: it is either script, or a reference that makes the image
      // phone home when it is opened.
      if (SCRIPT_URL.test(value) || /:/.test(value.split('#')[0] ?? '')) {
        changed = true;
        $(element).removeAttr(name);
      }
    }
  });

  return { svg: $.html(), changed };
}
