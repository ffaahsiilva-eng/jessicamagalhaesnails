import { useState, useEffect } from "react";
import { Palette, Loader2, Save, RotateCcw, Sparkles, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettingsAdmin } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const defaultTheme = {
  theme_primary_h: "14",
  theme_primary_s: "55",
  theme_primary_l: "48",
  theme_accent_h: "18",
  theme_accent_s: "60",
  theme_accent_l: "60",
  theme_background_h: "30",
  theme_background_s: "25",
  theme_background_l: "98",
};

const colorLabels: Record<string, string> = {
  theme_primary: "Cor Primária (Botões e links)",
  theme_accent: "Cor de Destaque (Highlights)",
  theme_background: "Cor de Fundo (Base do site)",
};

// Curated palettes — primary, accent, background HSL components
type Palette = {
  id: string;
  name: string;
  description: string;
  values: typeof defaultTheme;
};

const palettes: Palette[] = [
  {
    id: "terracota",
    name: "Terracota",
    description: "Quente e elegante",
    values: { theme_primary_h: "14", theme_primary_s: "55", theme_primary_l: "48", theme_accent_h: "18", theme_accent_s: "60", theme_accent_l: "60", theme_background_h: "30", theme_background_s: "25", theme_background_l: "98" },
  },
  {
    id: "dourado",
    name: "Dourado",
    description: "Luxo clássico",
    values: { theme_primary_h: "42", theme_primary_s: "65", theme_primary_l: "52", theme_accent_h: "38", theme_accent_s: "70", theme_accent_l: "65", theme_background_h: "40", theme_background_s: "30", theme_background_l: "98" },
  },
  {
    id: "rose",
    name: "Rosé",
    description: "Romântico",
    values: { theme_primary_h: "350", theme_primary_s: "50", theme_primary_l: "55", theme_accent_h: "340", theme_accent_s: "55", theme_accent_l: "70", theme_background_h: "350", theme_background_s: "30", theme_background_l: "98" },
  },
  {
    id: "esmeralda",
    name: "Esmeralda",
    description: "Sofisticado e fresco",
    values: { theme_primary_h: "160", theme_primary_s: "55", theme_primary_l: "38", theme_accent_h: "150", theme_accent_s: "50", theme_accent_l: "55", theme_background_h: "160", theme_background_s: "20", theme_background_l: "98" },
  },
  {
    id: "lavanda",
    name: "Lavanda",
    description: "Suave e moderno",
    values: { theme_primary_h: "265", theme_primary_s: "45", theme_primary_l: "55", theme_accent_h: "280", theme_accent_s: "50", theme_accent_l: "70", theme_background_h: "270", theme_background_s: "25", theme_background_l: "98" },
  },
  {
    id: "marinho",
    name: "Azul Marinho",
    description: "Profissional",
    values: { theme_primary_h: "215", theme_primary_s: "60", theme_primary_l: "40", theme_accent_h: "200", theme_accent_s: "65", theme_accent_l: "55", theme_background_h: "210", theme_background_s: "20", theme_background_l: "98" },
  },
  {
    id: "bronze",
    name: "Bronze",
    description: "Quente e moderno",
    values: { theme_primary_h: "25", theme_primary_s: "60", theme_primary_l: "42", theme_accent_h: "30", theme_accent_s: "65", theme_accent_l: "58", theme_background_h: "30", theme_background_s: "25", theme_background_l: "98" },
  },
  {
    id: "vinho",
    name: "Vinho",
    description: "Intenso e elegante",
    values: { theme_primary_h: "345", theme_primary_s: "60", theme_primary_l: "32", theme_accent_h: "350", theme_accent_s: "55", theme_accent_l: "55", theme_background_h: "345", theme_background_s: "20", theme_background_l: "98" },
  },
  {
    id: "preto",
    name: "Preto & Ouro",
    description: "Premium luxuoso",
    values: { theme_primary_h: "0", theme_primary_s: "0", theme_primary_l: "12", theme_accent_h: "42", theme_accent_s: "70", theme_accent_l: "55", theme_background_h: "0", theme_background_s: "0", theme_background_l: "98" },
  },
  {
    id: "menta",
    name: "Menta",
    description: "Fresco e limpo",
    values: { theme_primary_h: "165", theme_primary_s: "45", theme_primary_l: "45", theme_accent_h: "175", theme_accent_s: "50", theme_accent_l: "60", theme_background_h: "170", theme_background_s: "20", theme_background_l: "98" },
  },
  {
    id: "champagne",
    name: "Champagne",
    description: "Suave e neutro",
    values: { theme_primary_h: "35", theme_primary_s: "40", theme_primary_l: "55", theme_accent_h: "30", theme_accent_s: "50", theme_accent_l: "70", theme_background_h: "40", theme_background_s: "30", theme_background_l: "99" },
  },
  {
    id: "coral",
    name: "Coral",
    description: "Vibrante e jovem",
    values: { theme_primary_h: "8", theme_primary_s: "75", theme_primary_l: "58", theme_accent_h: "20", theme_accent_s: "80", theme_accent_l: "68", theme_background_h: "20", theme_background_s: "30", theme_background_l: "99" },
  },
];

