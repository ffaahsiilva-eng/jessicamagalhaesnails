import { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X, User, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useAdminEdit } from "@/contexts/AdminEditContext";
import EditableText from "@/components/admin/EditableText";
import type { User as SupabaseUser } from "@supabase/supabase-js";

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
  const { isEditMode } = useAdminEdit();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setUser(data?.session?.user ?? null);
      })
      .catch(() => {
        setUser(null);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => data?.subscription?.unsubscribe();
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const navLinks = [
    { name: "Serviços", href: "#precos", key: "nav_services" },
    { name: "Galeria", href: "#galeria", key: "nav_gallery" },
    { name: "Contato", href: "#contato", key: "nav_contact" },
  ];

  return (
    <nav
      className={`
        fixed top-0 left-0 right-0 z-50 transition-all duration-300
        pt-[max(env(safe-area-inset-top,0px),1rem)]
        ${isScrolled ? "bg-card/90 backdrop-blur-md shadow-soft pb-3" : "bg-transparent pb-4"}
      `}
    >
      <div className="container mx-auto px-4 sm:px-6 flex items-center justify-end">
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.key}
              href={isEditMode ? undefined : link.href}
              className="font-body text-sm text-foreground/80 hover:text-primary transition-colors"
            >
              <EditableText settingKey={link.key} defaultValue={link.name} as="span" />
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
              onClick={isEditMode ? undefined : onLoginClick}
              className="text-foreground hover:text-primary"
            >
              <User className="h-4 w-4 mr-2" />
              <EditableText settingKey="nav_login_btn" defaultValue="Entrar" as="span" />
            </Button>
          )}

          <Button
            size="sm"
            onClick={isEditMode ? undefined : onBookClick}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-button"
          >
            <EditableText settingKey="nav_book_btn" defaultValue="Agendar" as="span" />
          </Button>
        </div>

        {/* Mobile Menu Button - posicionado com margem do topo para fácil clique no celular */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden mt-2 p-3 text-foreground rounded-2xl bg-card/90 backdrop-blur-md border border-border/60 shadow-soft active:scale-90 transition-all min-h-[48px] min-w-[48px] flex items-center justify-center cursor-pointer touch-manipulation z-50"
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
                key={link.key}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block font-body text-foreground py-3 text-lg active:text-primary transition-colors"
              >
                <EditableText settingKey={link.key} defaultValue={link.name} as="span" />
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
                  <EditableText settingKey="nav_login_btn" defaultValue="Entrar" as="span" />
                </Button>
              )}

              <Button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onBookClick();
                }}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-medium shadow-button active:scale-[0.98] transition-transform"
              >
                <EditableText settingKey="nav_book_btn_mobile" defaultValue="Agendar Horário" as="span" />
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
