import { Link } from '@tanstack/react-router';
import { MessageCircle, Instagram, Facebook } from 'lucide-react';
import { STORE_NAME, STORE_WHATSAPP } from '@/lib/domain';
import logoFooter from '@/assets/logo-footer.jpg';

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground mt-24">
      <div className="container mx-auto px-4 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Marca */}
          <div className="col-span-2 md:col-span-1">
            <div className="bg-white rounded-lg p-3 inline-block mb-4">
              <img src={logoFooter} alt={STORE_NAME} className="w-44 h-auto object-contain" />
            </div>
            <p className="text-sm text-primary-foreground/80 leading-relaxed mb-4">
              Qualidade que ilumina o seu projeto.
            </p>
            <a
              href={`https://wa.me/${STORE_WHATSAPP}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
            >
              <MessageCircle className="w-4 h-4" /> (21) 98212-6467
            </a>
            <div className="flex gap-3 mt-4">
              <a href="#" aria-label="Instagram" className="w-9 h-9 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 flex items-center justify-center transition-colors">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" aria-label="Facebook" className="w-9 h-9 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 flex items-center justify-center transition-colors">
                <Facebook className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-display font-semibold text-sm mb-4 uppercase tracking-wider text-primary-foreground/60">Links</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/catalogo" className="hover:underline">Catálogo</Link></li>
              <li><Link to="/" className="hover:underline">Promoções</Link></li>
              <li><Link to="/" className="hover:underline">Sobre nós</Link></li>
              <li><Link to="/" className="hover:underline">Contato</Link></li>
            </ul>
          </div>

          {/* Categorias */}
          <div>
            <h4 className="font-display font-semibold text-sm mb-4 uppercase tracking-wider text-primary-foreground/60">Categorias</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/catalogo" search={{ cat: 'iluminacao-led' } as any} className="hover:underline">Iluminação LED</Link></li>
              <li><Link to="/catalogo" search={{ cat: 'disjuntores' } as any} className="hover:underline">Disjuntores</Link></li>
              <li><Link to="/catalogo" search={{ cat: 'fios-e-cabos' } as any} className="hover:underline">Fios e Cabos</Link></li>
              <li><Link to="/catalogo" search={{ cat: 'refletores' } as any} className="hover:underline">Refletores</Link></li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="font-display font-semibold text-sm mb-4 uppercase tracking-wider text-primary-foreground/60">Informações</h4>
            <p className="text-xs text-primary-foreground/70 mb-3">Pagamento seguro · até 12x sem juros</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {['Visa', 'Master', 'PIX', 'Boleto'].map((p) => (
                <span key={p} className="text-[10px] font-bold bg-primary-foreground/10 px-2 py-1 rounded">{p}</span>
              ))}
            </div>
            <p className="text-xs text-primary-foreground/70">Maricá — RJ</p>
          </div>
        </div>

        <div className="border-t border-primary-foreground/15 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-primary-foreground/70">
          <div>© 2025 {STORE_NAME} · Maricá / RJ</div>
          <div>Desenvolvido por <span className="font-semibold text-primary-foreground">SC Moreira Tech</span></div>
        </div>
      </div>
    </footer>
  );
}
