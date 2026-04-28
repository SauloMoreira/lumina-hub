import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { enforceRateLimit, getClientIdentifier, logSecurityEvent } from '@/server/security/rateLimit';

/**
 * Verifica rate limit antes de tentar login. Lança 429 se excedido.
 * Deve ser chamada do client antes de supabase.auth.signInWithPassword.
 */
export const checkLoginAttempt = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ email: z.string().trim().email().max(255) }))
  .handler(async ({ data }) => {
    const ip = getClientIdentifier();
    // Bloqueia por e-mail (proteção a brute force) e por IP (proteção contra varredura)
    await enforceRateLimit(`email:${data.email.toLowerCase()}`, 'login');
    await enforceRateLimit(`ip:${ip}`, 'login', { maxAttempts: 30, windowSeconds: 15 * 60 });
    return { ok: true };
  });

/**
 * Registra falha de autenticação para auditoria.
 */
export const recordAuthFailure = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    email: z.string().trim().email().max(255).optional(),
    reason: z.string().max(200).optional(),
  }))
  .handler(async ({ data }) => {
    const ip = getClientIdentifier();
    await logSecurityEvent({
      type: 'auth_failure',
      severity: 'warn',
      identifier: `ip:${ip}`,
      message: data.reason ?? 'login failed',
      metadata: { email: data.email ?? null, ip },
    });
    return { ok: true };
  });

/**
 * Rate limit para signup.
 */
export const checkSignupAttempt = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ email: z.string().trim().email().max(255) }))
  .handler(async ({ data }) => {
    const ip = getClientIdentifier();
    await enforceRateLimit(`email:${data.email.toLowerCase()}`, 'signup');
    await enforceRateLimit(`ip:${ip}`, 'signup', { maxAttempts: 10, windowSeconds: 60 * 60 });
    return { ok: true };
  });

/**
 * Rate limit para password reset.
 */
export const checkPasswordResetAttempt = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ email: z.string().trim().email().max(255) }))
  .handler(async ({ data }) => {
    const ip = getClientIdentifier();
    await enforceRateLimit(`email:${data.email.toLowerCase()}`, 'password_reset');
    await enforceRateLimit(`ip:${ip}`, 'password_reset', { maxAttempts: 10, windowSeconds: 60 * 60 });
    return { ok: true };
  });
