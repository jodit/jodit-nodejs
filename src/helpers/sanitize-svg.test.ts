import { sanitizeSvg } from './sanitize-svg';

describe('sanitizeSvg', () => {
  it('should strip an onload handler', () => {
    const { svg, changed } = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)"></svg>'
    );

    expect(changed).toBe(true);
    expect(svg).not.toMatch(/onload/i);
    expect(svg).not.toMatch(/alert/);
  });

  it('should strip every event handler, not just onload', () => {
    const { svg } = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<rect onmouseover="steal()" onfocus="steal()" width="10" height="10"/>' +
        '</svg>'
    );

    expect(svg).not.toMatch(/onmouseover|onfocus|steal/i);
    expect(svg).toMatch(/<rect/);
    expect(svg).toMatch(/width="10"/);
  });

  it('should remove script and foreignObject elements', () => {
    const { svg, changed } = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<script>alert(1)</script>' +
        '<foreignObject><body xmlns="http://www.w3.org/1999/xhtml">x</body></foreignObject>' +
        '<circle r="5"/>' +
        '</svg>'
    );

    expect(changed).toBe(true);
    expect(svg).not.toMatch(/script|foreignObject|alert/i);
    expect(svg).toMatch(/<circle/);
  });

  it('should drop javascript: links but keep the drawing', () => {
    const { svg } = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<a href="javascript:alert(1)"><path d="M0 0 L10 10"/></a>' +
        '</svg>'
    );

    expect(svg).not.toMatch(/javascript:/i);
    expect(svg).toMatch(/M0 0 L10 10/);
  });

  it('should drop references to other documents', () => {
    const { svg } = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<use xlink:href="http://169.254.169.254/latest/user-data"/>' +
        '</svg>'
    );

    expect(svg).not.toMatch(/169\.254\.169\.254/);
  });

  it('should keep local anchors and inline raster images', () => {
    const inline =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const { svg, changed } = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        `<image href="${inline}" width="1" height="1"/>` +
        '<use href="#icon"/>' +
        '</svg>'
    );

    expect(changed).toBe(false);
    expect(svg).toContain('data:image/png;base64,');
    expect(svg).toContain('href="#icon"');
  });

  it('should report no change for a plain drawing', () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>';

    const { changed } = sanitizeSvg(source);

    expect(changed).toBe(false);
  });
});
