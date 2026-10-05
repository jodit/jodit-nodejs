import { prepareDocxHtml } from './prepare-html';

describe('prepareDocxHtml', () => {
  it('should keep the text and a public image', async () => {
    const html = await prepareDocxHtml(
      '<h1>Report</h1><p>Body</p><img src="https://8.8.8.8/logo.png"/>'
    );

    expect(html).toContain('<h1>Report</h1>');
    expect(html).toContain('<p>Body</p>');
    expect(html).toContain('https://8.8.8.8/logo.png');
  });

  it.each([
    ['style', '<style>body{color:red}</style>'],
    ['script', '<script>alert(1)</script>'],
    ['iframe', '<iframe src="http://127.0.0.1:9/"></iframe>'],
    ['frame', '<frame src="http://127.0.0.1:9/"/>'],
    ['object', '<object data="http://127.0.0.1:9/"></object>'],
    ['embed', '<embed src="http://127.0.0.1:9/"/>'],
    ['link', '<link rel="stylesheet" href="http://127.0.0.1:9/x.css"/>'],
    ['base', '<base href="http://169.254.169.254/"/>']
  ])('should drop the %s element', async (name, markup) => {
    const html = await prepareDocxHtml(`<p>keep</p>${markup}`);

    expect(html).toContain('<p>keep</p>');
    expect(html).not.toMatch(new RegExp(`<${name}`, 'i'));
  });

  it('should drop an image pointing at a loopback address', async () => {
    const html = await prepareDocxHtml(
      '<p>keep</p><img src="http://127.0.0.1:8082/internal.png"/>'
    );

    expect(html).toContain('<p>keep</p>');
    expect(html).not.toContain('127.0.0.1');
  });

  it('should drop an image pointing at the cloud metadata service', async () => {
    const html = await prepareDocxHtml(
      '<img src="http://169.254.169.254/latest/meta-data"/>'
    );

    expect(html).not.toContain('169.254.169.254');
  });

  it('should drop an IPv6-wrapped private address', async () => {
    const html = await prepareDocxHtml(
      '<img src="http://[::ffff:169.254.169.254]/latest/meta-data"/>'
    );

    expect(html).not.toMatch(/169\.254|a9fe/i);
  });

  it('should drop a background attribute pointing inside', async () => {
    const html = await prepareDocxHtml(
      '<table background="http://10.0.0.1/x.png"><tr><td>cell</td></tr></table>'
    );

    expect(html).toContain('cell');
    expect(html).not.toContain('10.0.0.1');
  });

  it('should honour the deny list', async () => {
    const html = await prepareDocxHtml(
      '<img src="https://8.8.8.8/secret.png"/><img src="https://8.8.8.8/ok.png"/>',
      { deny: ['*secret*'] }
    );

    expect(html).not.toContain('secret.png');
    expect(html).toContain('ok.png');
  });

  it('should keep inline data images', async () => {
    const html = await prepareDocxHtml(
      '<img src="data:image/png;base64,iVBORw0KGgo="/>'
    );

    expect(html).toContain('data:image/png;base64,');
  });
});
