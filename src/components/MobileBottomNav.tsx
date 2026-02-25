import { memo } from "react";
import { Home, Sparkles, Image, Calendar, Phone } from "lucide-react";

interface MobileBottomNavProps {
  onBookClick: () => void;
  whatsappNumber: string;
}

const MobileBottomNav = memo(({ onBookClick, whatsappNumber }: MobileBottomNavProps) => {
  const handleWhatsApp = () => {
    const message = encodeURIComponent("Olá! Gostaria de saber mais informações.");
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-2">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl text-muted-foreground hover:text-primary active:scale-95 transition-all min-w-[56px]"
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-body font-medium">Início</span>
        </button>

        <button
          onClick={() => scrollTo("precos")}
          className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl text-muted-foreground hover:text-primary active:scale-95 transition-all min-w-[56px]"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-[10px] font-body font-medium">Serviços</span>
        </button>

        <button
          onClick={onBookClick}
          className="flex flex-col items-center gap-0.5 py-2 px-4 rounded-2xl bg-primary text-primary-foreground active:scale-95 transition-all min-w-[64px] shadow-button -mt-4"
        >
          <Calendar className="h-6 w-6" />
          <span className="text-[10px] font-body font-semibold">Agendar</span>
        </button>

        <button
          onClick={() => scrollTo("galeria")}
          className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl text-muted-foreground hover:text-primary active:scale-95 transition-all min-w-[56px]"
        >
          <Image className="h-5 w-5" />
          <span className="text-[10px] font-body font-medium">Galeria</span>
        </button>

        <button
          onClick={handleWhatsApp}
          className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl text-muted-foreground hover:text-green-500 active:scale-95 transition-all min-w-[56px]"
        >
          <Phone className="h-5 w-5" />
          <span className="text-[10px] font-body font-medium">WhatsApp</span>
        </button>
      </div>
    </nav>
  );
});

MobileBottomNav.displayName = "MobileBottomNav";

export default MobileBottomNav;
