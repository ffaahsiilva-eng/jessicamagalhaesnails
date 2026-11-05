import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Palette, Check, RotateCcw } from "lucide-react";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const PALETTE = [
  { name: "Café Marrom", hex: "#2b1a12" },
  { name: "Terracota Escuro", hex: "#96401f" },
  { name: "Terracota Médio", hex: "#b5502f" },
  { name: "Dourado Ouro", hex: "#c69a5d" },
  { name: "Bege Creme", hex: "#f3ddd2" },
  { name: "Rosa Quartzo", hex: "#e8b4a0" },
  { name: "Preto Carvão", hex: "#1a0f0a" },
  { name: "Branco Puro", hex: "#ffffff" },
  { name: "Vinho Marsala", hex: "#5a1827" },
];

const SiteStyleDrawer = () => {
  const { isStyleDrawerOpen, setIsStyleDrawerOpen, setDraftSetting, getDraftSetting } = useAdminEdit();
  const { getSetting } = useSiteSettings();

  const marqueeBg = getDraftSetting("marquee_bg_color") || getSetting("marquee_bg_color", "#2b1a12");
  const marqueeText = getDraftSetting("marquee_text_color") || getSetting("marquee_text_color", "#f3ddd2");
  const marqueeStar = getDraftSetting("marquee_star_color") || getSetting("marquee_star_color", "#c69a5d");
  const footerBg = getDraftSetting("footer_bg_color") || getSetting("footer_bg_color", "#1a0f0a");

  return (
    <Sheet open={isStyleDrawerOpen} onOpenChange={setIsStyleDrawerOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Cores de Barras e Seções
          </SheetTitle>
          <SheetDescription className="font-body text-xs">
            Personalize as cores em tempo real. As alterações salvam automaticamente ao sair do modo de edição.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* 1. Faixa Rolante de Serviços */}
          <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
            <h4 className="font-display font-semibold text-sm text-foreground flex items-center justify-between">
              Faixa Rolante de Serviços
              <span
                className="w-4 h-4 rounded-full border border-border"
                style={{ backgroundColor: marqueeBg }}
              />
            </h4>

            <div className="space-y-2">
              <Label className="font-body text-xs text-muted-foreground">Cor de Fundo da Faixa</Label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setDraftSetting("marquee_bg_color", c.hex)}
                    className="w-7 h-7 rounded-full border border-border flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {marqueeBg.toLowerCase() === c.hex.toLowerCase() && (
                      <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                    )}
                  </button>
                ))}
                <input
                  type="color"
                  value={marqueeBg}
                  onChange={(e) => setDraftSetting("marquee_bg_color", e.target.value)}
                  className="w-7 h-7 rounded-full cursor-pointer border-0 p-0"
                  title="Cor livre"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="font-body text-xs text-muted-foreground">Cor do Texto dos Serviços</Label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setDraftSetting("marquee_text_color", c.hex)}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {marqueeText.toLowerCase() === c.hex.toLowerCase() && (
                      <Check className="h-3 w-3 text-white drop-shadow" />
                    )}
                  </button>
                ))}
                <input
                  type="color"
                  value={marqueeText}
                  onChange={(e) => setDraftSetting("marquee_text_color", e.target.value)}
                  className="w-6 h-6 rounded-full cursor-pointer border-0 p-0"
                  title="Cor livre"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="font-body text-xs text-muted-foreground">Cor da Estrelinha ✦</Label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {["#c69a5d", "#d4af37", "#f3ddd2", "#ffffff", "#b5502f"].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setDraftSetting("marquee_star_color", hex)}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center"
                    style={{ backgroundColor: hex }}
                  >
                    {marqueeStar.toLowerCase() === hex.toLowerCase() && (
                      <Check className="h-3 w-3 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Rodapé */}
          <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
            <h4 className="font-display font-semibold text-sm text-foreground flex items-center justify-between">
              Fundo do Rodapé
              <span
                className="w-4 h-4 rounded-full border border-border"
                style={{ backgroundColor: footerBg }}
              />
            </h4>
            <div className="flex flex-wrap gap-1.5 items-center">
              {PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setDraftSetting("footer_bg_color", c.hex)}
                  className="w-7 h-7 rounded-full border border-border flex items-center justify-center transition-transform hover:scale-110"
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {footerBg.toLowerCase() === c.hex.toLowerCase() && (
                    <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                  )}
                </button>
              ))}
              <input
                type="color"
                value={footerBg}
                onChange={(e) => setDraftSetting("footer_bg_color", e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer border-0 p-0"
                title="Cor livre"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <Button
            type="button"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-body"
            onClick={() => setIsStyleDrawerOpen(false)}
          >
            Fechar e Aplicar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SiteStyleDrawer;

