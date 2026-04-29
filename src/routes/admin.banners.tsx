import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Wand2, Upload, Loader2, Image as ImageIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateBannerImage } from '@/server/banner.functions';

export const Route = createFileRoute('/admin/banners')({ component: BannersPage });

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_desktop: string;
  image_mobile: string | null;
  cta_label: string | null;
  cta_link: string | null;
  badge: string | null;
  bg_color: string | null;
  text_color: string | null;
  campaign_type: string;
  sort_order: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

const CAMPAIGN_TYPES = [
  { value: 'promotion', label: 'Promoção' },
  { value: 'launch', label: 'Lançamento' },
  { value: 'category', label: 'Categoria' },
  { value: 'institutional', label: 'Institucional' },
  { value: 'free_shipping', label: 'Frete grátis' },
  { value: 'discount', label: 'Desconto' },
  { value: 'seasonal', label: 'Sazonal' },
];

const emptyForm = {
  title: '',
  subtitle: '',
  description: '',
  image_desktop: '',
  image_mobile: '',
  cta_label: '',
  cta_link: '',
  badge: '',
  bg_color: '',
  text_color: '#FFFFFF',
  campaign_type: 'promotion',
  sort_order: '0',
  active: true,
  starts_at: '',
  ends_at: '',
};

async function uploadToBucket(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const unique = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`;
  const path = `banners/${Date.now()}-${unique}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

function dataUrlToFile(dataUrl: string, baseName: string): File {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('data URL inválida');
  const contentType = match[1];
  const bin = atob(match[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = (contentType.split('/')[1] || 'png').replace(/[^a-z0-9]/g, '') || 'png';
  return new File([new Blob([bytes], { type: contentType })], `${baseName}.${ext}`, { type: contentType });
}

function BannersPage() {
  const [list, setList] = useState<Banner[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('home_banners')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setList((data as Banner[]) ?? []);
  };

  useEffect(() => { void load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: String(list.length) });
    setOpen(true);
  };

  const openEdit = (b: Banner) => {
    setEditing(b);
    setForm({
      title: b.title,
      subtitle: b.subtitle ?? '',
      description: b.description ?? '',
      image_desktop: b.image_desktop,
      image_mobile: b.image_mobile ?? '',
      cta_label: b.cta_label ?? '',
      cta_link: b.cta_link ?? '',
      badge: b.badge ?? '',
      bg_color: b.bg_color ?? '',
      text_color: b.text_color ?? '#FFFFFF',
      campaign_type: b.campaign_type,
      sort_order: String(b.sort_order),
      active: b.active,
      starts_at: b.starts_at ? b.starts_at.slice(0, 16) : '',
      ends_at: b.ends_at ? b.ends_at.slice(0, 16) : '',
    });
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Título é obrigatório');
    if (!form.image_desktop.trim()) return toast.error('Imagem desktop é obrigatória');
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        description: form.description.trim() || null,
        image_desktop: form.image_desktop.trim(),
        image_mobile: form.image_mobile.trim() || null,
        cta_label: form.cta_label.trim() || null,
        cta_link: form.cta_link.trim() || null,
        badge: form.badge.trim() || null,
        bg_color: form.bg_color.trim() || null,
        text_color: form.text_color.trim() || null,
        campaign_type: form.campaign_type,
        sort_order: Number(form.sort_order) || 0,
        active: form.active,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };
      const res = editing
        ? await supabase.from('home_banners').update(payload).eq('id', editing.id)
        : await supabase.from('home_banners').insert(payload);
      if (res.error) throw new Error(res.error.message);
      toast.success(editing ? 'Banner atualizado' : 'Banner criado');
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b: Banner) => {
    if (!confirm(`Remover banner "${b.title}"?`)) return;
    const { error } = await supabase.from('home_banners').delete().eq('id', b.id);
    if (error) return toast.error(error.message);
    toast.success('Banner removido');
    await load();
  };

  const toggleActive = async (b: Banner) => {
    const { error } = await supabase.from('home_banners').update({ active: !b.active }).eq('id', b.id);
    if (error) return toast.error(error.message);
    await load();
  };

  const move = async (b: Banner, dir: 'up' | 'down') => {
    const idx = list.findIndex((x) => x.id === b.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const other = list[swapIdx];
    await Promise.all([
      supabase.from('home_banners').update({ sort_order: other.sort_order }).eq('id', b.id),
      supabase.from('home_banners').update({ sort_order: b.sort_order }).eq('id', other.id),
    ]);
    await load();
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>, target: 'desktop' | 'mobile') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Arquivo precisa ser uma imagem');
    if (file.size > 10 * 1024 * 1024) return toast.error('Imagem maior que 10MB');
    const setter = target === 'desktop' ? setUploadingDesktop : setUploadingMobile;
    setter(true);
    try {
      const url = await uploadToBucket(file);
      setForm((f) => target === 'desktop' ? { ...f, image_desktop: url } : { ...f, image_mobile: url });
      toast.success('Imagem enviada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro no upload');
    } finally {
      setter(false);
    }
  };

  const generateAi = async () => {
    if (!form.title.trim()) return toast.error('Preencha o título antes de gerar');
    setGenerating(true);
    try {
      const res = await generateBannerImage({
        data: {
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || null,
          campaignType: form.campaign_type,
        },
      });
      const file = dataUrlToFile(res.dataUrl, `banner-${Date.now()}`);
      const url = await uploadToBucket(file);
      setForm((f) => ({ ...f, image_desktop: url }));
      toast.success('Banner gerado com IA e enviado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar imagem');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AdminLayout
      title="Banners da Home"
      action={
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Novo banner
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground mb-6 -mt-4">Gerencie o carrossel principal e campanhas promocionais</p>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 w-20">Ordem</th>
              <th className="text-left px-4 py-3 w-24">Imagem</th>
              <th className="text-left px-4 py-3">Título</th>
              <th className="text-left px-4 py-3 w-32">Tipo</th>
              <th className="text-left px-4 py-3 w-24">Ativo</th>
              <th className="text-right px-4 py-3 w-40">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  Nenhum banner cadastrado. Clique em "Novo banner" para começar.
                </td>
              </tr>
            )}
            {list.map((b, i) => (
              <tr key={b.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono w-6">{b.sort_order}</span>
                    <button onClick={() => move(b, 'up')} disabled={i === 0} className="p-1 hover:bg-muted rounded disabled:opacity-30">
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button onClick={() => move(b, 'down')} disabled={i === list.length - 1} className="p-1 hover:bg-muted rounded disabled:opacity-30">
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="w-16 h-10 rounded overflow-hidden bg-muted">
                    <img src={b.image_desktop} alt={b.title} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{b.title}</div>
                  {b.subtitle && <div className="text-xs text-muted-foreground">{b.subtitle}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded bg-muted">
                    {CAMPAIGN_TYPES.find((c) => c.value === b.campaign_type)?.label ?? b.campaign_type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Switch checked={b.active} onCheckedChange={() => toggleActive(b)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(b)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar banner' : 'Novo banner'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="col-span-2">
                <Label>Subtítulo</Label>
                <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="col-span-2 border border-border rounded-lg p-3 space-y-2 bg-muted/20">
                <Label>Imagem desktop * <span className="text-xs text-muted-foreground font-normal">(ideal 1920×768)</span></Label>
                {form.image_desktop && (
                  <div className="aspect-[5/2] rounded overflow-hidden bg-muted">
                    <img src={form.image_desktop} alt="preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input
                  placeholder="URL da imagem"
                  value={form.image_desktop}
                  onChange={(e) => setForm({ ...form, image_desktop: e.target.value })}
                />
                <div className="flex gap-2">
                  <input ref={desktopInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, 'desktop')} />
                  <Button type="button" size="sm" variant="outline" onClick={() => desktopInputRef.current?.click()} disabled={uploadingDesktop}>
                    {uploadingDesktop ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                    Enviar arquivo
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={generateAi} disabled={generating}>
                    {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1.5" />}
                    Gerar com IA
                  </Button>
                </div>
              </div>

              <div className="col-span-2 border border-border rounded-lg p-3 space-y-2">
                <Label>Imagem mobile <span className="text-xs text-muted-foreground font-normal">(opcional, ideal 800×800)</span></Label>
                {form.image_mobile && (
                  <div className="aspect-square w-32 rounded overflow-hidden bg-muted">
                    <img src={form.image_mobile} alt="preview mobile" className="w-full h-full object-cover" />
                  </div>
                )}
                <Input
                  placeholder="URL da imagem mobile"
                  value={form.image_mobile}
                  onChange={(e) => setForm({ ...form, image_mobile: e.target.value })}
                />
                <input ref={mobileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, 'mobile')} />
                <Button type="button" size="sm" variant="outline" onClick={() => mobileInputRef.current?.click()} disabled={uploadingMobile}>
                  {uploadingMobile ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                  Enviar arquivo
                </Button>
              </div>

              <div>
                <Label>Texto do botão (CTA)</Label>
                <Input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} placeholder="Ver ofertas" />
              </div>
              <div>
                <Label>Link do botão</Label>
                <Input value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} placeholder="/catalogo" />
              </div>
              <div>
                <Label>Badge / Selo</Label>
                <Input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="Até 40% OFF" />
              </div>
              <div>
                <Label>Tipo de campanha</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={form.campaign_type}
                  onChange={(e) => setForm({ ...form, campaign_type: e.target.value })}
                >
                  {CAMPAIGN_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Cor de fundo (fallback)</Label>
                <Input value={form.bg_color} onChange={(e) => setForm({ ...form, bg_color: e.target.value })} placeholder="#0B1B3A" />
              </div>
              <div>
                <Label>Cor do texto</Label>
                <Input value={form.text_color} onChange={(e) => setForm({ ...form, text_color: e.target.value })} placeholder="#FFFFFF" />
              </div>
              <div>
                <Label>Início (opcional)</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <Label>Fim (opcional)</Label>
                <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
              </div>
              <div className="flex items-center gap-3 mt-6">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label>Ativo</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
