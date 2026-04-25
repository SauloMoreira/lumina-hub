import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/login')({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Bem-vindo de volta!');
        navigate({ to: '/conta' });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name }, emailRedirectTo: `${window.location.origin}/conta` },
        });
        if (error) throw error;
        toast.success('Conta criada! Você já está logado.');
        navigate({ to: '/conta' });
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-11 h-11 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="font-display font-extrabold text-xl">Led Maricá</div>
        </Link>

        <div className="bg-card border border-border rounded-xl p-7 shadow-soft">
          <h1 className="font-display font-bold text-2xl mb-1">
            {mode === 'login' ? 'Entrar na sua conta' : 'Criar conta'}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === 'login' ? 'Acesse seus pedidos e endereços' : 'É rápido e gratuito'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1.5 h-11" />
              </div>
            )}
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5 h-11" />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="mt-1.5 h-11" />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <div className="text-center mt-6 text-sm">
            {mode === 'login' ? (
              <>Ainda não tem conta? <button onClick={() => setMode('signup')} className="text-primary font-medium hover:underline">Cadastre-se</button></>
            ) : (
              <>Já tem conta? <button onClick={() => setMode('login')} className="text-primary font-medium hover:underline">Entrar</button></>
            )}
          </div>
        </div>

        <Link to="/" className="block text-center text-xs text-muted-foreground mt-6 hover:text-foreground">← Voltar à loja</Link>
      </div>
    </div>
  );
}
