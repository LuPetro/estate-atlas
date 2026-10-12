// Runs only against the local Mailpit preview, never against a real mailbox.
import { accountRuntime } from '../apps/api/src/account-runtime';
import { newToken } from '../apps/api/src/auth';
const runtime = await accountRuntime(
  {
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1025',
    SMTP_FROM: 'EstateAtlas preview <preview@example.test>',
    SMTP_ALLOW_INSECURE: 'true',
    ACCOUNT_PUBLIC_URL: 'http://localhost:3000',
  },
  false,
);
const token = newToken();
await runtime.mail!({ to: 'synthetic-mail-check@example.test', purpose: 'reset', token });
const response = await fetch('http://localhost:8025/api/v1/messages');
const data = (await response.json()) as { messages: { ID: string; To: { Address: string }[] }[] };
const message = data.messages.find((m) =>
  m.To.some((t) => t.Address === 'synthetic-mail-check@example.test'),
);
if (!message) throw new Error('SMTP message not found in local preview.');
const detail = (await (
  await fetch(`http://localhost:8025/api/v1/message/${message.ID}`)
).json()) as { Text: string };
if (!detail.Text.includes('/account-action#purpose=reset') || !detail.Text.includes(token))
  throw new Error('Mail action link or manual code missing.');
console.log(
  'SMTP preview passed: message delivered with fragment action link and manual code. No external mail was sent.',
);
