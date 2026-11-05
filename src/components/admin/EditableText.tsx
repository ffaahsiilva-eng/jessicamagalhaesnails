import React, { useRef, useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palette, Type, Sparkles, RotateCcw } from "lucide-react";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { cn } from "@/lib/utils";

interface EditableTextProps {
  settingKey: string;
  defaultValue: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div";
  multiline?: boolean;
}

const FONT_OPTIONS = [
  { value: "Playfair Display", label: "Playfair Display (Serifada Elegante)" },
  { value: "Cormorant Garamond", label: "Cormorant Garamond (Clássica Luxo)" },
  { value: "Montserrat", label: "Montserrat (Moderna & Clean)" },
  { value: "Jost", label: "Jost (Geométrica Sofisticada)" },
  { value: "Great Vibes", label: "Great Vibes (Cursiva / Caligráfica)" },
  { value: "Cinzel", label: "Cinzel (Romana Imperial)" },
  { value: "Poppins", label: "Poppins (Arredondada)" },
  { value: "Lora", label: "Lora (Editorial)" },
  { value: "Inter", label: "Inter (Minimalista)" },
];

const COLOR_PALETTE = [
  { name: "Dourado Nobre", hex: "#c69a5d" },
  { name: "Ouro Brilhante", hex: "#d4af37" },
  { name: "Terracota Escuro", hex: "#96401f" },
  { name: "Terracota Médio", hex: "#b5502f" },
  { name: "Bege Creme", hex: "#f3ddd2" },
  { name: "Rosa Quartzo", hex: "#e8b4a0" },
  { name: "Branco Puro", hex: "#ffffff" },
  { name: "Preto Carvão", hex: "#1f1f1f" },
  { name: "Café Marrom", hex: "#2b1a12" },
];

const ANIMATION_OPTIONS = [
  { value: "none", label: "Nenhuma" },
  { value: "fade", label: "Suave (Fade In)" },
  { value: "slide", label: "Subir (Slide Up)" },
  { value: "zoom", label: "Zoom Suave" },
  { value: "float", label: "Flutuar (Floaty)" },
  { value: "pulse", label: "Pulsar Delicado" },
];

