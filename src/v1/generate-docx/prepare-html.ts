import * as cheerio from 'cheerio';
import { checkRemoteResource } from '../../helpers/remote-resources';
import { logger } from '../../helpers/logger';
import type { RemoteResourcesConfig } from '../../types';

/**
 * Elements dropped before conversion.
 *
 * `style` and `script` because DOCX has no use for them and they end up as
 * plain text. The rest because they pull in a document of their own, and
 * unlike the PDF renderer the converter has no request interception in front
 * of it, so an element nobody checked is an element nobody stopped. `base` is
 * in the list for a different reason: it rewrites what every relative URL in
 * the document resolves to, which would move the links out from under the
 * check below.
 */
const DROPPED_ELEMENTS =
  'style, script, iframe, frame, frameset, object, embed, link, base';

/**
 * Attributes the converter may follow, each holding one URL.
 *
 * `remove` says what to do when the URL is refused. An `img` is nothing but
 * its resource, so the element goes; `background` decorates an element that
 * holds real content, so only the attribute goes and the content stays.
 */
const URL_ATTRIBUTES: ReadonlyArray<{
  selector: string;
  attribute: string;
  remove: 'element' | 'attribute';
}> = [
  { selector: 'img[src]', attribute: 'src', remove: 'element' },
  { selector: 'image[href]', attribute: 'href', remove: 'element' },
  { selector: 'input[src]', attribute: 'src', remove: 'element' },
  { selector: '[background]', attribute: 'background', remove: 'attribute' }
];

/**
 * Turn client-supplied HTML into something safe to hand to the DOCX converter.
 *
 * Every remaining URL is checked against the same policy the PDF renderer
 * uses, and whatever may not be loaded is removed before the converter gets a
 * chance to fetch it.
 */
export async function prepareDocxHtml(
  html: string,
  policy: RemoteResourcesConfig = {}
): Promise<string> {
  const $ = cheerio.load(html);

  $(DROPPED_ELEMENTS).remove();

  await Promise.all(
    URL_ATTRIBUTES.flatMap(({ selector, attribute, remove }) =>
      $(selector)
        .toArray()
        .map(async element => {
          const url = $(element).attr(attribute);

          if (url === undefined) {
            return;
          }

          const reason = await checkRemoteResource(url, policy);

          if (reason === null) {
            return;
          }

          logger.warn(
            `Blocked a resource while rendering DOCX: ${url} (${reason})`
          );

          if (remove === 'element') {
            $(element).remove();
          } else {
            $(element).removeAttr(attribute);
          }
        })
    )
  );

  return $.html();
}
