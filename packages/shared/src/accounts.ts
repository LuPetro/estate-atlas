import { z } from 'zod';
export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const passwordSchema = z.string().min(12, 'Mindestens 12 Zeichen').max(128);
export const securityInputSchema = z
  .object({ password: passwordSchema, code: z.string().trim().max(80).default('') })
  .strict();
export const tokenInputSchema = z.object({ token: z.string().min(20).max(128) }).strict();
export const profileInputSchema = z.object({ name: z.string().trim().min(2).max(80) }).strict();
export const platformRoles = ['user', 'support', 'admin'] as const;
export type PlatformRole = (typeof platformRoles)[number];
export type AccountInfo = {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  status: 'active' | 'suspended';
  emailVerifiedAt: string | null;
  pendingEmail: string | null;
  mfaEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};
export type AccountConfig = {
  mailEnabled: boolean;
  verificationRequired: boolean;
  mfaAvailable: boolean;
};
export type AccountSession = {
  id: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  current: boolean;
};
export type AdminUser = AccountInfo & { properties: number; shared: number; sessions: number };
export type AuditEvent = {
  id: string;
  actorId: string | null;
  targetId: string | null;
  action: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};
export type AdminOverview = {
  users: number;
  suspended: number;
  unverified: number;
  mailEnabled: boolean;
};
export const forgotPasswordInputSchema = z.object({ email: emailSchema }).strict();
export const resetPasswordInputSchema = tokenInputSchema.extend({ password: passwordSchema });
export const changeEmailInputSchema = securityInputSchema.extend({ email: emailSchema });
export const changePasswordInputSchema = securityInputSchema.extend({
  newPassword: passwordSchema,
});
export const confirmMfaInputSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
export const deleteAccountInputSchema = securityInputSchema.extend({
  confirmation: z.literal('KONTO LÖSCHEN'),
});
export const transferOwnerInputSchema = securityInputSchema.extend({ userId: z.uuid() });
export const adminActionInputSchema = securityInputSchema.extend({
  action: z.enum([
    'suspend',
    'restore',
    'revoke-sessions',
    'resend-verification',
    'reset-password',
    'role',
    'delete',
  ]),
  role: z.enum(platformRoles).optional(),
  reason: z.string().trim().min(5).max(500),
  confirmation: z.string().max(80).optional(),
});
export const auditQuerySchema = z
  .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
  .strict();
export const adminUserQuerySchema = auditQuerySchema.extend({
  query: z.string().max(254).default(''),
  status: z.enum(['active', 'suspended']).optional(),
  verified: z.enum(['yes', 'no']).optional(),
});