const EditableText = ({
  settingKey,
  defaultValue,
  className,
  as: Component = "span",
}: EditableTextProps) => {
  const { isEditMode, isAdmin, draftSettings, setDraftSetting } = useAdminEdit();
  const { getSetting } = useSiteSettings();
  const elementRef = useRef<HTMLElement>(null);
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);

  // Read live text
  const currentValue =
    draftSettings[settingKey] !== undefined
      ? draftSettings[settingKey]
      : getSetting(settingKey, defaultValue);

  // Read live styles (color, font, animation)
  const currentColor =
    draftSettings[`${settingKey}_color`] !== undefined
      ? draftSettings[`${settingKey}_color`]
      : getSetting(`${settingKey}_color`, "");

  const currentFont =
    draftSettings[`${settingKey}_font`] !== undefined
      ? draftSettings[`${settingKey}_font`]
      : getSetting(`${settingKey}_font`, "");

  const currentAnim =
    draftSettings[`${settingKey}_anim`] !== undefined
      ? draftSettings[`${settingKey}_anim`]
      : getSetting(`${settingKey}_anim`, "none");

  // Keep DOM innerText in sync with currentValue without losing cursor position when typing
  useEffect(() => {
    if (
      elementRef.current &&
      document.activeElement !== elementRef.current &&
      elementRef.current.innerText !== currentValue
    ) {
      elementRef.current.innerText = currentValue;
    }
  }, [currentValue]);

  // Dynamic custom inline styles (font + color)
  const customStyle: React.CSSProperties = {};
  if (currentColor) customStyle.color = currentColor;
  if (currentFont) customStyle.fontFamily = `"${currentFont}", sans-serif`;

  // Animation classes
  const animClass =
    currentAnim === "fade"
      ? "animate-in fade-in duration-700"
      : currentAnim === "slide"
      ? "animate-in slide-in-from-bottom-3 duration-500"
      : currentAnim === "zoom"
      ? "animate-in zoom-in-95 duration-500"
      : currentAnim === "float"
      ? "animate-floaty"
      : currentAnim === "pulse"
      ? "animate-pulse"
      : "";

  // 1. Normal View (Visitors or Admin with Edit Mode OFF)
  if (!isAdmin || !isEditMode) {
    return (
      <Component className={cn(className, animClass)} style={customStyle}>
        {currentValue}
      </Component>
    );
  }

  // 2. Edit Mode View (No layout shift! Native tag with in-place contentEditable)
  return (
    <Popover open={isToolbarOpen} onOpenChange={setIsToolbarOpen}>
      <PopoverTrigger asChild>
        <Component
          ref={elementRef as unknown as React.Ref<never>}
          contentEditable
          suppressContentEditableWarning
          onInput={(e: React.FormEvent<HTMLElement>) => {
            const newText = e.currentTarget.innerText;
            setDraftSetting(settingKey, newText);
          }}
          onBlur={(e: React.FocusEvent<HTMLElement>) => {
            const newText = e.currentTarget.innerText;
            setDraftSetting(settingKey, newText);
          }}
          onContextMenu={(e: React.MouseEvent) => {
            e.preventDefault();
            setIsToolbarOpen(true);
          }}
          className={cn(
            className,
            animClass,
            "cursor-text transition-all outline-dashed outline-1 outline-primary/40 hover:outline-2 hover:outline-primary hover:bg-primary/5 rounded-sm"
          )}
          style={customStyle}
          title="Clique para digitar direto no texto. Clique com o botão direito ou no ícone para trocar cor, fonte e animação."
        >
          {currentValue}
        </Component>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="center"
        sideOffset={6}
        className="w-72 p-3 space-y-3 z-[100] shadow-xl border-border bg-card/95 backdrop-blur-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between pb-1 border-b border-border/60">
          <span className="font-display font-semibold text-xs text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Personalizar Texto
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              setDraftSetting(`${settingKey}_color`, "");
              setDraftSetting(`${settingKey}_font`, "");
              setDraftSetting(`${settingKey}_anim`, "none");
            }}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Padrão
          </Button>
        </div>

        {/* Cores */}
        <div className="space-y-1.5">
          <Label className="font-body text-[11px] text-muted-foreground flex items-center gap-1">
            <Palette className="h-3 w-3 text-primary" />
            Cor da Letra
          </Label>
          <div className="flex flex-wrap gap-1 items-center">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setDraftSetting(`${settingKey}_color`, c.hex)}
                className="w-5 h-5 rounded-full border border-border/80 flex items-center justify-center transition-transform hover:scale-125"
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
            <input
              type="color"
              value={currentColor || "#b5502f"}
              onChange={(e) => setDraftSetting(`${settingKey}_color`, e.target.value)}
              className="w-5 h-5 rounded-full cursor-pointer border-0 p-0"
              title="Cor personalizada"
            />
          </div>
        </div>

        {/* Fontes */}
        <div className="space-y-1.5">
          <Label className="font-body text-[11px] text-muted-foreground flex items-center gap-1">
            <Type className="h-3 w-3 text-primary" />
            Fonte
          </Label>
          <Select
            value={currentFont || "default"}
            onValueChange={(val) => setDraftSetting(`${settingKey}_font`, val === "default" ? "" : val)}
          >
            <SelectTrigger className="h-7 text-xs font-body">
              <SelectValue placeholder="Fonte Padrão" />
            </SelectTrigger>
            <SelectContent className="z-[110] max-h-56">
              <SelectItem value="default">Fonte Padrão da Seção</SelectItem>
              {FONT_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value} style={{ fontFamily: `"${f.value}", sans-serif` }}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Animação */}
        <div className="space-y-1.5">
          <Label className="font-body text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" />
            Animação
          </Label>
          <Select
            value={currentAnim || "none"}
            onValueChange={(val) => setDraftSetting(`${settingKey}_anim`, val)}
          >
            <SelectTrigger className="h-7 text-xs font-body">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[110]">
              {ANIMATION_OPTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EditableText;
