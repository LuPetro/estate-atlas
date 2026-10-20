import { describe, it, expect } from 'vitest';
import { accountRuntime } from './account-runtime';
describe('account configuration gates', () => {
  it('does not silently enable email or MFA without configuration', async () => {
    const runtime = await accountRuntime({}, false);
    expect(runtime.mail).toBeUndefined();
    expect(runtime.encryptionKey).toBeUndefined();
  });
  it('refuses unsafe production account URLs and unverified public signup', async () => {
    await expect(
      accountRuntime(
        { ACCOUNT_PUBLIC_URL: 'http://example.test' },
        true,
      ),
    ).rejects.toThrow();
    await expect(
      accountRuntime({ ACCOUNT_PUBLIC_URL: 'https://example.test' }, true),
    ).rejects.toThrow('Public production signup');
  });
  it('requires mail for verification and refuses plaintext production SMTP', async () => {
    await expect(accountRuntime({ ACCOUNT_REQUIRE_VERIFICATION: 'true' }, false)).rejects.toThrow(
      'Verification requires',
    );
    await expect(
      accountRuntime(
        {
          ACCOUNT_PUBLIC_URL: 'https://example.test',
          SMTP_HOST: 'smtp.example.test',
          SMTP_FROM: 'EstateAtlas <hello@example.test>',
          SMTP_ALLOW_INSECURE: 'true',
        },
        true,
      ),
    ).rejects.toThrow('requires TLS');
  });
});
