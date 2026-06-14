import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
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
  User,
  Lock,
  Unlock,
  Plus,
  Trash2,
  MessageCircle,
  DollarSign
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useToast } from "@/hooks/use-toast";
import ServicesManager from "@/components/admin/ServicesManager";
import TimeSlotsManager from "@/components/admin/TimeSlotsManager";
import GalleryManager from "@/components/admin/GalleryManager";
import SiteSettingsManager from "@/components/admin/SiteSettingsManager";
import ThemeColorManager from "@/components/admin/ThemeColorManager";
import FontManager from "@/components/admin/FontManager";
import WhatsAppApiManager from "@/components/admin/WhatsAppApiManager";
import WhatsAppAvailability from "@/components/WhatsAppAvailability";
import AppointmentsManager from "@/components/admin/AppointmentsManager";
import type { Tables } from "@/integrations/supabase/types";

type Appointment = Tables<"appointments">;
type BlockedSlot = Tables<"blocked_slots">;

// Default time slots (fallback if database is empty)
const defaultTimeSlots = [
  "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
  blocked: "bg-slate-200 text-slate-700 border-slate-300",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  blocked: "Bloqueado",
};

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: isCheckingRole } = useAdminRole();
  const { toast } = useToast();
  const { getSetting } = useSiteSettings();
  const whatsappNumber = getSetting("whatsapp_number", "559191837179");
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>(defaultTimeSlots);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [selectedTimeToBlock, setSelectedTimeToBlock] = useState<string>("");

  useEffect(() => {
    if (!isCheckingRole && !isAdmin) {
      navigate("/");
    }
  }, [isCheckingRole, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, filter]);

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchAppointments(), fetchBlockedSlots(), fetchTimeSlots()]);
    setIsLoading(false);
  };

  const fetchTimeSlots = async () => {
    const { data, error } = await supabase
      .from("available_times")
      .select("time_slot")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (!error && data && data.length > 0) {
      setTimeSlots(data.map((t) => t.time_slot.slice(0, 5)));
    }
  };

  const fetchAppointments = async () => {
    let query = supabase
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (filter !== "all" && filter !== "blocked") {
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
  };

  const fetchBlockedSlots = async () => {
    const { data, error } = await supabase
      .from("blocked_slots")
      .select("*")
      .order("blocked_date", { ascending: true })
      .order("blocked_time", { ascending: true });

    if (!error && data) {
      setBlockedSlots(data);
    }
  };

  const bibleVerses = [
    "O Senhor é o meu pastor, nada me faltará. - Salmos 23:1",
    "Tudo posso naquele que me fortalece. - Filipenses 4:13",
    "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito. - João 3:16",
    "O Senhor é a minha luz e a minha salvação; a quem temerei? - Salmos 27:1",
    "Confie no Senhor de todo o seu coração. - Provérbios 3:5",
    "Alegrem-se sempre no Senhor. Novamente direi: alegrem-se! - Filipenses 4:4",
    "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia. - Salmos 46:1",
    "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará. - Salmos 37:5",
    "Porque sou eu que conheço os planos que tenho para vocês, planos de prosperidade. - Jeremias 29:11",
    "Mas os que esperam no Senhor renovarão as suas forças. - Isaías 40:31",
    "Seja forte e corajoso! Não se apavore, nem desanime, pois o Senhor estará com você. - Josué 1:9",
    "A paz vos deixo, a minha paz vos dou. - João 14:27",
  ];

  const getRandomVerse = () => {
    return bibleVerses[Math.floor(Math.random() * bibleVerses.length)];
  };

  const updateStatus = async (id: string, status: string, appointment?: Appointment) => {
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

      // Send WhatsApp confirmation message
      if (status === "confirmed" && appointment) {
        const formattedDate = format(parseISO(appointment.appointment_date), "dd/MM/yyyy", { locale: ptBR });
        const message = encodeURIComponent(
          `Olá ${appointment.client_name}!\n\n` +
          `Seu agendamento foi *CONFIRMADO*!\n\n` +
          `*Data:* ${formattedDate}\n` +
          `*Horário:* ${appointment.appointment_time.slice(0, 5)}\n` +
          `*Serviço:* ${appointment.service_type}\n\n` +
          `${getRandomVerse()}\n\n` +
          `Te espero!`
        );
        window.open(`https://wa.me/${appointment.client_phone.replace(/\D/g, '')}?text=${message}`, "_blank");
      }

      fetchAppointments();
    }
    
    setIsUpdating(null);
  };

  const sendWhatsAppMessage = (appointment: Appointment) => {
    const formattedDate = format(parseISO(appointment.appointment_date), "dd/MM/yyyy", { locale: ptBR });
    const message = encodeURIComponent(
      `Olá ${appointment.client_name}!\n\n` +
      `Seu agendamento foi *CONFIRMADO*!\n\n` +
      `*Data:* ${formattedDate}\n` +
      `*Horário:* ${appointment.appointment_time.slice(0, 5)}\n` +
      `*Serviço:* ${appointment.service_type}\n\n` +
      `${getRandomVerse()}\n\n` +
      `Te espero!`
    );
    window.open(`https://wa.me/${appointment.client_phone.replace(/\D/g, '')}?text=${message}`, "_blank");
  };

  const blockTimeSlot = async () => {
    if (!selectedDate || !selectedTimeToBlock) {
      toast({
        title: "Selecione data e horário",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("blocked_slots").insert({
      blocked_date: format(selectedDate, "yyyy-MM-dd"),
      blocked_time: selectedTimeToBlock,
      reason: blockReason || null,
      created_by: user?.id || null,
    });

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Horário já bloqueado",
          description: "Este horário já está bloqueado.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao bloquear",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Horário bloqueado!",
        description: `${format(selectedDate, "dd/MM")} às ${selectedTimeToBlock}`,
      });
      setIsBlockDialogOpen(false);
      setBlockReason("");
      setSelectedTimeToBlock("");
      fetchBlockedSlots();
    }
  };

  const unblockTimeSlot = async (slotId: string) => {
    setIsUpdating(slotId);
    
    const { error } = await supabase
      .from("blocked_slots")
      .delete()
      .eq("id", slotId);

    if (error) {
      toast({
        title: "Erro ao desbloquear",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Horário desbloqueado!",
      });
      fetchBlockedSlots();
    }
    
    setIsUpdating(null);
  };

  const deleteAppointment = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este agendamento permanentemente?")) {
      return;
    }
    
    setIsUpdating(id);
    
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Agendamento excluído!",
        description: "O agendamento foi removido permanentemente.",
      });
      fetchAppointments();
    }
    
    setIsUpdating(null);
  };

  // Get dates that have appointments or blocked slots
  const getDatesWithEvents = () => {
    const dates = new Map<string, { hasConfirmed: boolean; hasPending: boolean; hasBlocked: boolean }>();
    
    appointments.forEach((apt) => {
      const dateKey = apt.appointment_date;
      const existing = dates.get(dateKey) || { hasConfirmed: false, hasPending: false, hasBlocked: false };
      if (apt.status === "confirmed") existing.hasConfirmed = true;
      if (apt.status === "pending") existing.hasPending = true;
      dates.set(dateKey, existing);
    });

    blockedSlots.forEach((slot) => {
      const dateKey = slot.blocked_date;
      const existing = dates.get(dateKey) || { hasConfirmed: false, hasPending: false, hasBlocked: false };
      existing.hasBlocked = true;
      dates.set(dateKey, existing);
    });
    
    return dates;
  };

  // Get appointments and blocked slots for selected date
  const getEventsForDate = (date: Date | undefined) => {
    if (!date) return { appointments: [], blocked: [] };
    const dateStr = format(date, "yyyy-MM-dd");
    return {
      appointments: appointments.filter((apt) => apt.appointment_date === dateStr),
      blocked: blockedSlots.filter((slot) => slot.blocked_date === dateStr),
    };
  };

  // Get available times to block for selected date
  const getAvailableTimesToBlock = () => {
    if (!selectedDate) return timeSlots;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    const bookedTimes = appointments
      .filter((apt) => apt.appointment_date === dateStr && apt.status !== "cancelled")
      .map((apt) => apt.appointment_time.slice(0, 5));
    
    const blockedTimes = blockedSlots
      .filter((slot) => slot.blocked_date === dateStr)
      .map((slot) => slot.blocked_time.slice(0, 5));

    const unavailableTimes = [...bookedTimes, ...blockedTimes];
    return timeSlots.filter((time) => !unavailableTimes.includes(time));
  };

  const datesWithEvents = getDatesWithEvents();
  const selectedDateEvents = getEventsForDate(selectedDate);
  const availableTimesToBlock = getAvailableTimesToBlock();

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
    <div className="min-h-screen bg-background pb-4">
      {/* Header */}
      <header className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border z-40">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="text-muted-foreground h-9 w-9"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-display text-lg sm:text-xl font-semibold text-foreground">
                  Painel Admin
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground font-body">
                  Gerenciar agendamentos
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="gap-1.5 h-8 text-xs sm:text-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32 sm:w-40 h-9">
              <SelectValue placeholder="Filtrar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="confirmed">Confirmados</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="font-body text-xs">
            {appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}
          </Badge>
          <Badge variant="outline" className="font-body text-xs text-muted-foreground">
            <Lock className="h-3 w-3 mr-1" />
            {blockedSlots.length} bloqueado{blockedSlots.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-3 sm:px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
            {/* Calendar Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  Calendário de Agendamentos
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={ptBR}
                  className="rounded-xl border border-border mx-auto pointer-events-auto w-full [&_.rdp-table]:w-full"
                  modifiers={{
                    hasConfirmed: (date) => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      return datesWithEvents.get(dateStr)?.hasConfirmed || false;
                    },
                    hasPending: (date) => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      const info = datesWithEvents.get(dateStr);
                      return info?.hasPending && !info?.hasConfirmed || false;
                    },
                    hasBlocked: (date) => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      const info = datesWithEvents.get(dateStr);
                      return info?.hasBlocked && !info?.hasConfirmed && !info?.hasPending || false;
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
                    hasBlocked: {
                      backgroundColor: "hsl(var(--muted))",
                      color: "hsl(var(--muted-foreground))",
                      fontWeight: "bold",
                    },
                  }}
                />
                
                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs font-body">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-primary/30" />
                    <span className="text-muted-foreground">Confirmado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-amber-400/30" />
                    <span className="text-muted-foreground">Pendente</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-muted" />
                    <span className="text-muted-foreground">Bloqueado</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Appointments for Selected Date */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-lg">
                    {selectedDate ? (
                      <>
                        📅 {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                      </>
                    ) : (
                      "Selecione uma data"
                    )}
                  </CardTitle>
                  
                  {selectedDate && (
                    <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <Lock className="h-3.5 w-3.5" />
                          Bloquear
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="font-display">
                            Bloquear Horário - {format(selectedDate, "dd/MM/yyyy")}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label className="font-body">Horário</Label>
                            {availableTimesToBlock.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Todos os horários já estão ocupados ou bloqueados.
                              </p>
                            ) : (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {availableTimesToBlock.map((time) => (
                                  <button
                                    key={time}
                                    onClick={() => setSelectedTimeToBlock(time)}
                                    className={`
                                      py-2 px-2 rounded-lg font-body text-sm transition-all
                                      ${selectedTimeToBlock === time
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary text-secondary-foreground hover:bg-primary/20"
                                      }
                                    `}
                                  >
                                    {time}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="reason" className="font-body">Motivo (opcional)</Label>
                            <Input
                              id="reason"
                              value={blockReason}
                              onChange={(e) => setBlockReason(e.target.value)}
                              placeholder="Ex: Compromisso pessoal"
                              className="bg-secondary/50"
                            />
                          </div>
                          <Button
                            onClick={blockTimeSlot}
                            disabled={!selectedTimeToBlock}
                            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            <Lock className="h-4 w-4 mr-2" />
                            Bloquear Horário
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                
                {selectedDate && (
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="font-body text-xs">
                      {selectedDateEvents.appointments.length} agendamento{selectedDateEvents.appointments.length !== 1 ? "s" : ""}
                    </Badge>
                    {selectedDateEvents.blocked.length > 0 && (
                      <Badge variant="outline" className="font-body text-xs text-muted-foreground">
                        <Lock className="h-2.5 w-2.5 mr-1" />
                        {selectedDateEvents.blocked.length} bloqueado{selectedDateEvents.blocked.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {selectedDateEvents.appointments.length === 0 && selectedDateEvents.blocked.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground font-body">
                    <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhum agendamento ou bloqueio nesta data</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[60vh] sm:max-h-[400px] overflow-y-auto pr-1">
                    <AnimatePresence>
                      {/* Blocked Slots */}
                      {selectedDateEvents.blocked.map((slot, index) => (
                        <motion.div
                          key={`blocked-${slot.id}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-muted/50 rounded-xl p-4 border border-border"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Lock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-display font-semibold text-muted-foreground">
                                {slot.blocked_time.slice(0, 5)}
                              </span>
                              <Badge variant="outline" className={`${statusColors.blocked} font-body text-xs`}>
                                Bloqueado
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => unblockTimeSlot(slot.id)}
                              disabled={isUpdating === slot.id}
                              className="h-8 text-xs text-muted-foreground hover:text-foreground"
                            >
                              {isUpdating === slot.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Unlock className="h-3 w-3 mr-1" />
                                  Desbloquear
                                </>
                              )}
                            </Button>
                          </div>
                          {slot.reason && (
                            <p className="text-xs text-muted-foreground mt-2 pl-6 italic">
                              📝 {slot.reason}
                            </p>
                          )}
                        </motion.div>
                      ))}

                      {/* Appointments */}
                      {selectedDateEvents.appointments.map((appointment, index) => (
                        <motion.div
                          key={appointment.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: (selectedDateEvents.blocked.length + index) * 0.05 }}
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
                                onClick={() => updateStatus(appointment.id, "confirmed", appointment)}
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
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => sendWhatsAppMessage(appointment)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-9 sm:h-8 text-xs"
                              >
                                <MessageCircle className="h-3.5 w-3.5 mr-1" />
                                Enviar WhatsApp
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatus(appointment.id, "cancelled")}
                                disabled={isUpdating === appointment.id}
                                className="border-rose-200 text-rose-600 hover:bg-rose-50 h-9 sm:h-8 text-xs"
                              >
                                {isUpdating === appointment.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          )}

                          {appointment.status === "cancelled" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatus(appointment.id, "pending")}
                                disabled={isUpdating === appointment.id}
                                className="flex-1 h-8 text-xs"
                              >
                                {isUpdating === appointment.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Reativar como pendente"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteAppointment(appointment.id)}
                                disabled={isUpdating === appointment.id}
                                className="h-8 text-xs"
                              >
                                {isUpdating === appointment.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* All Appointments Manager */}
          <div className="mt-6">
            <AppointmentsManager />
          </div>

          {/* Time Slots, Services & WhatsApp */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6">
            <div className="space-y-4">
              <TimeSlotsManager />
              <WhatsAppAvailability whatsappNumber={whatsappNumber} />
            </div>
            <ServicesManager />
          </div>

          {/* Gallery Manager */}
          <div className="mt-6">
            <GalleryManager />
          </div>

          {/* Site Settings & Theme Manager */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6">
            <SiteSettingsManager />
            <ThemeColorManager />
          </div>

          {/* Font Manager */}
          {/* Font Manager & WhatsApp API */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6">
            <FontManager />
            <WhatsAppApiManager />
          </div>
        </>
        )}
      </div>
    </div>
  );
};

export default Admin;
