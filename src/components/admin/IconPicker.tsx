import { useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Curated list of lucide-react icons that make sense for a storefront homepage.
 * Grouped so the picker can show categories instead of dumping 1k+ icons.
 */
export const ICON_GROUPS: { label: string; icons: string[] }[] = [
  {
    label: 'Destaque & marketing',
    icons: [
      'Sparkles', 'Star', 'Heart', 'Gem', 'Gift', 'Flame', 'Rocket',
      'Sun', 'Sunrise', 'Moon', 'Award', 'Crown', 'Trophy', 'PartyPopper',
      'BadgeCheck', 'BadgePercent', 'Megaphone', 'Bell',
    ],
  },
  {
    label: 'Comércio & ofertas',
    icons: [
      'ShoppingBag', 'ShoppingCart', 'Tag', 'Tags', 'Percent', 'Ticket',
      'Wallet', 'CreditCard', 'Banknote', 'DollarSign', 'Coins',
      'Receipt', 'PiggyBank',
    ],
  },
  {
    label: 'Entrega & logística',
    icons: [
      'Truck', 'Package', 'PackageCheck', 'PackageOpen', 'Box', 'Boxes',
      'MapPin', 'Map', 'Navigation', 'Route', 'Clock', 'Timer', 'Zap',
    ],
  },
  {
    label: 'Confiança & segurança',
    icons: [
      'Shield', 'ShieldCheck', 'Lock', 'CheckCircle', 'CheckCircle2',
      'ThumbsUp', 'Handshake', 'HeartHandshake', 'Users', 'UserCheck',
    ],
  },
  {
    label: 'Bem-estar & holístico',
    icons: [
      'Leaf', 'Flower', 'Flower2', 'Sprout', 'TreePine', 'Mountain',
      'Feather', 'Wind', 'Droplet', 'Waves', 'Compass',
    ],
  },
  {
    label: 'Comunicação',
    icons: [
      'MessageCircle', 'MessageSquare', 'MessageSquareText', 'Mail',
      'Phone', 'PhoneCall', 'Send', 'Headphones', 'Mic',
    ],
  },
  {
    label: 'Navegação & ações',
    icons: [
      'ArrowRight', 'ArrowUpRight', 'ChevronRight', 'ExternalLink',
      'Search', 'Filter', 'PlayCircle', 'Play', 'BookOpen', 'Info',
      'HelpCircle', 'Eye', 'Plus',
    ],
  },
];

const ALL_ICONS: string[] = Array.from(
  new Set(ICON_GROUPS.flatMap((g) => g.icons)),
).filter((name) => typeof (Icons as any)[name] === 'function');

export function getLucideIconComponent(name?: string | null) {
  if (!name) return null;
  const Comp = (Icons as any)[name];
  return typeof Comp === 'function' ? (Comp as React.ComponentType<{ className?: string }>) : null;
}

interface IconPickerProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  allowEmoji?: boolean;
  /** Show a small inline preview to the left of the trigger */
  className?: string;
}

export function IconPicker({
  value,
  onChange,
  placeholder = 'Escolher ícone',
  allowEmoji = false,
  className,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const isEmoji = !!value && !getLucideIconComponent(value);
  const Selected = getLucideIconComponent(value);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICON_GROUPS;
    return ICON_GROUPS
      .map((g) => ({
        ...g,
        icons: g.icons.filter((n) => n.toLowerCase().includes(q)),
      }))
      .filter((g) => g.icons.length > 0);
  }, [query]);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2 min-w-0">
              {Selected ? (
                <Selected className="w-4 h-4 shrink-0" />
              ) : isEmoji ? (
                <span className="text-base leading-none">{value}</span>
              ) : (
                <span className="w-4 h-4 rounded border border-dashed shrink-0" />
              )}
              <span className="truncate text-sm">
                {value || <span className="text-muted-foreground">{placeholder}</span>}
              </span>
            </span>
            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <div className="p-2 border-b flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0 ml-1" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ícone…"
              className="h-8 border-0 shadow-none focus-visible:ring-0 px-1"
            />
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <X className="w-3.5 h-3.5 mr-1" /> Limpar
              </Button>
            )}
          </div>

          {allowEmoji && (
            <div className="p-2 border-b">
              <Input
                value={isEmoji ? value ?? '' : ''}
                onChange={(e) => onChange(e.target.value || null)}
                placeholder="Ou cole um emoji (🚚, ❤️, ✨)"
                className="h-8 text-sm"
              />
            </div>
          )}

          <ScrollArea className="h-[320px]">
            <div className="p-2 space-y-3">
              {filteredGroups.length === 0 && (
                <p className="text-xs text-muted-foreground p-3 text-center">
                  Nenhum ícone encontrado para "{query}".
                </p>
              )}
              {filteredGroups.map((group) => (
                <div key={group.label}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1.5">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {group.icons.map((name) => {
                      const Comp = getLucideIconComponent(name);
                      if (!Comp) return null;
                      const selected = value === name;
                      return (
                        <button
                          type="button"
                          key={name}
                          title={name}
                          onClick={() => {
                            onChange(name);
                            setOpen(false);
                          }}
                          className={cn(
                            'group relative aspect-square rounded-md border flex items-center justify-center hover:bg-accent transition',
                            selected
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-transparent text-foreground/80',
                          )}
                        >
                          <Comp className="w-4 h-4" />
                          {selected && (
                            <Check className="w-3 h-3 absolute top-0.5 right-0.5 text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-2 border-t text-[11px] text-muted-foreground">
            {ALL_ICONS.length} ícones curados · busca por nome (PascalCase)
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
