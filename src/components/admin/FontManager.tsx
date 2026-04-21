import { useState, useEffect } from "react";
import { Type, Loader2, Save, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
  { value: "Cinzel", label: "Cinzel", style: "Romana & Premium" },
  { value: "Marcellus", label: "Marcellus", style: "Refinada" },
  { value: "Italiana", label: "Italiana", style: "Delicada" },
  { value: "Cormorant Infant", label: "Cormorant Infant", style: "Suave" },
  { value: "EB Garamond", label: "EB Garamond", style: "Clássica" },
  { value: "Prata", label: "Prata", style: "Minimalista" },
  { value: "Tenor Sans", label: "Tenor Sans", style: "Moderna" },
  { value: "Cardo", label: "Cardo", style: "Acadêmica" },
  { value: "Spectral", label: "Spectral", style: "Versátil" },
  { value: "Yeseva One", label: "Yeseva One", style: "Decorativa" },
  { value: "Abril Fatface", label: "Abril Fatface", style: "Display Forte" },
  { value: "Great Vibes", label: "Great Vibes", style: "Caligráfica" },
  { value: "Dancing Script", label: "Dancing Script", style: "Manuscrita" },
  { value: "Pinyon Script", label: "Pinyon Script", style: "Cursiva Fina" },
  { value: "Allura", label: "Allura", style: "Romântica" },
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
  { value: "Inter", label: "Inter", style: "Tech Moderno" },
  { value: "DM Sans", label: "DM Sans", style: "Minimalista" },
  { value: "Manrope", label: "Manrope", style: "Suave" },
  { value: "Karla", label: "Karla", style: "Limpa" },
  { value: "Quicksand", label: "Quicksand", style: "Casual" },
  { value: "Mulish", label: "Mulish", style: "Equilibrada" },
  { value: "Source Sans 3", label: "Source Sans 3", style: "Editorial" },
  { value: "Noto Sans", label: "Noto Sans", style: "Universal" },
  { value: "PT Sans", label: "PT Sans", style: "Confortável" },
  { value: "Rubik", label: "Rubik", style: "Amigável Geométrica" },
  { value: "Barlow", label: "Barlow", style: "Industrial" },
  { value: "Outfit", label: "Outfit", style: "Contemporânea" },
];

const headingSizes = [
  { value: "small", label: "Pequeno", scale: 0.85 },
  { value: "normal", label: "Normal", scale: 1 },
  { value: "large", label: "Grande", scale: 1.15 },
  { value: "xlarge", label: "Extra Grande", scale: 1.3 },
];

const bodySizes = [
  { value: "small", label: "Pequeno", scale: 0.9 },
  { value: "normal", label: "Normal", scale: 1 },
  { value: "large", label: "Grande", scale: 1.1 },
  { value: "xlarge", label: "Extra Grande", scale: 1.2 },
];

