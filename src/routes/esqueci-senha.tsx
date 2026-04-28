import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  AuthCard, FieldLabel, FieldError, inputClass, inputStyle, inputFocusHandlers, PrimaryButton,
} from '@/components/auth/AuthCard';
import { checkPasswordResetAttempt } from '@/server/auth.functions';

import { buildSeo } from '@/lib/seo';

export const Route = createFileRoute('/esqueci-senha')({
  head: () => buildSeo({ title: 'Recuperar senha', url: '/esqueci-senha', noindex: true }),
  component: ForgotPage,
});

const schema = z.object({ email: z.string().trim().email('E-mail inválido').max(255) });

function ForgotPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse({ email });
    if (!r.success) { setError(r.error.issues[0].message); return; }
    setError(undefined); setLoading(true);
    try {
      try {
        await checkPasswordResetAttempt({ data: { email } });
      } catch (rl: any) {
        toast.error(rl?.message ?? 'Muitas tentativas. Tente novamente mais tarde.');
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      toast.error(err?.message ?? 'Não foi possível enviar o e-mail');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Recuperar senha"
      subtitle="Enviaremos um link para redefinir sua senha"
      footer={
        <p className="text-center text-[12px] mt-6" style={{ color: '#94A3B8' }}>
          Lembrou a senha?{' '}
          <Link to="/login" className="font-medium" style={{ color: '#1A56DB' }}>Entrar</Link>
        </p>
      }
    >
      {sent ? (
        <div
          className="rounded-lg p-4 flex gap-3"
          style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0' }}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#059669' }} />
          <div className="text-[13px]" style={{ color: '#065F46' }}>
            Enviamos um link para seu e-mail.<br />
            Verifique também a caixa de spam.
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <input
            id="email" type="email" placeholder="seu@email.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className={inputClass} style={inputStyle} {...inputFocusHandlers}
          />
          <FieldError message={error} />
          <div className="mt-6">
            <PrimaryButton loading={loading}>
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </PrimaryButton>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
