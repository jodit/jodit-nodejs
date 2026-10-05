import { checkRemoteResource, matchesMask } from './remote-resources';

describe('matchesMask', () => {
  it('should match a prefix mask', () => {
    expect(
      matchesMask('https://cdn.example.com/logo.png', [
        'https://cdn.example.com/*'
      ])
    ).toBe(true);
  });

  it('should not match a different host with the same suffix', () => {
    expect(
      matchesMask('https://evil.com/cdn.example.com/x', [
        'https://cdn.example.com/*'
      ])
    ).toBe(false);
  });

  it('should treat dots literally', () => {
    expect(
      matchesMask('https://cdnXexample.com/a', ['https://cdn.example.com/*'])
    ).toBe(false);
  });
});

describe('checkRemoteResource', () => {
  // Public IP literals keep these checks away from real DNS: the guard only
  // resolves a host, it never fetches anything.
  it('should allow a public URL by default', async () => {
    await expect(
      checkRemoteResource('https://8.8.8.8/logo.png')
    ).resolves.toBeNull();
  });

  it('should block the cloud metadata service', async () => {
    await expect(
      checkRemoteResource(
        'http://169.254.169.254/openstack/latest/meta_data.json'
      )
    ).resolves.toMatch(/private or local/i);
  });

  it('should block loopback', async () => {
    await expect(
      checkRemoteResource('http://127.0.0.1:8082/')
    ).resolves.toMatch(/private or local/i);
  });

  it('should block localhost by name', async () => {
    await expect(checkRemoteResource('http://localhost/')).resolves.toMatch(
      /not allowed/i
    );
  });

  it('should block the file scheme', async () => {
    await expect(checkRemoteResource('file:///etc/passwd')).resolves.toMatch(
      /scheme/i
    );
  });

  it('should allow inline data images', async () => {
    await expect(
      checkRemoteResource('data:image/png;base64,iVBORw0KGgo=')
    ).resolves.toBeNull();
  });

  it('should allow about:blank, the starting document', async () => {
    await expect(checkRemoteResource('about:blank')).resolves.toBeNull();
  });

  it('should honour the deny list for an otherwise public URL', async () => {
    await expect(
      checkRemoteResource('https://8.8.8.8/secret.png', {
        deny: ['https://8.8.8.8/secret*']
      })
    ).resolves.toMatch(/deny list/i);
  });

  it('should load nothing outside a non-empty allow list', async () => {
    await expect(
      checkRemoteResource('https://1.1.1.1/logo.png', {
        allow: ['https://8.8.8.8/*']
      })
    ).resolves.toMatch(/allow list/i);

    await expect(
      checkRemoteResource('https://8.8.8.8/logo.png', {
        allow: ['https://8.8.8.8/*']
      })
    ).resolves.toBeNull();
  });

  it('should check the deny list before the allow list', async () => {
    await expect(
      checkRemoteResource('https://8.8.8.8/secret.png', {
        allow: ['https://8.8.8.8/*'],
        deny: ['*secret*']
      })
    ).resolves.toMatch(/deny list/i);
  });

  it('should reach private hosts only when explicitly allowed', async () => {
    await expect(
      checkRemoteResource('http://127.0.0.1:8082/', {
        allowPrivateNetwork: true
      })
    ).resolves.toBeNull();
  });

  it('should still refuse the file scheme when private hosts are allowed', async () => {
    await expect(
      checkRemoteResource('file:///etc/passwd', { allowPrivateNetwork: true })
    ).resolves.toMatch(/scheme/i);
  });
});
