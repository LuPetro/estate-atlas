import { readFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';
export type AccountMail = {
  to: string;
  purpose: 'verify' | 'reset' | 'email' | 'notice' | 'reminder';
  token?: string;
  text?: string;
  messageId?: string;
};
export type AccountRuntime = {
  publicUrl: string;
  mail?: (message: AccountMail) => Promise<void>;
  encryptionKey?: Buffer;
  verificationRequired: boolean;
};
export async function accountRuntime(
  env: NodeJS.ProcessEnv,
  production: boolean,
): Promise<AccountRuntime> {
  const publicUrl = env.ACCOUNT_PUBLIC_URL ?? env.WEB_ORIGIN ?? 'http://localhost:3000';
  const url = new URL(publicUrl);
  if (
    (production && url.protocol !== 'https:') ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid ACCOUNT_PUBLIC_URL');
  const runtime: AccountRuntime = {
    publicUrl: url.origin,
    verificationRequired: env.ACCOUNT_REQUIRE_VERIFICATION === 'true',
  };
  if (env.ACCOUNT_ENCRYPTION_KEY_FILE) {
    const key = (await readFile(env.ACCOUNT_ENCRYPTION_KEY_FILE, 'utf8')).trim();
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid account encryption key');
    runtime.encryptionKey = Buffer.from(key, 'hex');
  }
  if (env.SMTP_HOST) {
    if (!env.SMTP_FROM) throw new Error('SMTP_FROM required');
    const password = env.SMTP_PASSWORD_FILE
      ? (await readFile(env.SMTP_PASSWORD_FILE, 'utf8')).trim()
      : undefined;
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT ?? 587),
      secure: env.SMTP_SECURE === 'true',
      requireTLS: env.SMTP_ALLOW_INSECURE !== 'true',
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: password } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (production && env.SMTP_ALLOW_INSECURE === 'true')
      throw new Error('Production SMTP requires TLS');
    runtime.mail = async (message) => {
      const titles = {
        verify: 'E-Mail-Adresse bestätigen',
        reset: 'Passwort zurücksetzen',
        email: 'Neue E-Mail-Adresse bestätigen',
        notice: 'Kontosicherheit',
        reminder: 'Deine Wiedervorlage',
      };
      // Fragment avoids putting bearer reset/verification tokens in access logs or Referer headers.
      const link = `${runtime.publicUrl}/account-action#${new URLSearchParams({ purpose: message.purpose, token: message.token ?? '' })}`;
      await transport.sendMail({
        from: env.SMTP_FROM,
        to: message.to,
        messageId: message.messageId,
        subject: `EstateAtlas · ${titles[message.purpose]}`,
        text:
          message.text ??
          `${titles[message.purpose]}\n\n${link}\n\nAlternativ in EstateAtlas den Linkcode eingeben:\n${message.token}\n\nFalls du dies nicht angefordert hast, ignoriere diese Nachricht. Gib den Code niemals an andere weiter.`,
      });
    };
  }
  if (runtime.verificationRequired && !runtime.mail)
    throw new Error('Verification requires configured mail delivery');
  if (
    production &&
    env.ESTATEATLAS_ENVIRONMENT !== 'development' &&
    (!runtime.mail || !runtime.verificationRequired)
  )
    throw new Error('Public production signup requires mail delivery and email verification');
  return runtime;
}
