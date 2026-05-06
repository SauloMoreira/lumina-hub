// Redireciona o usuário para o checkout externo (Mercado Pago) na MESMA aba.
// Evita fluxos com window.open que causavam abertura duplicada de janela.
export function redirectToExternalCheckout(url: string) {
  if (typeof window === "undefined") return;
  if (!url) return;

  // Se a app estiver dentro de um iframe (ex.: preview), tenta navegar o top.
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.assign(url);
      return;
    }
  } catch {
    // Restrições cross-origin: cai para navegação local.
  }

  window.location.assign(url);
}
