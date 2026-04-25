import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div
          className="bg-card rounded-2xl px-9 py-10"
          style={{ border: '1px solid #E2E8F2', boxShadow: '0 4px 24px rgba(15,23,42,.10)' }}
        >
          <Link to="/" className="flex justify-center mb-6" aria-label="Led Maricá">
            <img src="/assets/logo-login.png" alt="Led Maricá" className="h-[72px] w-auto object-contain" />
          </Link>

          <h1 className="font-display font-bold text-[22px] text-foreground text-center mb-1.5">
            {title}
          </h1>
          <p className="text-[13px] text-text-faint text-center mb-7">{subtitle}</p>

          {children}

          {footer}

          <p className="text-center text-[10px] mt-4" style={{ color: '#CBD5E1' }}>
            Desenvolvido por SC Moreira Tech
          </p>
        </div>
      </div>
    </div>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-medium uppercase mb-1.5"
      style={{ letterSpacing: '1.5px', color: '#475569' }}
    >
      {children}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[12px] mt-1.5" style={{ color: '#DC2626' }}>{message}</p>;
}

export const inputClass =
  'w-full rounded-lg bg-card text-[14px] text-foreground placeholder:text-text-faint outline-none transition-all px-3.5 py-2.5';

export const inputStyle: React.CSSProperties = {
  border: '1.5px solid #E2E8F2',
};

export const inputFocusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#1A56DB';
    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(26,86,219,.08)';
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#E2E8F2';
    e.currentTarget.style.boxShadow = 'none';
  },
};

export function PrimaryButton({
  children,
  loading,
  type = 'submit',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type={type}
      disabled={loading || rest.disabled}
      {...rest}
      className="w-full rounded-lg text-white font-display font-semibold text-[14px] py-2.5 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      style={{ backgroundColor: '#1A56DB' }}
      onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#1348C0'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1A56DB'; }}
    >
      {loading && (
        <span className="inline-block w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      )}
      {children}
    </button>
  );
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg bg-card py-2.5 flex items-center justify-center gap-2 text-[13px] font-medium text-foreground transition-colors disabled:opacity-60"
      style={{ border: '1.5px solid #E2E8F2' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EDF1F7')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
    >
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.2C41 35.7 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z"/>
      </svg>
      Continuar com Google
    </button>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px" style={{ backgroundColor: '#E2E8F2' }} />
      <span className="text-[12px]" style={{ color: '#94A3B8' }}>ou</span>
      <div className="flex-1 h-px" style={{ backgroundColor: '#E2E8F2' }} />
    </div>
  );
}