const ThemeColorManager = () => {
  const { toast } = useToast();
  const { settings, isLoading, updateSetting } = useSiteSettingsAdmin();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const themeSettings = settings.filter((s) => s.category === "theme");
    const values: Record<string, string> = {};
    themeSettings.forEach((s) => {
      values[s.key] = s.value;
    });
    setLocalValues(values);
  }, [settings]);

  const getValue = (key: string): number => {
    return parseInt(localValues[key] || defaultTheme[key as keyof typeof defaultTheme] || "50", 10);
  };

  const handleChange = (key: string, value: number) => {
    const next = { ...localValues, [key]: String(value) };
    setLocalValues(next);
    setHasChanges(true);
    applyThemePreview(next);
  };

  const applyThemePreview = (values: Record<string, string>) => {
    const root = document.documentElement;
    const h = values.theme_primary_h || defaultTheme.theme_primary_h;
    const s = values.theme_primary_s || defaultTheme.theme_primary_s;
    const l = values.theme_primary_l || defaultTheme.theme_primary_l;
    root.style.setProperty("--primary", `${h} ${s}% ${l}%`);
    root.style.setProperty("--ring", `${h} ${s}% ${l}%`);

    const ah = values.theme_accent_h || defaultTheme.theme_accent_h;
    const as = values.theme_accent_s || defaultTheme.theme_accent_s;
    const al = values.theme_accent_l || defaultTheme.theme_accent_l;
    root.style.setProperty("--accent", `${ah} ${as}% ${al}%`);
    root.style.setProperty("--rose-gold", `${ah} ${as}% ${al}%`);

    const bh = values.theme_background_h || defaultTheme.theme_background_h;
    const bs = values.theme_background_s || defaultTheme.theme_background_s;
    const bl = values.theme_background_l || defaultTheme.theme_background_l;
    root.style.setProperty("--background", `${bh} ${bs}% ${bl}%`);
  };

  const applyPalette = (palette: Palette) => {
    setLocalValues(palette.values);
    setHasChanges(true);
    applyThemePreview(palette.values);
    toast({ title: `Paleta "${palette.name}" aplicada`, description: "Clique em Salvar para confirmar" });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const promises = Object.entries(localValues).map(([key, value]) =>
        updateSetting(key, value)
      );
      await Promise.all(promises);
      setHasChanges(false);
      toast({ title: "Cores do tema salvas!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLocalValues(defaultTheme);
    setHasChanges(true);
    applyThemePreview(defaultTheme);
    toast({ title: "Cores resetadas para o padrão" });
  };

  const handleGenerateHero = async () => {
    setIsGenerating(true);
    try {
      const primaryHsl = `${getValue("theme_primary_h")} ${getValue("theme_primary_s")}% ${getValue("theme_primary_l")}%`;
      const accentHsl = `${getValue("theme_accent_h")} ${getValue("theme_accent_s")}% ${getValue("theme_accent_l")}%`;

      const { data, error } = await supabase.functions.invoke("generate-hero-image", {
        body: { primaryHsl, accentHsl },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("Imagem não retornada");

      toast({ title: "Imagem do hero gerada!", description: "A nova foto já está aplicada no site." });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao gerar imagem",
        description: err?.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getColorPreview = (prefix: string): string => {
    const h = getValue(`${prefix}_h`);
    const s = getValue(`${prefix}_s`);
    const l = getValue(`${prefix}_l`);
    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const colorGroups = ["theme_primary", "theme_accent", "theme_background"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Cores do Tema
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              Resetar
            </Button>
            <Button size="sm" onClick={handleSaveAll} disabled={!hasChanges || isSaving} className="gap-1.5">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Curated palettes */}
        <div className="p-4 rounded-xl bg-secondary/30 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <Label className="font-body font-semibold">Paletas Prontas</Label>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Clique em uma paleta para aplicar instantaneamente
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {palettes.map((p) => {
              const primary = `hsl(${p.values.theme_primary_h}, ${p.values.theme_primary_s}%, ${p.values.theme_primary_l}%)`;
              const accent = `hsl(${p.values.theme_accent_h}, ${p.values.theme_accent_s}%, ${p.values.theme_accent_l}%)`;
              const bg = `hsl(${p.values.theme_background_h}, ${p.values.theme_background_s}%, ${p.values.theme_background_l}%)`;
              const isActive = String(getValue("theme_primary_h")) === p.values.theme_primary_h
                && String(getValue("theme_primary_s")) === p.values.theme_primary_s
                && String(getValue("theme_primary_l")) === p.values.theme_primary_l;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPalette(p)}
                  className={cn(
                    "group relative flex flex-col items-start gap-2 p-3 rounded-lg border-2 bg-card hover:shadow-soft transition-all text-left",
                    isActive ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex gap-1 w-full h-8 rounded-md overflow-hidden border border-border">
                    <div className="flex-1" style={{ backgroundColor: primary }} />
                    <div className="flex-1" style={{ backgroundColor: accent }} />
                    <div className="flex-1" style={{ backgroundColor: bg }} />
                  </div>
                  <div>
                    <p className="text-sm font-body font-semibold leading-tight">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Preview */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/50 to-muted/30 border border-border">
          <h4 className="font-body font-medium text-sm text-muted-foreground mb-3">Preview das Cores</h4>
          <div className="flex flex-wrap gap-3">
            {colorGroups.map((prefix) => (
              <div key={prefix} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border">
                <div className="w-8 h-8 rounded-full border-2 border-white shadow-md" style={{ backgroundColor: getColorPreview(prefix) }} />
                <span className="text-sm font-body">{colorLabels[prefix]?.split(" ")[0]}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3 items-center flex-wrap">
            <Button size="sm">Botão Primário</Button>
            <Button size="sm" variant="outline">Botão Outline</Button>
            <span className="text-sm text-primary font-medium">Link de exemplo</span>
          </div>
        </div>

        {/* AI Hero Generator */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/30">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="h-4 w-4 text-primary" />
                <Label className="font-body font-semibold">Foto de Fundo do Hero</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Gera uma foto de mãos com unhas pintadas usando a cor primária atual.
                Salve as cores antes de gerar para garantir o tom certo.
              </p>
            </div>
            <Button
              onClick={handleGenerateHero}
              disabled={isGenerating}
              size="sm"
              className="gap-1.5 shrink-0"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isGenerating ? "Gerando..." : "Gerar com IA"}
            </Button>
          </div>
        </div>

        {/* Color Controls */}
        {colorGroups.map((prefix) => (
          <div key={prefix} className="space-y-4 p-4 rounded-xl bg-secondary/30 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg border-2 border-white shadow-md shrink-0" style={{ backgroundColor: getColorPreview(prefix) }} />
              <div>
                <Label className="font-body font-semibold">{colorLabels[prefix]}</Label>
                <p className="text-xs text-muted-foreground">HSL: {getValue(`${prefix}_h`)}, {getValue(`${prefix}_s`)}%, {getValue(`${prefix}_l`)}%</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Matiz (Cor)</span>
                  <span className="font-mono">{getValue(`${prefix}_h`)}°</span>
                </div>
                <div
                  className="h-3 rounded-full"
                  style={{
                    background: `linear-gradient(to right, hsl(0,70%,60%), hsl(60,70%,60%), hsl(120,70%,60%), hsl(180,70%,60%), hsl(240,70%,60%), hsl(300,70%,60%), hsl(360,70%,60%))`,
                  }}
                />
                <Slider
                  value={[getValue(`${prefix}_h`)]}
                  onValueChange={([val]) => handleChange(`${prefix}_h`, val)}
                  min={0} max={360} step={1}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saturação</span>
                  <span className="font-mono">{getValue(`${prefix}_s`)}%</span>
                </div>
                <Slider
                  value={[getValue(`${prefix}_s`)]}
                  onValueChange={([val]) => handleChange(`${prefix}_s`, val)}
                  min={0} max={100} step={1}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Luminosidade</span>
                  <span className="font-mono">{getValue(`${prefix}_l`)}%</span>
                </div>
                <Slider
                  value={[getValue(`${prefix}_l`)]}
                  onValueChange={([val]) => handleChange(`${prefix}_l`, val)}
                  min={0} max={100} step={1}
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ThemeColorManager;
