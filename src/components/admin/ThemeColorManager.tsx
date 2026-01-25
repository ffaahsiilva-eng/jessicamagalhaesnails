import { useState, useEffect } from "react";
import { Palette, Loader2, Save, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettingsAdmin, SiteSetting } from "@/hooks/useSiteSettings";

const defaultTheme = {
  theme_primary_h: "350",
  theme_primary_s: "60",
  theme_primary_l: "65",
  theme_accent_h: "15",
  theme_accent_s: "70",
  theme_accent_l: "75",
  theme_background_h: "20",
  theme_background_s: "33",
  theme_background_l: "98",
};

const colorLabels: Record<string, string> = {
  theme_primary: "Cor Primária (Botões, Links)",
  theme_accent: "Cor de Destaque (Rose Gold)",
  theme_background: "Cor de Fundo",
};

const ThemeColorManager = () => {
  const { toast } = useToast();
  const { settings, isLoading, updateSetting } = useSiteSettingsAdmin();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local values from settings
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
    setLocalValues((prev) => ({ ...prev, [key]: String(value) }));
    setHasChanges(true);
    
    // Apply preview immediately to CSS variables
    applyThemePreview({ ...localValues, [key]: String(value) });
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
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
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
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Cores do Tema
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              className="gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Resetar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={!hasChanges || isSaving}
              className="gap-1.5"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Live Preview */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-secondary/50 to-muted/30 border border-border">
          <h4 className="font-body font-medium text-sm text-muted-foreground mb-3">
            Preview das Cores
          </h4>
          <div className="flex flex-wrap gap-3">
            {colorGroups.map((prefix) => (
              <div
                key={prefix}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border"
              >
                <div
                  className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: getColorPreview(prefix) }}
                />
                <span className="text-sm font-body">
                  {colorLabels[prefix]?.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
          {/* Button preview */}
          <div className="mt-4 flex gap-3 items-center">
            <Button size="sm">Botão Primário</Button>
            <Button size="sm" variant="outline">Botão Outline</Button>
            <span className="text-sm text-primary font-medium">Link de exemplo</span>
          </div>
        </div>

        {/* Color Controls */}
        {colorGroups.map((prefix) => (
          <div key={prefix} className="space-y-4 p-4 rounded-xl bg-secondary/30 border border-border">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg border-2 border-white shadow-md shrink-0"
                style={{ backgroundColor: getColorPreview(prefix) }}
              />
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
                    background: `linear-gradient(to right, 
                      hsl(0, 70%, 60%), 
                      hsl(60, 70%, 60%), 
                      hsl(120, 70%, 60%), 
                      hsl(180, 70%, 60%), 
                      hsl(240, 70%, 60%), 
                      hsl(300, 70%, 60%), 
                      hsl(360, 70%, 60%)
                    )`,
                  }}
                />
                <Slider
                  value={[getValue(`${prefix}_h`)]}
                  onValueChange={([val]) => handleChange(`${prefix}_h`, val)}
                  min={0}
                  max={360}
                  step={1}
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
                  min={0}
                  max={100}
                  step={1}
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
                  min={0}
                  max={100}
                  step={1}
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
