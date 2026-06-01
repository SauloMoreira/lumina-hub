/**
 * Tradução de mensagens de erro do Supabase Auth para PT-BR.
 *
 * O Supabase retorna mensagens em inglês — esta função casa
 * por trechos conhecidos e devolve uma versão amigável em
 * português. Quando não há correspondência, devolve um
 * fallback genérico (não vaza a string em inglês).
 *
 * Use em todos os fluxos de auth do site:
 *  - /login
 *  - /cadastro
 *  - /esqueci-senha
 *  - /reset-password
 */

const PATTERNS: Array<{ test: RegExp; msg: string }> = [
  // Credenciais
  { test: /invalid login credentials|invalid_credentials/i, msg: "E-mail ou senha incorretos. Verifique e tente novamente." },
  { test: /invalid email or password/i, msg: "E-mail ou senha incorretos." },

  // E-mail
  { test: /email not confirmed/i, msg: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada e o spam." },
  { test: /user already registered|already registered|already exists/i, msg: "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha." },
  { test: /invalid email|email.*invalid|invalid format/i, msg: "E-mail inválido. Verifique o formato." },
  { test: /email rate limit exceeded/i, msg: "Muitas mensagens enviadas para este e-mail. Aguarde alguns minutos." },
  { test: /signup is disabled|signups not allowed/i, msg: "Cadastros estão temporariamente indisponíveis." },

  // Senha
  { test: /password should be at least (\d+)/i, msg: "A senha deve ter no mínimo 6 caracteres." },
  { test: /password is too short|weak password|password.*weak/i, msg: "Senha muito curta ou fraca. Use ao menos 6 caracteres." },
  { test: /password.*pwned|leaked password/i, msg: "Esta senha foi exposta em vazamentos. Escolha outra senha." },
  { test: /same as the old password|same password/i, msg: "A nova senha deve ser diferente da anterior." },
  { test: /new password should be different/i, msg: "A nova senha deve ser diferente da anterior." },

  // Sessão / token
  { test: /token has expired|expired token|jwt expired/i, msg: "O link expirou. Solicite um novo." },
  { test: /invalid token|token.*invalid/i, msg: "Link inválido. Solicite um novo." },
  { test: /session.*not found|no session|not authenticated/i, msg: "Sessão expirada. Entre novamente." },
  { test: /refresh.*token.*invalid/i, msg: "Sessão expirada. Entre novamente." },

  // Rate limit / abuso
  { test: /too many requests|rate.?limit|too many attempts/i, msg: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
  { test: /captcha|hcaptcha|recaptcha/i, msg: "Falha na verificação de segurança. Recarregue a página e tente novamente." },

  // MFA / OAuth
  { test: /mfa.*required|aal2.*required/i, msg: "Verificação em duas etapas obrigatória." },
  { test: /invalid.*code|invalid otp/i, msg: "Código inválido. Verifique e tente novamente." },
  { test: /unsupported provider|provider.*not enabled/i, msg: "Este provedor de login não está habilitado." },

  // Rede / infra
  { test: /network|fetch failed|failed to fetch/i, msg: "Sem conexão com o servidor. Verifique sua internet e tente novamente." },
  { test: /database error|server error|internal error/i, msg: "Erro no servidor. Tente novamente em instantes." },
];

export function translateAuthError(input: unknown, fallback = "Não foi possível concluir a operação. Tente novamente."): string {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof Error
        ? input.message
        : (input as { message?: string } | null)?.message ?? "";
  if (!raw) return fallback;
  for (const p of PATTERNS) {
    if (p.test.test(raw)) return p.msg;
  }
  // Se já parece estar em PT (tem acento ou palavra-chave PT), devolve a própria.
  if (/[áéíóúâêôãõç]/i.test(raw) || /\b(senha|conta|e-mail|usuário|inválid|bloquead)\b/i.test(raw)) {
    return raw;
  }
  return fallback;
}
