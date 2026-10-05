import { checkPublicHttpUrl } from './ssrf';

const blocked = async (ip: string): Promise<boolean> =>
  (await checkPublicHttpUrl(
    ip.includes(':') ? `http://[${ip}]/` : `http://${ip}/`
  )) !== null;

describe('checkPublicHttpUrl, IPv4 ranges', () => {
  it.each([
    ['10.0.0.1', 'private 10/8'],
    ['172.16.0.1', 'private 172.16/12'],
    ['172.31.255.254', 'private 172.16/12, top of the range'],
    ['192.168.1.1', 'private 192.168/16'],
    ['127.0.0.1', 'loopback 127/8'],
    ['169.254.169.254', 'link-local 169.254/16, cloud metadata'],
    ['0.0.0.0', 'this network'],
    ['100.64.0.1', 'CGNAT'],
    ['224.0.0.1', 'multicast']
  ])('should block %s (%s)', async ip => {
    await expect(blocked(ip)).resolves.toBe(true);
  });

  it.each([['8.8.8.8'], ['1.1.1.1'], ['172.32.0.1'], ['192.169.0.1']])(
    'should allow the public address %s',
    async ip => {
      await expect(blocked(ip)).resolves.toBe(false);
    }
  );
});

describe('checkPublicHttpUrl, IPv6 ranges', () => {
  it.each([
    ['::1', 'loopback'],
    ['::', 'unspecified'],
    ['fd00::1', 'unique local fd00::/8'],
    ['fc00::1', 'unique local fc00::/7'],
    ['fe80::1', 'link-local'],
    ['ff02::1', 'multicast']
  ])('should block %s (%s)', async ip => {
    await expect(blocked(ip)).resolves.toBe(true);
  });

  // The same address has several spellings and `new URL()` rewrites the dotted
  // form into hex, so each of these has to be caught on its own.
  it.each([
    ['::ffff:10.0.0.1', 'IPv4-mapped, dotted'],
    ['::ffff:0a00:0001', 'IPv4-mapped, hex, the same address'],
    ['::ffff:127.0.0.1', 'loopback mapped, dotted'],
    ['::ffff:7f00:0001', 'loopback mapped, hex'],
    ['::ffff:169.254.169.254', 'cloud metadata mapped, dotted'],
    ['::ffff:a9fe:a9fe', 'cloud metadata mapped, hex'],
    ['::10.0.0.1', 'deprecated IPv4-compatible'],
    ['2002:0a00:0001::1', '6to4 wrapping 10.0.0.1'],
    ['64:ff9b::0a00:0001', 'NAT64 wrapping 10.0.0.1'],
    // Teredo stores the relay server address plainly and the client address
    // inverted, so f5ff:fffe below is 10.0.0.1.
    ['2001:0:7f00:1:0:0:f7f7:f7f7', 'Teredo through a 127.0.0.1 relay'],
    ['2001:0:0808:0808:0:0:f5ff:fffe', 'Teredo carrying client 10.0.0.1']
  ])('should block %s (%s)', async ip => {
    await expect(blocked(ip)).resolves.toBe(true);
  });

  it('should allow Teredo when both embedded addresses are public', async () => {
    // 8.8.8.8 relay, 8.8.8.8 client (f7f7:f7f7 is 8.8.8.8 inverted).
    await expect(blocked('2001:0:0808:0808:0:0:f7f7:f7f7')).resolves.toBe(false);
  });

  it('should not mistake other 2001:: addresses for Teredo', async () => {
    await expect(blocked('2001:db8::1')).resolves.toBe(false);
  });

  it.each([
    ['2001:4860:4860::8888'],
    ['2606:4700:4700::1111'],
    ['::ffff:8.8.8.8'],
    ['2a00:1450:4001:80e::200e']
  ])('should allow the public address %s', async ip => {
    await expect(blocked(ip)).resolves.toBe(false);
  });
});

describe('checkPublicHttpUrl, schemes and names', () => {
  it('should reject a non-http scheme', async () => {
    await expect(checkPublicHttpUrl('file:///etc/passwd')).resolves.toEqual({
      status: 'badRequest',
      message: 'Only http and https URLs are allowed'
    });
  });

  it('should reject localhost and .local by name', async () => {
    await expect(blocked('localhost')).resolves.toBe(true);
    await expect(blocked('printer.local')).resolves.toBe(true);
  });

  it('should reject an unparseable URL', async () => {
    await expect(checkPublicHttpUrl('not a url')).resolves.toEqual({
      status: 'badRequest',
      message: 'Invalid URL'
    });
  });
});
