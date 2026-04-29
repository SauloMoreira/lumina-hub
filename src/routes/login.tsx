import { createFileRoute, Link, useNavigate, redirect } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  AuthCard, FieldLabel, FieldError, inputClass, inputStyle, inputFocusHandlers,
  PrimaryButton, GoogleButton, Divider,
} from '@/components/auth/AuthCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { checkLoginAttempt, recordAuthFailure } from '@/server/auth.functions';

import { buildSeo } from '@/lib/seo';

export const Route = createFileRoute('/login')({
  head: () => buildSeo({ title: 'Entrar na sua conta', url: '/login', noindex: true }),
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === 'string'
      ? { redirect: search.redirect }
      : {},
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      if (search.redirect) {
        throw redirect({ to: search.redirect as never });
      }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', data.session.user.id).maybeSingle();
      throw redirect({ to: profile?.role === 'admin' ? '/admin' : '/conta' });
    }
  },
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email('E-mail inválido').max(255),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (values: { email: string; password: string }) => {
    const r = schema.safeParse(values);
    if (r.success) { setErrors({}); return true; }
    const e: typeof errors = {};
    r.error.issues.forEach((i) => { e[i.path[0] as 'email' | 'password'] = i.message; });
    setErrors(e);
    return false;
  };

  const showAuthError = (message: string) => {
    setAuthError(message);
    toast.error(message);
  };

  const handleSubmit = async () => {
    if (loading) return;
    setAuthError(null);
    const nextEmail = emailRef.current?.value ?? email;
    const nextPassword = passwordRef.current?.value ?? password;
    setEmail(nextEmail);
    setPassword(nextPassword);
    if (!validate({ email: nextEmail, password: nextPassword })) {
      showAuthError('Confira os campos antes de continuar.');
      return;
    }
    setLoading(true);
    try {
      // Pré-checagem de rate limit (server-side) — não bloqueia em caso de falha de rede
      try {
        await checkLoginAttempt({ data: { email: nextEmail } });
      } catch (rlErr: unknown) {
        if (rlErr instanceof Response && rlErr.status === 429) {
          showAuthError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
          setLoading(false);
          return;
        }
        // Erro de rede no rate-limit não deve impedir login
        console.warn('Rate limit check falhou, prosseguindo:', rlErr);
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: nextEmail, password: nextPassword });
      if (error) {
        void recordAuthFailure({ data: { email: nextEmail, reason: error.message } }).catch(() => {});
        const msg = error.message?.toLowerCase() ?? '';
        if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
          showAuthError('E-mail ou senha incorretos. Verifique e tente novamente.');
        } else if (msg.includes('email not confirmed')) {
          showAuthError('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.');
        } else if (msg.includes('too many') || msg.includes('rate')) {
          showAuthError('Muitas tentativas. Aguarde alguns minutos.');
        } else {
          showAuthError(error.message || 'Não foi possível entrar. Tente novamente.');
        }
        return;
      }
      const userId = data.user?.id;
      if (!userId) {
        showAuthError('Sessão inválida. Tente novamente.');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', userId).maybeSingle();
      toast.success('Bem-vindo de volta!');
      if (redirectTo) {
        navigate({ to: redirectTo as never });
      } else {
        navigate({ to: profile?.role === 'admin' ? '/admin' : '/conta' });
      }
    } catch (err) {
      console.error('Login error:', err);
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao entrar.';
      showAuthError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void handleSubmit();
  };

  const handleGoogle = async () => {
    try {
      const { lovable } = await import('@/integrations/lovable/index');
      const loginUrl = redirectTo
        ? `${window.location.origin}/login?redirect=${encodeURIComponent(redirectTo)}`
        : `${window.location.origin}/login`;
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: loginUrl,
      });
      if (result.error) {
        toast.error('Não foi possível conectar ao Google', {
          description: result.error.message ?? 'Tente novamente em instantes.',
        });
        return;
      }
      if (result.redirected) return;
      navigate({ to: redirectTo || '/' });
    } catch (e: any) {
      toast.error('Não foi possível conectar ao Google', {
        description: e?.message ?? 'Erro inesperado.',
      });
    }
  };

  return (
    <AuthCard
      title="Bem-vindo de volta"
      subtitle="Acesse sua conta para continuar"
      footer={
        <p className="text-center text-[12px] mt-6" style={{ color: '#94A3B8' }}>
          Não tem conta?{' '}
          <Link to={'/cadastro' as any} className="font-medium" style={{ color: '#1A56DB' }}>
            Cadastre-se
          </Link>
        </p>
      }
    >
      <div role="form" onKeyDown={handleEnter}>
        {authError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        )}

        <FieldLabel htmlFor="email">E-mail</FieldLabel>
        <input
          ref={emailRef}
          id="email" name="email" type="email" autoComplete="email" placeholder="seu@email.com"
          value={email} onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
          className={inputClass} style={inputStyle} {...inputFocusHandlers}
        />
        <FieldError message={errors.email} />

        <div className="mt-4">
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <div className="relative">
            <input
              ref={passwordRef}
              id="password" name="password" type={showPwd ? 'text' : 'password'} autoComplete="current-password"
              placeholder="••••••••"
              value={password} onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
              className={inputClass + ' pr-10'} style={inputStyle} {...inputFocusHandlers}
            />
            <button
              type="button" onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-foreground"
              aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <FieldError message={errors.password} />
        </div>

        <div className="text-right mt-1.5 mb-6">
          <Link to={'/esqueci-senha' as any} className="text-[12px]" style={{ color: '#1A56DB' }}>
            Esqueci minha senha
          </Link>
        </div>

        <PrimaryButton type="button" loading={loading} onClick={() => void handleSubmit()}>
          {loading ? 'Entrando...' : 'Entrar'}
        </PrimaryButton>
      </div>

      <Divider />
      <GoogleButton onClick={handleGoogle} />
    </AuthCard>
  );
}
