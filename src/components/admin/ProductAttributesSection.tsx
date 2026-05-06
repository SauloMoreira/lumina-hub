import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  Loader2,
  Plus,
  Sparkles,
  Eye,
  EyeOff,
  Filter,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminListProductAttributes,
  adminCreateProductAttribute,
  adminUpdateProductAttribute,
  adminDeleteProductAttribute,
  adminReorderProductAttributes,
  adminSuggestProductAttributes,
  type ProductAttributeRow,
  type AttributeSuggestionResult,
} from "@/server/productAttributes.functions";
import {
  ATTRIBUTE_SUGGESTIONS,
  formatAttributeDisplay,
  getSuggestion,
  type AttributeSuggestion,
} from "@/lib/productAttributes";

type Props = { productId: string };

const CUSTOM_KEY = "__custom__";

export function ProductAttributesSection({ productId }: Props) {
  const qc = useQueryClient();
  const queryKey = ["admin-product-attributes", productId];

  const listQuery = useQuery({
    queryKey,
    queryFn: () => adminListProductAttributes({ data: { productId } }),
  });

  // ---- Form de novo atributo ----
  const [selectedKey, setSelectedKey] = useState<string>("power");
  const [customKey, setCustomKey] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");

  const isCustom = selectedKey === CUSTOM_KEY;
  const presetSuggestion: AttributeSuggestion | undefined = isCustom
    ? undefined
    : getSuggestion(selectedKey);

  const formKey = isCustom ? customKey : selectedKey;
  const formLabel = isCustom ? customLabel : (presetSuggestion?.label ?? selectedKey);
  const formUnit = isCustom ? unit : unit || presetSuggestion?.unit || "";

  function resetForm() {
    setSelectedKey("power");
    setCustomKey("");
    setCustomLabel("");
    setValue("");
    setUnit("");
  }

  const createMut = useMutation({
    mutationFn: () =>
      adminCreateProductAttribute({
        data: {
          productId,
          attributeKey: formKey.trim(),
          attributeLabel: (formLabel || formKey).trim(),
          attributeValue: value.trim(),
          attributeUnit: formUnit.trim() ? formUnit.trim() : null,
          isVisible: true,
          isFilterable: false,
        },
      }),
    onSuccess: () => {
      toast.success("Atributo adicionado");
      qc.invalidateQueries({ queryKey });
      resetForm();
    },
    onError: (err: Error) => {
      if (err.message === "attribute_already_exists") {
        toast.error("Este produto já tem um atributo com essa chave.");
      } else if (err.message === "invalid_value") {
        toast.error("Valor inválido.");
      } else if (err.message === "invalid_label" || err.message === "invalid_key") {
        toast.error("Preencha rótulo e chave.");
      } else {
        toast.error("Não foi possível adicionar o atributo.");
      }
    },
  });

  const updateMut = useMutation({
    mutationFn: (vars: {
      id: string;
      attributeValue?: string;
      attributeUnit?: string | null;
      isVisible?: boolean;
      isFilterable?: boolean;
    }) => adminUpdateProductAttribute({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: () => toast.error("Não foi possível atualizar o atributo."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminDeleteProductAttribute({ data: { id } }),
    onSuccess: () => {
      toast.success("Atributo removido");
      qc.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Não foi possível remover."),
  });

  const reorderMut = useMutation({
    mutationFn: (orderedIds: string[]) =>
      adminReorderProductAttributes({ data: { productId, orderedIds } }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  // ---- Sugestões via parser ----
  const [suggestions, setSuggestions] = useState<AttributeSuggestionResult[] | null>(null);
  const [suggestSelection, setSuggestSelection] = useState<Record<string, string>>({});

  const suggestMut = useMutation({
    mutationFn: () => adminSuggestProductAttributes({ data: { productId } }),
    onSuccess: (data) => {
      setSuggestions(data);
      const initial: Record<string, string> = {};
      data.forEach((s) => {
        initial[s.key] = s.value;
      });
      setSuggestSelection(initial);
      if (data.length === 0) {
        toast.info("Nenhum atributo técnico foi identificado automaticamente.");
      }
    },
    onError: () => toast.error("Não foi possível gerar sugestões."),
  });

  const acceptSuggestionMut = useMutation({
    mutationFn: (s: AttributeSuggestionResult) =>
      adminCreateProductAttribute({
        data: {
          productId,
          attributeKey: s.key,
          attributeLabel: s.label,
          attributeValue: suggestSelection[s.key] ?? s.value,
          attributeUnit: s.unit ?? null,
          isVisible: true,
          isFilterable: false,
        },
      }),
    onSuccess: (_data, vars) => {
      toast.success(`${vars.label} adicionado`);
      setSuggestions((prev) =>
        prev ? prev.map((p) => (p.key === vars.key ? { ...p, alreadyExists: true } : p)) : prev,
      );
      qc.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      if (err.message === "attribute_already_exists") toast.info("Já existe esse atributo.");
      else toast.error("Não foi possível salvar a sugestão.");
    },
  });

  const items = listQuery.data ?? [];

  function moveItem(idx: number, direction: -1 | 1) {
    const newOrder = [...items];
    const target = idx + direction;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    reorderMut.mutate(newOrder.map((r) => r.id));
  }

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Atributos técnicos</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-prose">
            Características como potência, voltagem, temperatura de cor e proteção IP. Aparecem na
            ficha técnica do produto e ajudam o cliente a comparar.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => suggestMut.mutate()}
          disabled={suggestMut.isPending}
        >
          {suggestMut.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Sugerir atributos
        </Button>
      </div>

      {/* Sugestões */}
      {suggestions && suggestions.length > 0 && (
        <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            O sistema identificou os atributos abaixo a partir do nome e descrição. Revise antes de
            salvar.
          </p>
          <ul className="space-y-2">
            {suggestions.map((s) => {
              const hasConflict = !!s.conflict && s.conflict.length > 1;
              return (
                <li
                  key={s.key}
                  className="flex items-center gap-2 flex-wrap text-sm bg-background border rounded p-2"
                >
                  <span className="font-medium">{s.label}:</span>
                  {hasConflict ? (
                    <Select
                      value={suggestSelection[s.key] ?? s.value}
                      onValueChange={(v) =>
                        setSuggestSelection((prev) => ({ ...prev, [s.key]: v }))
                      }
                    >
                      <SelectTrigger className="h-8 w-auto min-w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {s.conflict!.map((c) => (
                          <SelectItem key={c} value={c.replace(/[A-Za-z]+$/, "")}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-muted-foreground">
                      {formatAttributeDisplay(suggestSelection[s.key] ?? s.value, s.unit)}
                    </span>
                  )}
                  {hasConflict && (
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> Vários valores
                    </Badge>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {s.alreadyExists ? (
                      <Badge variant="secondary">Já existe</Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={() => acceptSuggestionMut.mutate(s)}
                        disabled={acceptSuggestionMut.isPending}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Form novo atributo */}
      <div className="rounded-md border bg-background p-3 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Atributo</Label>
            <Select value={selectedKey} onValueChange={setSelectedKey}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTRIBUTE_SUGGESTIONS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_KEY}>Outro (personalizado)…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isCustom ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Rótulo (aparece na loja)</Label>
              <Input
                value={customLabel}
                onChange={(e) => {
                  setCustomLabel(e.target.value);
                  if (!customKey) setCustomKey(e.target.value);
                }}
                placeholder="Ex.: Tensão de entrada"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {presetSuggestion?.description ?? " "}
              </Label>
              <div className="text-xs text-muted-foreground italic h-9 flex items-center">
                Chave: <code className="ml-1">{selectedKey}</code>
              </div>
            </div>
          )}
        </div>

        {isCustom && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Chave técnica (slug)</Label>
              <Input
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="ex.: input_voltage"
              />
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Valor</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={presetSuggestion?.placeholder ?? "Valor"}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Unidade (opcional)</Label>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={presetSuggestion?.unit ?? ""}
            />
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => createMut.mutate()}
            disabled={
              createMut.isPending ||
              !value.trim() ||
              (isCustom && (!customKey.trim() || !customLabel.trim()))
            }
          >
            {createMut.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Adicionar atributo
          </Button>
        </div>
      </div>

      {/* Lista */}
      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando atributos…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Nenhum atributo técnico cadastrado ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((row, idx) => (
            <AttributeRow
              key={row.id}
              row={row}
              isFirst={idx === 0}
              isLast={idx === items.length - 1}
              onMoveUp={() => moveItem(idx, -1)}
              onMoveDown={() => moveItem(idx, 1)}
              onUpdate={(patch) => updateMut.mutate({ id: row.id, ...patch })}
              onDelete={() => {
                if (confirm(`Remover atributo "${row.attribute_label}"?`)) {
                  deleteMut.mutate(row.id);
                }
              }}
              isUpdating={updateMut.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha de atributo
// ---------------------------------------------------------------------------
type RowProps = {
  row: ProductAttributeRow;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: (patch: {
    attributeValue?: string;
    attributeUnit?: string | null;
    isVisible?: boolean;
    isFilterable?: boolean;
  }) => void;
  onDelete: () => void;
  isUpdating: boolean;
};

function AttributeRow({
  row,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onUpdate,
  onDelete,
}: RowProps) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(row.attribute_value);
  const [unit, setUnit] = useState(row.attribute_unit ?? "");

  const display = useMemo(
    () => formatAttributeDisplay(row.attribute_value, row.attribute_unit),
    [row.attribute_value, row.attribute_unit],
  );

  return (
    <li className="rounded-md border bg-background p-3 space-y-2">
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex flex-col">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            disabled={isFirst}
            onClick={onMoveUp}
            title="Mover para cima"
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            disabled={isLast}
            onClick={onMoveDown}
            title="Mover para baixo"
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{row.attribute_label}</span>
            <code className="text-[10px] text-muted-foreground">{row.attribute_key}</code>
            {!row.is_visible && (
              <Badge variant="outline" className="gap-1">
                <EyeOff className="h-3 w-3" /> Oculto
              </Badge>
            )}
            {row.is_filterable && (
              <Badge variant="secondary" className="gap-1">
                <Filter className="h-3 w-3" /> Filtrável
              </Badge>
            )}
          </div>
          {!editing ? (
            <p className="text-sm text-muted-foreground mt-0.5">{display}</p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-2 mt-2">
              <Input
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className="sm:col-span-2"
                placeholder="Valor"
              />
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unidade" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => {
                  onUpdate({
                    attributeValue: val.trim(),
                    attributeUnit: unit.trim() ? unit.trim() : null,
                  });
                  setEditing(false);
                }}
              >
                Salvar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setVal(row.attribute_value);
                  setUnit(row.attribute_unit ?? "");
                  setEditing(false);
                }}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            title="Remover"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap pl-7">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Switch
            checked={row.is_visible}
            onCheckedChange={(checked) => onUpdate({ isVisible: checked })}
          />
          <Eye className="h-3 w-3" />
          Mostrar na loja
        </label>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Switch
            checked={row.is_filterable}
            onCheckedChange={(checked) => onUpdate({ isFilterable: checked })}
          />
          <Filter className="h-3 w-3" />
          Usar como filtro
        </label>
      </div>
    </li>
  );
}