const defaultFonts = {
  font_display: "Cormorant Garamond",
  font_body: "Montserrat",
  font_scale: "1",
  font_heading_size: "normal",
  font_body_size: "normal",
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

  const getNumericValue = (key: string): number => {
    return parseFloat(localValues[key] || defaultFonts[key as keyof typeof defaultFonts] || "1");
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
    const scale = parseFloat(values.font_scale || defaultFonts.font_scale);
    const headingSize = values.font_heading_size || defaultFonts.font_heading_size;
    const bodySize = values.font_body_size || defaultFonts.font_body_size;

    // Load fonts dynamically
    const link = document.getElementById("dynamic-fonts") as HTMLLinkElement;
    if (link) {
      link.href = `https://fonts.googleapis.com/css2?family=${displayFont.replace(/ /g, "+")}:wght@300;400;500;600;700&family=${bodyFont.replace(/ /g, "+")}:wght@300;400;500;600;700&display=swap`;
    }

    const root = document.documentElement;

    // Apply font families
    root.style.setProperty("--font-display", `"${displayFont}", serif`);
    root.style.setProperty("--font-body", `"${bodyFont}", sans-serif`);

    // Get size multipliers
    const headingScale = headingSizes.find((s) => s.value === headingSize)?.scale || 1;
    const bodyScale = bodySizes.find((s) => s.value === bodySize)?.scale || 1;

    // Apply font sizes with scale
    const baseSize = 16 * scale;
    root.style.setProperty("--font-size-base", `${baseSize * bodyScale}px`);
    root.style.setProperty("--font-size-sm", `${baseSize * bodyScale * 0.875}px`);
    root.style.setProperty("--font-size-xs", `${baseSize * bodyScale * 0.75}px`);
    root.style.setProperty("--font-size-lg", `${baseSize * bodyScale * 1.125}px`);
    root.style.setProperty("--font-size-xl", `${baseSize * bodyScale * 1.25}px`);

    // Heading sizes
    root.style.setProperty("--font-size-h1", `${baseSize * headingScale * 2.5}px`);
    root.style.setProperty("--font-size-h2", `${baseSize * headingScale * 2}px`);
    root.style.setProperty("--font-size-h3", `${baseSize * headingScale * 1.5}px`);
    root.style.setProperty("--font-size-h4", `${baseSize * headingScale * 1.25}px`);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const promises = Object.entries(localValues).map(([key, value]) =>
        updateSetting(key, value)
      );
      await Promise.all(promises);
      setHasChanges(false);
      toast({ title: "Fontes e tamanhos salvos!" });
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
    toast({ title: "Fontes e tamanhos resetados para o padrão" });
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

  const headingScale = headingSizes.find((s) => s.value === getValue("font_heading_size"))?.scale || 1;
  const bodyScale = bodySizes.find((s) => s.value === getValue("font_body_size"))?.scale || 1;
  const globalScale = getNumericValue("font_scale");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Type className="h-5 w-5 text-primary" />
            Fontes e Tamanhos
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
            Preview ao Vivo
          </h4>
          <div className="bg-card rounded-lg p-4 shadow-sm space-y-3">
            <h3
              style={{
                fontFamily: `"${getValue("font_display")}", serif`,
                fontSize: `${32 * headingScale * globalScale}px`,
              }}
              className="font-semibold"
            >
              Jéssica Magalhães
            </h3>
            <h4
              style={{
                fontFamily: `"${getValue("font_display")}", serif`,
                fontSize: `${24 * headingScale * globalScale}px`,
              }}
              className="font-medium text-muted-foreground"
            >
              Nail Designer
            </h4>
            <p
              style={{
                fontFamily: `"${getValue("font_body")}", sans-serif`,
                fontSize: `${16 * bodyScale * globalScale}px`,
              }}
              className="text-muted-foreground"
            >
              Este é um exemplo de texto do corpo usando a fonte e tamanho selecionados.
              A fonte do corpo é usada para parágrafos, descrições e textos gerais.
            </p>
            <p
              style={{
                fontFamily: `"${getValue("font_body")}", sans-serif`,
                fontSize: `${14 * bodyScale * globalScale}px`,
              }}
              className="text-muted-foreground"
            >
              Texto menor para legendas e informações secundárias.
            </p>
          </div>
        </div>

        {/* Global Scale Slider */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-body font-semibold">Escala Global</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ajusta proporcionalmente todos os tamanhos de fonte
              </p>
            </div>
            <span className="text-lg font-mono font-semibold text-primary">
              {Math.round(getNumericValue("font_scale") * 100)}%
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>80%</span>
              <span>100%</span>
              <span>120%</span>
            </div>
            <Slider
              value={[getNumericValue("font_scale") * 100]}
              onValueChange={([val]) => handleChange("font_scale", String(val / 100))}
              min={80}
              max={120}
              step={5}
              className="cursor-pointer"
            />
          </div>
        </div>

        {/* Font Family Selectors */}
        <div className="grid gap-4">
          {/* Display Font */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-body font-semibold">Fonte dos Títulos</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Usada em títulos e destaques
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
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
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={getValue("font_heading_size")}
                onValueChange={(value) => handleChange("font_heading_size", value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Tamanho" />
                </SelectTrigger>
                <SelectContent>
                  {headingSizes.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label} ({Math.round(size.scale * 100)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div
              style={{
                fontFamily: `"${getValue("font_display")}", serif`,
                fontSize: `${24 * headingScale}px`,
              }}
              className="font-semibold pt-2"
            >
              Exemplo de Título
            </div>
          </div>

          {/* Body Font */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-body font-semibold">Fonte do Corpo</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Usada em textos e elementos gerais
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
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
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={getValue("font_body_size")}
                onValueChange={(value) => handleChange("font_body_size", value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Tamanho" />
                </SelectTrigger>
                <SelectContent>
                  {bodySizes.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label} ({Math.round(size.scale * 100)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p
              style={{
                fontFamily: `"${getValue("font_body")}", sans-serif`,
                fontSize: `${16 * bodyScale}px`,
              }}
              className="pt-2"
            >
              Exemplo de texto do corpo com a fonte e tamanho selecionados.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FontManager;
