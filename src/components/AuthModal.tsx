import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name
            },
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        toast({
          title: "Conta criada com sucesso!",
          description: "Você já pode fazer login."
        });
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        toast({
          title: "Bem-vinda de volta! 💅",
          description: "Login realizado com sucesso."
        });
        onClose();
      }
    } catch (error: any) {
      let message = error.message || "Algo deu errado. Tente novamente.";
      if (message.includes("Failed to fetch")) {
        message = "Erro de conexão com o banco de dados. Recarregue a página (Ctrl+F5) e tente novamente.";
      } else if (message.includes("Invalid login credentials")) {
        message = "E-mail ou senha incorretos. Verifique suas credenciais.";
      } else if (message.includes("Email not confirmed")) {
        message = "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
      } else if (message.includes("User already registered")) {
        message = "Este e-mail já está cadastrado. Tente entrar na sua conta.";
      }
      toast({
        title: "Erro",
        description: message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setMode("login");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            key="modal-content"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-card w-full max-w-sm rounded-3xl shadow-card overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-6 pt-8 pb-4 text-center">
              <button onClick={handleClose} className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-full transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>

              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-primary" />
              </div>

              <h2 className="font-display text-2xl font-semibold text-foreground">
                {mode === "login" ? "Bem-vinda!" : "Criar Conta"}
              </h2>
              <p className="text-muted-foreground text-sm font-body mt-1">
                {mode === "login" ? "Entre para gerenciar seus agendamentos" : "Cadastre-se para agendar seus horários"}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="auth-name" className="font-body text-foreground">
                    Nome
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="auth-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="pl-10 bg-secondary/50" required={mode === "signup"} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="auth-email" className="font-body text-foreground">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="pl-10 bg-secondary/50" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password" className="font-body text-foreground">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 bg-secondary/50" required minLength={6} />
                </div>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-button">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Entrar" : "Criar Conta"}
              </Button>

              <div className="text-center pt-2">
                
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;
