import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
interface NavigationProps {
  onLoginClick: () => void;
  onBookClick: () => void;
}
const Navigation = ({
  onLoginClick,
  onBookClick
}: NavigationProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };
  const navLinks = [{
    name: "Serviços",
    href: "#precos"
  }, {
    name: "Galeria",
    href: "#galeria"
  }, {
    name: "Contato",
    href: "#contato"
  }];
  return <motion.nav initial={{
    y: -100
  }} animate={{
    y: 0
  }} className={`
        fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${isScrolled ? "bg-card/90 backdrop-blur-md shadow-soft py-3" : "bg-transparent py-5"}
      `}>
      <div className="container mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(link => <a key={link.name} href={link.href} className="font-body text-sm text-foreground/80 hover:text-primary transition-colors">
              {link.name}
            </a>)}

          {user ? <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground font-body">
                Olá, {user.email?.split("@")[0]}
              </span>
              <Button size="sm" variant="ghost" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
              </Button>
            </div> : <Button size="sm" variant="ghost" onClick={onLoginClick} className="text-foreground hover:text-primary">
              <User className="h-4 w-4 mr-2" />
              Entrar
            </Button>}

          <Button size="sm" onClick={onBookClick} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-button">
            Agendar
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 text-foreground rounded-xl shadow-lg opacity-100">
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && <motion.div initial={{
        opacity: 0,
        height: 0
      }} animate={{
        opacity: 1,
        height: "auto"
      }} exit={{
        opacity: 0,
        height: 0
      }} className="md:hidden bg-card border-t border-border">
            <div className="container mx-auto px-6 py-4 space-y-4">
              {navLinks.map(link => <a key={link.name} href={link.href} onClick={() => setIsMobileMenuOpen(false)} className="block font-body text-foreground py-2">
                  {link.name}
                </a>)}

              <div className="pt-4 border-t border-border space-y-3">
                {user ? <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground font-body">
                      Olá, {user.email?.split("@")[0]}
                    </span>
                    <Button size="sm" variant="ghost" onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair
                    </Button>
                  </div> : <Button variant="outline" onClick={() => {
              setIsMobileMenuOpen(false);
              onLoginClick();
            }} className="w-full">
                    <User className="h-4 w-4 mr-2" />
                    Entrar
                  </Button>}

                <Button onClick={() => {
              setIsMobileMenuOpen(false);
              onBookClick();
            }} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  Agendar Horário
                </Button>
              </div>
            </div>
          </motion.div>}
      </AnimatePresence>
    </motion.nav>;
};
export default Navigation;