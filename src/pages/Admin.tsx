import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar, 
  Check, 
  X, 
  Clock, 
  User, 
  Phone, 
  ArrowLeft,
  Loader2,
  Filter,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Appointment = Tables<"appointments">;

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
};

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: isCheckingRole } = useAdminRole();
  const { toast } = useToast();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!isCheckingRole && !isAdmin) {
      navigate("/");
    }
  }, [isCheckingRole, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchAppointments();
    }
  }, [isAdmin, filter]);

  const fetchAppointments = async () => {
    setIsLoading(true);
    
    let query = supabase
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Erro ao carregar agendamentos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setAppointments(data || []);
    }
    
    setIsLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    setIsUpdating(id);
    
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
      toast({
        title: "Status atualizado!",
        description: `Agendamento ${statusLabels[status].toLowerCase()}.`,
      });
      fetchAppointments();
    }
    
    setIsUpdating(null);
  };

  if (isCheckingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="text-muted-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-display text-xl font-semibold text-foreground">
                  Painel Admin
                </h1>
                <p className="text-sm text-muted-foreground font-body">
                  Gerenciar agendamentos
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAppointments}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtrar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="confirmed">Confirmados</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="font-body">
            {appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Appointments List */}
      <div className="container mx-auto px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : appointments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-display text-lg font-medium text-foreground mb-1">
                Nenhum agendamento
              </h3>
              <p className="text-sm text-muted-foreground font-body">
                {filter === "all" 
                  ? "Ainda não há agendamentos registrados."
                  : `Nenhum agendamento ${statusLabels[filter]?.toLowerCase() || ""}.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {appointments.map((appointment, index) => (
                <motion.div
                  key={appointment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="font-display text-lg truncate">
                              {appointment.client_name}
                            </CardTitle>
                            <Badge 
                              variant="outline" 
                              className={`${statusColors[appointment.status]} font-body text-xs`}
                            >
                              {statusLabels[appointment.status]}
                            </Badge>
                          </div>
                          <p className="text-sm text-primary font-medium font-body">
                            {appointment.service_type}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4 flex-shrink-0" />
                          <span className="font-body">
                            {format(parseISO(appointment.appointment_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4 flex-shrink-0" />
                          <span className="font-body">{appointment.appointment_time.slice(0, 5)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <a 
                            href={`https://wa.me/${appointment.client_phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-body text-primary hover:underline"
                          >
                            {appointment.client_phone}
                          </a>
                        </div>
                        {appointment.notes && (
                          <div className="col-span-2 bg-secondary/50 rounded-lg p-3">
                            <p className="text-sm text-muted-foreground font-body">
                              📝 {appointment.notes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {appointment.status === "pending" && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => updateStatus(appointment.id, "confirmed")}
                            disabled={isUpdating === appointment.id}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {isUpdating === appointment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Confirmar
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(appointment.id, "cancelled")}
                            disabled={isUpdating === appointment.id}
                            className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50"
                          >
                            {isUpdating === appointment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Cancelar
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {appointment.status === "confirmed" && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(appointment.id, "cancelled")}
                            disabled={isUpdating === appointment.id}
                            className="w-full border-rose-200 text-rose-600 hover:bg-rose-50"
                          >
                            {isUpdating === appointment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Cancelar agendamento
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {appointment.status === "cancelled" && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(appointment.id, "pending")}
                            disabled={isUpdating === appointment.id}
                            className="w-full"
                          >
                            {isUpdating === appointment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Reativar como pendente"
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
