import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, X, Calendar, Clock, User, Phone, Mail, Sparkles, Loader2, ShieldAlert, ArrowLeft } from "lucide-react";

const AppointmentConfirm = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isLoading: isAdminLoading } = useAdminRole();
  const { toast } = useToast();
  const [appointment, setAppointment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!isAdminLoading && !isAdmin) return;
    if (!id) return;

    const fetchAppointment = async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erro ao buscar agendamento:", error);
        toast({
          title: "Agendamento não encontrado",
          description: "O link pode estar incorreto ou o agendamento foi removido.",
          variant: "destructive",
        });
      }
      setAppointment(data);
      setIsLoading(false);
    };

    fetchAppointment();
  }, [id, isAdmin, isAdminLoading]);

  // Redirect non-admins
  useEffect(() => {
    if (!isAdminLoading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, isAdminLoading, navigate]);

  const handleUpdateStatus = async (status: "confirmed" | "cancelled" | "pending") => {
    if (!id) return;
    setIsUpdating(true);

    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setAppointment((prev: any) => ({ ...prev, status }));
      toast({
        title: status === "confirmed" ? "✅ Agendamento confirmado!" : "❌ Agendamento rejeitado",
        description: `O status foi atualizado com sucesso.`,
      });
    }
    setIsUpdating(false);
  };

  if (isAdminLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <ShieldAlert className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Acesso restrito</h1>
          <p className="text-muted-foreground">Faça login como administrador para acessar esta página.</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Calendar className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Agendamento não encontrado</h1>
          <Button variant="outline" onClick={() => navigate("/admin")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao painel
          </Button>
        </div>
      </div>
    );
  }

  const formattedDate = format(parseISO(appointment.appointment_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const formattedTime = appointment.appointment_time?.slice(0, 5);

  const statusLabel: Record<string, { text: string; color: string }> = {
    pending: { text: "⏳ Pendente", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    confirmed: { text: "✅ Confirmado", color: "bg-green-100 text-green-800 border-green-300" },
    cancelled: { text: "❌ Rejeitado", color: "bg-red-100 text-red-800 border-red-300" },
  };

  const currentStatus = statusLabel[appointment.status] || statusLabel.pending;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao painel
        </Button>

        <div className="bg-card rounded-2xl border shadow-lg p-6 space-y-5">
          <div className="text-center space-y-2">
            <Sparkles className="h-8 w-8 text-primary mx-auto" />
            <h1 className="text-2xl font-display font-bold text-foreground">
              Confirmar Agendamento
            </h1>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${currentStatus.color}`}>
              {currentStatus.text}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
              <User className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-medium text-foreground">{appointment.client_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
              <Phone className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Telefone</p>
                <p className="font-medium text-foreground">{appointment.client_phone}</p>
              </div>
            </div>

            {appointment.client_email && (
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
                <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{appointment.client_email}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
              <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Serviço</p>
                <p className="font-medium text-foreground">{appointment.service_type}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
                <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="font-medium text-foreground text-sm">{formattedDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
                <Clock className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Horário</p>
                  <p className="font-medium text-foreground">{formattedTime}</p>
                </div>
              </div>
            </div>

            {appointment.notes && (
              <div className="p-3 bg-secondary/50 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1">Observações</p>
                <p className="text-sm text-foreground">{appointment.notes}</p>
              </div>
            )}
          </div>

          {appointment.status === "pending" && (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => handleUpdateStatus("cancelled")}
                disabled={isUpdating}
                variant="outline"
                className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                Rejeitar
              </Button>
              <Button
                onClick={() => handleUpdateStatus("confirmed")}
                disabled={isUpdating}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Confirmar
              </Button>
            </div>
          )}

          {appointment.status !== "pending" && (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => handleUpdateStatus("pending")}
                disabled={isUpdating}
                variant="outline"
                className="flex-1"
              >
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "↩️ Voltar para pendente"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentConfirm;
