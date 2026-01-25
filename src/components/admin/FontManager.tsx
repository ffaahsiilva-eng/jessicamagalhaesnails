import { useState, useEffect } from "react";
import { Type, Loader2, Save, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettingsAdmin } from "@/hooks/useSiteSettings";

// Available Google Fonts
const displayFonts = [
  { value: "Cormorant Garamond", label: "Cormorant Garamond", style: "Elegante & Clássica" },
  { value: "Playfair Display", label: "Playfair Display", style: "Sofisticada" },
  { value: "Libre Baskerville", label: "Libre Baskerville", style: "Tradicional" },
  { value: "Lora", label: "Lora", style: "Moderna & Elegante" },
  { value: "Merriweather", label: "Merriweather", style: "Legível & Clássica" },
  { value: "Crimson Text", label: "Crimson Text", style: "Editorial" },
  { value: "DM Serif Display", label: "DM Serif Display", style: "Contemporânea" },
  { value: "Bodoni Moda", label: "Bodoni Moda", style: "Luxuosa" },
];

const bodyFonts = [
  { value: "Montserrat", label: "Montserrat", style: "Moderna & Clean" },
  { value: "Open Sans", label: "Open Sans", style: "Versátil" },
  { value: "Lato", label: "Lato", style: "Amigável" },
  { value: "Roboto", label: "Roboto", style: "Neutra" },
  { value: "Nunito", label: "Nunito", style: "Arredondada" },
  { value: "Poppins", label: "Poppins", style: "Geométrica" },
  { value: "Raleway", label: "Raleway", style: "Elegante" },
  { value: "Work Sans", label: "Work Sans", style: "Profissional" },
];

const defaultFonts = {
  font_display: "Cormorant Garamond",
  font_body: "Montserrat",
};

const FontManager = () => {
  const { toast } = useToast();
  const { settings, isLoading, updateSetting } = useSiteSettingsAdmin();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local values from settings
  useEffect(() => {
    const fontSettings = settings.filter((s) => s.category === "fonts");
    const values: Record<string, string> = {};
    fontSettings.forEach((s) => {
      values[s.key] = s.value;
    });
    setLocalValues(values);
  }, [settings]);

  const getValue = (key: string): string => {
    return localValues[key] || defaultFonts[key as keyof typeof defaultFonts] || "";
  };

  const handleChange = (key: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);

    // Apply preview immediately
    applyFontPreview({ ...localValues, [key]: value });
  };

  const applyFontPreview = (values: Record<string, string>) => {
    const displayFont = values.font_display || defaultFonts.font_display;
    const bodyFont = values.font_body || defaultFonts.font_body;

    // Load fonts dynamically
    const link = document.getElementById("dynamic-fonts") as HTMLLinkElement;
    if (link) {
      link.href = `https://fonts.googleapis.com/css2?family=${displayFont.replace(/ /g, "+")}:wght@300;400;500;600;700&family=${bodyFont.replace(/ /g, "+")}:wght@300;400;500;600;700&display=swap`;
    }

    // Apply to CSS variables
    document.documentElement.style.setProperty("--font-display", `"${displayFont}", serif`);
    document.documentElement.style.setProperty("--font-body", `"${bodyFont}", sans-serif`);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const promises = Object.entries(localValues).map(([key, value]) =>
        updateSetting(key, value)
      );
      await Promise.all(promises);
      setHasChanges(false);
      toast({ title: "Fontes salvas!" });
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
    setLocalValues(defaultFonts);
    setHasChanges(true);
    applyFontPreview(defaultFonts);
    toast({ title: "Fontes resetadas para o padrão" });
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Type className="h-5 w-5 text-primary" />
            Fontes do Site
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
            Preview das Fontes
          </h4>
          <div className="bg-card rounded-lg p-4 shadow-sm space-y-3">
            <h3 
              className="text-2xl font-semibold"
              style={{ fontFamily: `"${getValue("font_display")}", serif` }}
            >
              Jéssica Magalhães
            </h3>
            <p 
              className="text-sm text-muted-foreground"
              style={{ fontFamily: `"${getValue("font_body")}", sans-serif` }}
            >
              Este é um exemplo de texto do corpo usando a fonte selecionada. 
              A fonte do corpo é usada para parágrafos, descrições e textos gerais do site.
            </p>
            <Button size="sm" style={{ fontFamily: `"${getValue("font_body")}", sans-serif` }}>
              Botão de Exemplo
            </Button>
          </div>
        </div>

        {/* Font Selectors */}
        <div className="grid gap-4">
          {/* Display Font */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
            <div>
              <Label className="font-body font-semibold">Fonte dos Títulos</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Usada em títulos, cabeçalhos e destaques
              </p>
            </div>
            <Select
              value={getValue("font_display")}
              onValueChange={(value) => handleChange("font_display", value)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {displayFonts.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    <span style={{ fontFamily: `"${font.value}", serif` }}>
                      {font.label}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({font.style})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div 
              className="text-lg font-semibold pt-2"
              style={{ fontFamily: `"${getValue("font_display")}", serif` }}
            >
              Exemplo de Título
            </div>
          </div>

          {/* Body Font */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
            <div>
              <Label className="font-body font-semibold">Fonte do Corpo</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Usada em textos, botões e elementos gerais
              </p>
            </div>
            <Select
              value={getValue("font_body")}
              onValueChange={(value) => handleChange("font_body", value)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bodyFonts.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    <span style={{ fontFamily: `"${font.value}", sans-serif` }}>
                      {font.label}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({font.style})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p 
              className="text-sm pt-2"
              style={{ fontFamily: `"${getValue("font_body")}", sans-serif` }}
            >
              Exemplo de texto do corpo com a fonte selecionada.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FontManager;
