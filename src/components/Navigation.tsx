import { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X, User, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import logoJMDefault from "@/assets/logo-jm.png";
import verifiedBadge from "@/assets/verified-badge.png";

interface NavigationProps {
  onLoginClick: () => void;
  onBookClick: () => void;
}

const Navigation = memo(({ onLoginClick, onBookClick }: NavigationProps) => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const { isAdmin } = useAdminRole();
  const { getSetting } = useSiteSettings();

  const logoUrl = getSetting("logo_url", "");
  const logo = logoUrl || logoJMDefault;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const navLinks = [
    { name: "Serviços", href: "#precos" },
    { name: "Galeria", href: "#galeria" },
    { name: "Contato", href: "#contato" },
  ];

  return (
    <nav
      className={`
        fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${isScrolled ? "bg-card/90 backdrop-blur-md shadow-soft py-3" : "bg-transparent py-5"}
      `}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex-shrink-0 flex items-center gap-0.5">
          <img
            src={logo}
            alt="Logo"
            className={`transition-all duration-300 ${isScrolled ? "h-10" : "h-14"}`}
          />
          <img
            src={verifiedBadge}
            alt="Verificado"
            className={`transition-all duration-300 ${isScrolled ? "h-2.5 w-2.5" : "h-3 w-3"} animate-[pulse_4s_cubic-bezier(0.4,0,0.6,1)_infinite] self-start mt-1`}
          />
        </a>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="font-body text-sm text-foreground/80 hover:text-primary transition-colors"
            >
              {link.name}
            </a>
          ))}

          {user ? (
            <div className="flex items-center gap-3">
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate("/admin")}
                  className="text-primary hover:text-primary/80"
                >
                  <Shield className="h-4 w-4 mr-1" />
                  Admin
                </Button>
              )}
              <span className="text-sm text-muted-foreground font-body">
                Olá, {user.email?.split("@")[0]}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={onLoginClick}
              className="text-foreground hover:text-primary"
            >
              <User className="h-4 w-4 mr-2" />
              Entrar
            </Button>
          )}

          <Button
            size="sm"
            onClick={onBookClick}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-button"
          >
            Agendar
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-3 text-foreground rounded-xl active:scale-95 transition-transform"
          aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-card border-t border-border animate-in slide-in-from-top duration-300">
          <div className="container mx-auto px-6 py-4 space-y-4">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block font-body text-foreground py-3 text-lg active:text-primary transition-colors"
              >
                {link.name}
              </a>
            ))}

            <div className="pt-4 border-t border-border space-y-3">
              {user ? (
                <>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        navigate("/admin");
                      }}
                      className="w-full border-primary text-primary"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Painel Admin
                    </Button>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground font-body">
                      Olá, {user.email?.split("@")[0]}
                    </span>
                    <Button size="sm" variant="ghost" onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onLoginClick();
                  }}
                  className="w-full"
                >
                  <User className="h-4 w-4 mr-2" />
                  Entrar
                </Button>
              )}

              <Button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onBookClick();
                }}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Agendar Horário
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
});

Navigation.displayName = "Navigation";

export default Navigation;
