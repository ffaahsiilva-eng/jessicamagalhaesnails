import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Calendar as CalendarIcon, 
  Check, 
  X, 
  Clock, 
  Phone, 
  ArrowLeft,
  Loader2,
  Filter,
  RefreshCw,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

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

  // Get dates that have appointments
  const getDatesWithAppointments = () => {
    const dates = new Map<string, { count: number; hasConfirmed: boolean; hasPending: boolean }>();
    
    appointments.forEach((apt) => {
      const dateKey = apt.appointment_date;
      const existing = dates.get(dateKey) || { count: 0, hasConfirmed: false, hasPending: false };
      existing.count++;
      if (apt.status === "confirmed") existing.hasConfirmed = true;
      if (apt.status === "pending") existing.hasPending = true;
      dates.set(dateKey, existing);
    });
    
    return dates;
  };

  // Get appointments for selected date
  const getAppointmentsForDate = (date: Date | undefined) => {
    if (!date) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return appointments.filter((apt) => apt.appointment_date === dateStr);
  };

  const datesWithAppointments = getDatesWithAppointments();
  const selectedDateAppointments = getAppointmentsForDate(selectedDate);

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

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Calendar Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  Calendário de Agendamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={ptBR}
                  className="rounded-xl border border-border mx-auto pointer-events-auto"
                  modifiers={{
                    hasAppointment: (date) => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      return datesWithAppointments.has(dateStr);
                    },
                    hasConfirmed: (date) => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      return datesWithAppointments.get(dateStr)?.hasConfirmed || false;
                    },
                    hasPending: (date) => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      const info = datesWithAppointments.get(dateStr);
                      return info?.hasPending && !info?.hasConfirmed || false;
                    },
                  }}
                  modifiersStyles={{
                    hasConfirmed: {
                      backgroundColor: "hsl(var(--primary) / 0.2)",
                      color: "hsl(var(--primary))",
                      fontWeight: "bold",
                    },
                    hasPending: {
                      backgroundColor: "hsl(45 93% 47% / 0.2)",
                      color: "hsl(45 93% 37%)",
                      fontWeight: "bold",
                    },
                  }}
                />
                
                {/* Legend */}
                <div className="flex justify-center gap-4 mt-4 text-xs font-body">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-primary/30" />
                    <span className="text-muted-foreground">Confirmado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-amber-400/30" />
                    <span className="text-muted-foreground">Pendente</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Appointments for Selected Date */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-lg">
                  {selectedDate ? (
                    <>
                      📅 {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                      <Badge variant="secondary" className="ml-2 font-body text-xs">
                        {selectedDateAppointments.length} agendamento{selectedDateAppointments.length !== 1 ? "s" : ""}
                      </Badge>
                    </>
                  ) : (
                    "Selecione uma data"
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDateAppointments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground font-body">
                    <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhum agendamento nesta data</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    <AnimatePresence>
                      {selectedDateAppointments.map((appointment, index) => (
                        <motion.div
                          key={appointment.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-secondary/30 rounded-xl p-4 border border-border"
                        >
                          {/* Time & Status */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-primary" />
                              <span className="font-display font-semibold text-foreground">
                                {appointment.appointment_time.slice(0, 5)}
                              </span>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={`${statusColors[appointment.status]} font-body text-xs`}
                            >
                              {statusLabels[appointment.status]}
                            </Badge>
                          </div>

                          {/* Client Info */}
                          <div className="space-y-1.5 mb-3">
                            <div className="flex items-center gap-2 text-foreground">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-body font-medium">{appointment.client_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                              <Phone className="h-3.5 w-3.5" />
                              <a 
                                href={`https://wa.me/${appointment.client_phone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-body text-primary hover:underline"
                              >
                                {appointment.client_phone}
                              </a>
                            </div>
                            <p className="text-sm text-primary font-medium font-body pl-6">
                              💅 {appointment.service_type}
                            </p>
                            {appointment.notes && (
                              <p className="text-xs text-muted-foreground font-body pl-6 italic">
                                📝 {appointment.notes}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          {appointment.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateStatus(appointment.id, "confirmed")}
                                disabled={isUpdating === appointment.id}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                              >
                                {isUpdating === appointment.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="h-3 w-3 mr-1" />
                                    Confirmar
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatus(appointment.id, "cancelled")}
                                disabled={isUpdating === appointment.id}
                                className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 h-8 text-xs"
                              >
                                {isUpdating === appointment.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <X className="h-3 w-3 mr-1" />
                                    Cancelar
                                  </>
                                )}
                              </Button>
                            </div>
                          )}

                          {appointment.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(appointment.id, "cancelled")}
                              disabled={isUpdating === appointment.id}
                              className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 h-8 text-xs"
                            >
                              {isUpdating === appointment.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <X className="h-3 w-3 mr-1" />
                                  Cancelar agendamento
                                </>
                              )}
                            </Button>
                          )}

                          {appointment.status === "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatus(appointment.id, "pending")}
                              disabled={isUpdating === appointment.id}
                              className="w-full h-8 text-xs"
                            >
                              {isUpdating === appointment.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Reativar como pendente"
                              )}
                            </Button>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
