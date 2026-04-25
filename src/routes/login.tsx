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

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', data.session.user.id).maybeSingle();
      throw redirect({ to: profile?.role === 'admin' ? ('/admin' as any) : '/conta' });
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const r = schema.safeParse({ email, password });
    if (r.success) { setErrors({}); return true; }
    const e: typeof errors = {};
    r.error.issues.forEach((i) => { e[i.path[0] as 'email' | 'password'] = i.message; });
    setErrors(e);
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const userId = data.user?.id;
      if (!userId) throw new Error('Sessão inválida');
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', userId).maybeSingle();
      toast.success('Bem-vindo de volta!');
      navigate({ to: profile?.role === 'admin' ? ('/admin' as any) : '/conta' });
    } catch {
      toast.error('E-mail ou senha incorretos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/conta` },
    });
    if (error) toast.error('Não foi possível conectar ao Google');
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
      <form onSubmit={handleSubmit} noValidate>
        <FieldLabel htmlFor="email">E-mail</FieldLabel>
        <input
          id="email" type="email" autoComplete="email" placeholder="seu@email.com"
          value={email} onChange={(e) => setEmail(e.target.value)}
          className={inputClass} style={inputStyle} {...inputFocusHandlers}
        />
        <FieldError message={errors.email} />

        <div className="mt-4">
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <div className="relative">
            <input
              id="password" type={showPwd ? 'text' : 'password'} autoComplete="current-password"
              placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
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

        <PrimaryButton loading={loading}>{loading ? 'Entrando...' : 'Entrar'}</PrimaryButton>
      </form>

      <Divider />
      <GoogleButton onClick={handleGoogle} />
    </AuthCard>
  );
}
