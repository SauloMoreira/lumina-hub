import { createFileRoute, useNavigate, useParams, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProductSEOSection } from '@/components/admin/ProductSEOSection';
import { ProductImageManager, type ProductImageManagerHandle } from '@/components/admin/ProductImageManager';
import { boostProductSeoAuto } from '@/server/seo.functions';

export const Route = createFileRoute('/admin/produtos/$id')({ component: ProductForm });

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

interface Cat { id: string; name: string }

function ProductForm() {
  const { id } = useParams({ strict: false }) as { id: string };
  const isNew = id === 'novo';
  const nav = useNavigate();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState<Cat[]>([]);

  const [form, setForm] = useState({
    name: '', slug: '', sku: '', brand: '', description: '',
    price: '', sale_price: '', cost_price: '',
    stock_qty: '0', stock_min_alert: '10',
    weight_kg: '0.3', length_cm: '10', width_cm: '10', height_cm: '10',
    category_id: '', active: true, featured: false,
    images: [] as string[],
    tags: '',
    seo_title: '', seo_description: '', seo_keywords: '',
  });

  useEffect(() => {
    supabase.from('categories').select('id,name').order('name').then(({ data }) => setCats((data as any) ?? []));
    if (!isNew) {
      supabase.from('products').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
        if (error || !data) { toast.error('Produto não encontrado'); nav({ to: '/admin/produtos' as any }); return; }
        setForm({
          name: data.name, slug: data.slug, sku: data.sku ?? '', brand: data.brand ?? '',
          description: data.description ?? '',
          price: String(data.price), sale_price: data.sale_price ? String(data.sale_price) : '', cost_price: data.cost_price ? String(data.cost_price) : '',
          stock_qty: String(data.stock_qty), stock_min_alert: String(data.stock_min_alert ?? 10),
          weight_kg: String(data.weight_kg ?? 0.3), length_cm: String(data.length_cm ?? 10), width_cm: String(data.width_cm ?? 10), height_cm: String(data.height_cm ?? 10),
          category_id: data.category_id ?? '', active: !!data.active, featured: !!data.featured,
          images: data.images ?? [],
          tags: (data.tags ?? []).join(', '),
          seo_title: (data as any).seo_title ?? '',
          seo_description: (data as any).seo_description ?? '',
          seo_keywords: (data as any).seo_keywords ?? '',
        });
        setLoading(false);
      });
    }
  }, [id, isNew, nav]);



  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Sincroniza products.images (legado, usado em listagens/cards) com a tabela product_images
    let imagesArray: string[] = form.images;
    if (!isNew) {
      const { data: imgs } = await supabase
        .from('product_images')
        .select('url_card, url_thumb, original_url, is_primary, sort_order')
        .eq('product_id', id)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true });
      imagesArray = (imgs ?? []).map((i) => i.url_card ?? i.url_thumb ?? i.original_url);
    }

    const payload = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      sku: form.sku || null,
      brand: form.brand || null,
      description: form.description || null,
      price: Number(form.price),
      sale_price: form.sale_price ? Number(form.sale_price) : null,
      cost_price: form.cost_price ? Number(form.cost_price) : null,
      stock_qty: Number(form.stock_qty),
      stock_min_alert: Number(form.stock_min_alert),
      weight_kg: Number(form.weight_kg),
      length_cm: Number(form.length_cm),
      width_cm: Number(form.width_cm),
      height_cm: Number(form.height_cm),
      category_id: form.category_id || null,
      active: form.active,
      featured: form.featured,
      images: imagesArray,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      seo_keywords: form.seo_keywords.trim() || null,
    } as any;
    const res = isNew
      ? await supabase.from('products').insert(payload).select('id').single()
      : await supabase.from('products').update(payload).eq('id', id);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(isNew ? 'Produto criado' : 'Produto atualizado');

    // SEO Booster automático ao criar produto novo (sem SEO preenchido)
    const newId = isNew ? (res.data as { id?: string } | null)?.id : id;
    const seoEmpty = !payload.seo_title && !payload.seo_description && !payload.seo_keywords;
    if (isNew && newId && seoEmpty) {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (accessToken) {
        toast.info('🚀 Otimizando SEO com IA em segundo plano…');
        boostProductSeoAuto({ data: { productId: newId, accessToken } })
          .then((r) => {
            if (r.ok) toast.success(`SEO turbinado: título, descrição e ${r.faqCount} FAQs gerados`);
            else toast.error(`SEO booster: ${r.error}`);
          })
          .catch((e: unknown) => toast.error(`SEO booster falhou: ${e instanceof Error ? e.message : 'erro'}`));
      }
    }

    // Após criar: vai para a tela de edição (para o usuário poder adicionar imagens)
    // Após atualizar: volta para a lista
    if (isNew && newId) {
      nav({ to: '/admin/produtos/$id' as any, params: { id: newId } as any });
    } else {
      nav({ to: '/admin/produtos' as any });
    }
  };

  if (loading) return <AdminLayout title="Carregando…"><div /></AdminLayout>;

  return (
    <AdminLayout
      title={isNew ? 'Novo produto' : 'Editar produto'}
      action={<Link to={'/admin/produtos' as any}><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button></Link>}
    >
      <form onSubmit={submit} className="grid lg:grid-cols-3 gap-6 max-w-6xl">
        <div className="lg:col-span-2 space-y-4">
          <Section title="Informações básicas">
            <Field label="Nome *"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} /></Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Slug"><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></Field>
              <Field label="SKU"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Marca"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
              <Field label="Categoria">
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Sem categoria</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Descrição"><Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Tags (separadas por vírgula)"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="led, casa, sala" /></Field>
          </Section>

          <Section title="Preços e estoque">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Preço (R$) *"><Input required type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
              <Field label="Preço promocional"><Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></Field>
              <Field label="Custo (interno)"><Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Quantidade em estoque"><Input type="number" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} /></Field>
              <Field label="Alerta de estoque baixo"><Input type="number" value={form.stock_min_alert} onChange={(e) => setForm({ ...form, stock_min_alert: e.target.value })} /></Field>
            </div>
          </Section>

          <Section title="Dimensões (para frete)">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Peso (kg)"><Input type="number" step="0.001" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} /></Field>
              <Field label="Compr. (cm)"><Input type="number" value={form.length_cm} onChange={(e) => setForm({ ...form, length_cm: e.target.value })} /></Field>
              <Field label="Larg. (cm)"><Input type="number" value={form.width_cm} onChange={(e) => setForm({ ...form, width_cm: e.target.value })} /></Field>
              <Field label="Alt. (cm)"><Input type="number" value={form.height_cm} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} /></Field>
            </div>
          </Section>

          <ProductSEOSection
            productId={isNew ? undefined : id}
            productCtx={{
              name: form.name,
              description: form.description,
              brand: form.brand,
              category: cats.find((c) => c.id === form.category_id)?.name,
              price: Number(form.price) || 0,
            }}
            slug={form.slug || slugify(form.name)}
            seoTitle={form.seo_title}
            seoDescription={form.seo_description}
            seoKeywords={form.seo_keywords}
            onChange={(field, value) => setForm((f) => ({ ...f, [field]: value }))}
          />
        </div>

        <div className="space-y-4">
          <Section title="Imagens">
            {isNew ? (
              <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-3">
                💡 Salve o produto primeiro para poder adicionar imagens.
              </p>
            ) : (
              <ProductImageManager
                productId={id}
                productName={form.name}
                brand={form.brand}
                category={cats.find((c) => c.id === form.category_id)?.name}
              />
            )}
          </Section>

          <Section title="Visibilidade">
            <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
            <div className="flex items-center justify-between"><Label>Destaque na home</Label><Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} /></div>
          </Section>

          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isNew ? 'Criar produto' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </AdminLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
