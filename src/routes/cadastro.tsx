import { createFileRoute, Link, useNavigate, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  AuthCard, FieldLabel, FieldError, inputClass, inputStyle, inputFocusHandlers,
  PrimaryButton, GoogleButton, Divider,
} from '@/components/auth/AuthCard';
import { checkSignupAttempt } from '@/server/auth.functions';

import { buildSeo } from '@/lib/seo';
import { trackEvent } from '@/lib/tracking';

export const Route = createFileRoute('/cadastro')({
  head: () => buildSeo({ title: 'Criar conta', url: '/cadastro', noindex: true }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: '/conta' });
  },
  component: SignupPage,
});

const schema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(100),
  email: z.string().trim().email('E-mail inválido').max(255),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  path: ['confirm'], message: 'As senhas não coincidem',
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const r = schema.safeParse(form);
    if (r.success) { setErrors({}); return true; }
    const e: Record<string, string> = {};
    r.error.issues.forEach((i) => { e[i.path[0] as string] = i.message; });
    setErrors(e); return false;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      try {
        await checkSignupAttempt({ data: { email: form.email } });
      } catch (rl: any) {
        toast.error(rl?.message ?? 'Muitas tentativas. Tente novamente mais tarde.');
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: {
          data: { name: form.name, phone: form.phone || null },
          emailRedirectTo: `${window.location.origin}/conta`,
        },
      });
      if (error) throw error;
      trackEvent('sign_up', { method: 'email' });
      toast.success('Conta criada com sucesso!');
      navigate({ to: '/conta' });
    } catch (err: any) {
      toast.error(err?.message ?? 'Não foi possível criar a conta');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      const { lovable } = await import('@/integrations/lovable/index');
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: `${window.location.origin}/conta`,
      });
      if (result.error) {
        toast.error('Não foi possível conectar ao Google', {
          description: result.error.message ?? 'Tente novamente em instantes.',
        });
        return;
      }
    } catch (e: any) {
      toast.error('Não foi possível conectar ao Google', {
        description: e?.message ?? 'Erro inesperado.',
      });
    }
  };

  return (
    <AuthCard
      title="Crie sua conta"
      subtitle="É rápido e gratuito"
      footer={
        <p className="text-center text-[12px] mt-6" style={{ color: '#94A3B8' }}>
          Já tem conta?{' '}
          <Link to="/login" className="font-medium" style={{ color: '#1A56DB' }}>Entrar</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <FieldLabel htmlFor="name">Nome completo</FieldLabel>
          <input id="name" value={form.name} onChange={set('name')}
            className={inputClass} style={inputStyle} {...inputFocusHandlers} />
          <FieldError message={errors.name} />
        </div>
        <div>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <input id="email" type="email" placeholder="seu@email.com"
            value={form.email} onChange={set('email')}
            className={inputClass} style={inputStyle} {...inputFocusHandlers} />
          <FieldError message={errors.email} />
        </div>
        <div>
          <FieldLabel htmlFor="phone">Telefone (opcional)</FieldLabel>
          <input id="phone" type="tel" placeholder="(21) 99999-9999"
            value={form.phone} onChange={set('phone')}
            className={inputClass} style={inputStyle} {...inputFocusHandlers} />
          <FieldError message={errors.phone} />
        </div>
        <div>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <div className="relative">
            <input id="password" type={showPwd ? 'text' : 'password'} placeholder="••••••••"
              value={form.password} onChange={set('password')}
              className={inputClass + ' pr-10'} style={inputStyle} {...inputFocusHandlers} />
            <button type="button" onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-foreground"
              aria-label="Mostrar/ocultar senha">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <FieldError message={errors.password} />
        </div>
        <div>
          <FieldLabel htmlFor="confirm">Confirmar senha</FieldLabel>
          <input id="confirm" type={showPwd ? 'text' : 'password'} placeholder="••••••••"
            value={form.confirm} onChange={set('confirm')}
            className={inputClass} style={inputStyle} {...inputFocusHandlers} />
          <FieldError message={errors.confirm} />
        </div>

        <div className="pt-2">
          <PrimaryButton loading={loading}>{loading ? 'Entrando...' : 'Criar minha conta'}</PrimaryButton>
        </div>
      </form>

      <Divider />
      <GoogleButton onClick={handleGoogle} />
    </AuthCard>
  );
}
