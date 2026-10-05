import { defaultChromiumArgs } from './browser-pool';

describe('defaultChromiumArgs', () => {
  const saved = {
    sandbox: process.env.CHROMIUM_SANDBOX,
    blocked: process.env.CHROMIUM_BLOCKED_HOSTS
  };

  afterEach(() => {
    if (saved.sandbox === undefined) {
      delete process.env.CHROMIUM_SANDBOX;
    } else {
      process.env.CHROMIUM_SANDBOX = saved.sandbox;
    }

    if (saved.blocked === undefined) {
      delete process.env.CHROMIUM_BLOCKED_HOSTS;
    } else {
      process.env.CHROMIUM_BLOCKED_HOSTS = saved.blocked;
    }
  });

  it('should disable the sandbox by default, so a plain docker run works', () => {
    delete process.env.CHROMIUM_SANDBOX;

    expect(defaultChromiumArgs()).toContain('--no-sandbox');
    expect(defaultChromiumArgs()).toContain('--disable-setuid-sandbox');
  });

  it('should keep the sandbox when asked to', () => {
    process.env.CHROMIUM_SANDBOX = '1';

    const args = defaultChromiumArgs();

    expect(args).not.toContain('--no-sandbox');
    expect(args).not.toContain('--disable-setuid-sandbox');
  });

  it('should not pass resolver rules when no host is blocked', () => {
    delete process.env.CHROMIUM_BLOCKED_HOSTS;

    expect(
      defaultChromiumArgs().some(arg => arg.startsWith('--host-resolver-rules'))
    ).toBe(false);
  });

  it('should turn a blocked host list into resolver rules', () => {
    process.env.CHROMIUM_BLOCKED_HOSTS =
      '169.254.169.254, metadata.google.internal';

    const rules = defaultChromiumArgs().find(arg =>
      arg.startsWith('--host-resolver-rules')
    );

    expect(rules).toBe(
      '--host-resolver-rules=MAP 169.254.169.254 ~NOTFOUND,' +
        'MAP metadata.google.internal ~NOTFOUND'
    );
  });

  it('should ignore empty entries in the list', () => {
    process.env.CHROMIUM_BLOCKED_HOSTS = ',,  ,169.254.169.254,';

    const rules = defaultChromiumArgs().find(arg =>
      arg.startsWith('--host-resolver-rules')
    );

    expect(rules).toBe('--host-resolver-rules=MAP 169.254.169.254 ~NOTFOUND');
  });
});
