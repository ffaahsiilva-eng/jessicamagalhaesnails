import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Calendar as CalendarIcon,
  Check,
  X,
  Clock,
  Phone,
  Loader2,
  Filter,
  User,
  Trash2,
  MessageCircle,
  Pencil,
  Search,
  Bell,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { notifyWhatsAppBooking } from "@/lib/whatsapp";
import { calculateServicesTotal, extractPriceFromNotes, cleanNotesForDisplay } from "@/lib/price";
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

const bibleVerses = [
  "O Senhor é o meu pastor, nada me faltará. - Salmos 23:1",
  "Tudo posso naquele que me fortalece. - Filipenses 4:13",
  "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito. - João 3:16",
  "Confie no Senhor de todo o seu coração. - Provérbios 3:5",
  "Alegrem-se sempre no Senhor. Novamente direi: alegrem-se! - Filipenses 4:4",
  "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará. - Salmos 37:5",
  "Seja forte e corajoso! Não se apavore, nem desanime, pois o Senhor estará com você. - Josué 1:9",
];

interface AppointmentsManagerProps {
  onAppointmentUpdated?: () => void;
}

const AppointmentsManager = ({ onAppointmentUpdated }: AppointmentsManagerProps = {}) => {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isSendingSummary, setIsSendingSummary] = useState(false);
  const [servicesList, setServicesList] = useState<Array<{ name: string; price: string }>>([]);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState({
    client_name: "",
    client_phone: "",
    client_email: "",
    service_type: "",
    appointment_date: "",
    appointment_time: "",
    notes: "",
    status: "",
  });

  useEffect(() => {
    fetchAppointments();
  }, [filter]);

  // Sincronização em tempo real entre a lista inferior e o painel superior
  useEffect(() => {
    const handleSync = () => {
      fetchAppointments();
    };
    window.addEventListener("appointments-changed", handleSync);

    const channel = supabase
      .channel("manager-appointments-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => {
          fetchAppointments();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("appointments-changed", handleSync);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const fetchServices = async () => {
      const { data } = await supabase
        .from("services")
        .select("name, price")
        .eq("is_active", true);
      if (data) setServicesList(data);
    };
    fetchServices();
  }, []);

  const getAppointmentPrice = (apt: Appointment): string => {
    // 1. Tentar de anotações internas [Valor: ...]
    const fromNotes = extractPriceFromNotes(apt.notes);
    if (fromNotes) return fromNotes;

    // 2. Tentar calcular dos serviços ativos
    if (servicesList.length > 0 && apt.service_type) {
      const { totalFormatted } = calculateServicesTotal(apt.service_type, servicesList);
      if (totalFormatted) return totalFormatted;
    }
    return "";
  };

  // Checar se há link de confirmação direta via URL (?confirm_id=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const confirmId = params.get("confirm_id");
    if (confirmId && appointments.length > 0) {
      const targetAppt = appointments.find((a) => a.id === confirmId);
      if (targetAppt && targetAppt.status === "pending") {
        if (window.confirm(`Deseja confirmar o agendamento de ${targetAppt.client_name} (${targetAppt.service_type}) para ${targetAppt.appointment_date} às ${targetAppt.appointment_time.slice(0, 5)}?`)) {
          updateStatus(targetAppt.id, "confirmed", targetAppt);
        }
      }
    }
  }, [appointments]);

  const fetchAppointments = async () => {
    setIsLoading(true);
    let query = supabase
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: true });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setAppointments(data || []);
    }
    setIsLoading(false);
  };

  const getRandomVerse = () => bibleVerses[Math.floor(Math.random() * bibleVerses.length)];

  const sendWhatsAppConfirmation = (apt: Appointment) => {
    const formattedDate = format(parseISO(apt.appointment_date), "dd/MM/yyyy", { locale: ptBR });
    const isMulti = apt.service_type.includes("+") || apt.service_type.includes(",");
    const serviceLabel = isMulti ? "Serviços" : "Serviço";
    const price = getAppointmentPrice(apt);
    const priceLabel = isMulti ? "Valor Total" : "Valor";
    const priceLine = price ? `💰 *${priceLabel}:* ${price}\n` : "";

    let rawText = "";
    if (apt.status === "cancelled") {
      rawText =
        `❌ *AGENDAMENTO CANCELADO* ❌\n\n` +
        `Olá, *${apt.client_name}*! Informamos que o seu agendamento com Jéssica Magalhães foi cancelado:\n\n` +
        `💅 *${serviceLabel}:* ${apt.service_type}\n` +
        `📅 *Data:* ${formattedDate}\n` +
        `🕐 *Horário:* ${apt.appointment_time.slice(0, 5)}\n` +
        priceLine +
        `\nCaso deseje remarcar para outro dia ou horário disponível, acesse nosso site:\n` +
        `👉 https://jessicamagalhaesnail.vercel.app\n\n` +
        `Te esperamos em breve! 💕`;
    } else {
      rawText =
        `✨ Olá *${apt.client_name}*! ✨\n\n` +
        `✅ Seu agendamento foi *CONFIRMADO*! 💕\n\n` +
        `💅 *${serviceLabel}:* ${apt.service_type}\n` +
        priceLine +
        `📅 *Data:* ${formattedDate}\n` +
        `🕐 *Horário:* ${apt.appointment_time.slice(0, 5)}\n\n` +
        `📖 ${getRandomVerse()}\n\n` +
        `⏰ *Tolerância de 15 minutos para chegada.*\n\n` +
        `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
        `🙏 Te esperamos com muito carinho! 💕`;
    }

    const message = encodeURIComponent(rawText);
    const phone = apt.client_phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  const notifyAdmin = async (apt: Appointment, action: "confirmed" | "cancelled") => {
    try {
      const price = getAppointmentPrice(apt);
      await notifyWhatsAppBooking({
        appointment_id: apt.id,
        client_name: apt.client_name,
        client_phone: apt.client_phone,
        client_email: apt.client_email,
        service_type: apt.service_type,
        service_price: price || null,
        appointment_date: apt.appointment_date,
        appointment_time: apt.appointment_time,
        notes: apt.notes,
        site_url: window.location.origin,
        action,
      });
    } catch (e) {
      console.error("notifyWhatsAppBooking failed", e);
    }
  };

  const sendReminder = async (apt: Appointment, type: "reminder_24h" | "reminder_2h" | "reminder_20d") => {
    setIsUpdating(apt.id);
    try {
      const price = getAppointmentPrice(apt);
      const res = await notifyWhatsAppBooking({
        appointment_id: apt.id,
        client_name: apt.client_name,
        client_phone: apt.client_phone,
        client_email: apt.client_email,
        service_type: apt.service_type,
        service_price: price || null,
        appointment_date: apt.appointment_date,
        appointment_time: apt.appointment_time,
        notes: apt.notes,
        site_url: window.location.origin,
        action: type,
      });

      if (res && ((res as { success?: boolean }).success || (res as { via?: string }).via)) {
        const label =
          type === "reminder_24h"
            ? "1 dia antes"
            : type === "reminder_2h"
            ? "2 horas antes"
            : "Manutenção (20 dias)";
        toast({
          title: `Lembrete (${label}) enviado!`,
          description: `Mensagem enviada para ${apt.client_name} e para a administradora.`,
        });
      } else {
        toast({
          title: "Atenção",
          description: (res as { reason?: string })?.reason || "Verifique as configurações da API do WhatsApp.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Erro ao enviar",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const handleSendDailySummary = async () => {
    setIsSendingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-appointments-summary");
      if (error) throw error;
      if (data && (data as { error?: string }).error) {
        throw new Error((data as { error: string }).error);
      }
      toast({
        title: "Resumo matinal enviado!",
        description: "Os agendamentos de hoje foram enviados para o seu WhatsApp.",
      });
    } catch (e) {
      toast({
        title: "Erro ao enviar resumo",
        description: (e as Error).message || "Verifique se a API do WhatsApp está conectada.",
        variant: "destructive",
      });
    } finally {
      setIsSendingSummary(false);
    }
  };

  const updateStatus = async (id: string, status: string, apt?: Appointment) => {
    if (status === "cancelled") {
      const name = apt?.client_name || "este agendamento";
      if (!window.confirm(`Deseja cancelar o agendamento de ${name}?\n\nUma notificação de cancelamento será enviada automaticamente para o WhatsApp da cliente e da administradora.`)) {
        return;
      }
    }
    setIsUpdating(id);

    // Atualização otimista imediata para sincronizar na hora a tela toda
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
    window.dispatchEvent(new CustomEvent("appointments-changed"));
    onAppointmentUpdated?.();

    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      await fetchAppointments();
      window.dispatchEvent(new CustomEvent("appointments-changed"));
      onAppointmentUpdated?.();
    } else {
      toast({
        title: `Status: ${statusLabels[status]}`,
        description: status === "cancelled"
          ? "Cancelamento registrado e enviado via WhatsApp para cliente e admin."
          : undefined,
      });
      if (apt && (status === "confirmed" || status === "cancelled")) {
        await notifyAdmin(apt, status);
      }
      if (status === "confirmed" && apt) sendWhatsAppConfirmation(apt);
      await fetchAppointments();
      window.dispatchEvent(new CustomEvent("appointments-changed"));
      onAppointmentUpdated?.();
    }
    setIsUpdating(null);
  };

  const deleteAppointment = async (id: string) => {
    if (!confirm("Excluir este agendamento permanentemente?")) return;
    setIsUpdating(id);
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    window.dispatchEvent(new CustomEvent("appointments-changed"));
    onAppointmentUpdated?.();

    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      await fetchAppointments();
      window.dispatchEvent(new CustomEvent("appointments-changed"));
      onAppointmentUpdated?.();
    } else {
      toast({ title: "Agendamento excluído!" });
      await fetchAppointments();
      window.dispatchEvent(new CustomEvent("appointments-changed"));
      onAppointmentUpdated?.();
    }
    setIsUpdating(null);
  };

  const openEdit = (apt: Appointment) => {
    setEditingAppointment(apt);
    setEditForm({
      client_name: apt.client_name,
      client_phone: apt.client_phone,
      client_email: apt.client_email || "",
      service_type: apt.service_type,
      appointment_date: apt.appointment_date,
      appointment_time: apt.appointment_time.slice(0, 5),
      notes: apt.notes || "",
      status: apt.status,
    });
  };

  const saveEdit = async () => {
    if (!editingAppointment) return;
    setIsUpdating(editingAppointment.id);
    const { error } = await supabase
      .from("appointments")
      .update({
        client_name: editForm.client_name,
        client_phone: editForm.client_phone,
        client_email: editForm.client_email || null,
        service_type: editForm.service_type,
        appointment_date: editForm.appointment_date,
        appointment_time: editForm.appointment_time,
        notes: editForm.notes || null,
        status: editForm.status,
      })
      .eq("id", editingAppointment.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Agendamento atualizado!" });
      const updatedApt: Appointment = {
        ...editingAppointment,
        client_name: editForm.client_name,
        client_phone: editForm.client_phone,
        client_email: editForm.client_email || null,
        service_type: editForm.service_type,
        appointment_date: editForm.appointment_date,
        appointment_time: editForm.appointment_time,
        notes: editForm.notes || null,
        status: editForm.status,
      };

      if (editForm.status !== editingAppointment.status) {
        if (editForm.status === "confirmed" || editForm.status === "cancelled") {
          await notifyAdmin(updatedApt, editForm.status as "confirmed" | "cancelled");
        }
      }

      setEditingAppointment(null);
      await fetchAppointments();
      window.dispatchEvent(new CustomEvent("appointments-changed"));
      onAppointmentUpdated?.();
    }
    setIsUpdating(null);
  };

  const filtered = appointments.filter((apt) => {
    if (selectedDate) {
      const targetDateStr = format(selectedDate, "yyyy-MM-dd");
      const aptDate = (apt.appointment_date || "").split("T")[0].trim();
      if (aptDate !== targetDateStr) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      apt.client_name.toLowerCase().includes(q) ||
      apt.client_phone.includes(q) ||
      apt.service_type.toLowerCase().includes(q)
    );
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Todos os Agendamentos
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendDailySummary}
            disabled={isSendingSummary}
            className="w-fit text-xs font-body text-primary border-primary/30 hover:bg-primary/10"
            title="Enviar agora a lista de agendamentos de hoje para o WhatsApp da administradora"
          >
            {isSendingSummary ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Resumo de Hoje no WhatsApp
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou serviço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Filtro por Data com Calendário */}
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 justify-start text-left font-normal font-body text-xs sm:text-sm",
                    selectedDate ? "border-primary text-primary font-medium bg-primary/5" : "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {selectedDate ? (
                    format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                  ) : (
                    <span>Filtrar por data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => setSelectedDate(date)}
                  initialFocus
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {selectedDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(undefined)}
                className="h-9 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                title="Limpar filtro de data"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-36 h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="confirmed">Confirmados</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="secondary" className="font-body text-xs w-fit">
            {filtered.length} agendamento{filtered.length !== 1 ? "s" : ""}
          </Badge>
          {selectedDate && (
            <Badge variant="outline" className="font-body text-xs border-primary/40 text-primary flex items-center gap-1.5">
              <span>Data: {format(selectedDate, "dd/MM/yyyy")}</span>
              <button
                type="button"
                onClick={() => setSelectedDate(undefined)}
                className="hover:text-destructive transition-colors ml-0.5"
                title="Remover filtro de data"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground font-body">
            <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-foreground">Nenhum agendamento encontrado</p>
            {selectedDate ? (
              <p className="text-sm mt-1">
                Não há agendamentos para o dia {format(selectedDate, "dd/MM/yyyy")}.{" "}
                <button
                  type="button"
                  onClick={() => setSelectedDate(undefined)}
                  className="text-primary underline ml-1 hover:opacity-80"
                >
                  Ver todas as datas
                </button>
              </p>
            ) : (
              <p className="text-sm mt-1">
                {search ? "Tente outro termo de busca" : "Não há agendamentos cadastrados"}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filtered.map((apt) => (
                      <motion.tr
                        key={apt.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="font-body text-sm">
                          {format(parseISO(apt.appointment_date), "dd/MM/yy")}
                        </TableCell>
                        <TableCell className="font-body text-sm font-medium">
                          {apt.appointment_time.slice(0, 5)}
                        </TableCell>
                        <TableCell className="font-body text-sm font-medium">
                          {apt.client_name}
                        </TableCell>
                        <TableCell className="font-body text-sm">
                          {apt.client_phone}
                        </TableCell>
                        <TableCell className="font-body text-sm">
                          <div className="font-medium text-foreground">{apt.service_type}</div>
                          {getAppointmentPrice(apt) && (
                            <div className="text-xs font-semibold text-primary mt-0.5">
                              💰 {getAppointmentPrice(apt)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${statusColors[apt.status]} text-xs`}>
                            {statusLabels[apt.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {apt.status === "pending" && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => updateStatus(apt.id, "confirmed", apt)}
                                  disabled={isUpdating === apt.id}
                                  title="Confirmar"
                                >
                                  {isUpdating === apt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                  onClick={() => updateStatus(apt.id, "cancelled", apt)}
                                  disabled={isUpdating === apt.id}
                                  title="Cancelar"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {apt.status === "confirmed" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                onClick={() => updateStatus(apt.id, "cancelled", apt)}
                                disabled={isUpdating === apt.id}
                                title="Cancelar Agendamento"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                            {apt.status === "cancelled" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => updateStatus(apt.id, "confirmed", apt)}
                                disabled={isUpdating === apt.id}
                                title="Reativar / Confirmar"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
                              onClick={() => sendWhatsAppConfirmation(apt)}
                              title={apt.status === "cancelled" ? "Enviar aviso de cancelamento via WhatsApp" : "Enviar confirmação via WhatsApp"}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  disabled={isUpdating === apt.id}
                                  title="Enviar Lembrete via WhatsApp (Cliente + Admin)"
                                >
                                  {isUpdating === apt.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 font-body">
                                <DropdownMenuItem onClick={() => sendReminder(apt, "reminder_24h")}>
                                  <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                                  <span>Lembrete 1 dia antes (24h)</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => sendReminder(apt, "reminder_2h")}>
                                  <Clock className="h-4 w-4 mr-2 text-amber-500" />
                                  <span>Lembrete 2 horas antes</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => sendReminder(apt, "reminder_20d")}>
                                  <Sparkles className="h-4 w-4 mr-2 text-rose-500" />
                                  <span>Manutenção (20 dias)</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => openEdit(apt)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => deleteAppointment(apt.id)}
                              disabled={isUpdating === apt.id}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3 max-h-[70vh] overflow-y-auto">
              <AnimatePresence>
                {filtered.map((apt, i) => (
                  <motion.div
                    key={apt.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-secondary/30 rounded-xl p-4 border border-border space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-display font-semibold">
                          {format(parseISO(apt.appointment_date), "dd/MM")} • {apt.appointment_time.slice(0, 5)}
                        </span>
                      </div>
                      <Badge variant="outline" className={`${statusColors[apt.status]} text-xs`}>
                        {statusLabels[apt.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-body font-medium text-sm">{apt.client_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-body text-sm text-muted-foreground">{apt.client_phone}</span>
                    </div>
                    <p className="text-sm text-primary font-medium font-body">💅 {apt.service_type}</p>
                    {getAppointmentPrice(apt) && (
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        💰 {getAppointmentPrice(apt)}
                      </p>
                    )}
                    {cleanNotesForDisplay(apt.notes) && (
                      <p className="text-xs text-muted-foreground italic">📝 {cleanNotesForDisplay(apt.notes)}</p>
                    )}
                    <div className="flex gap-1.5 pt-1">
                      {apt.status === "pending" && (
                        <>
                          <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs" onClick={() => updateStatus(apt.id, "confirmed", apt)} disabled={isUpdating === apt.id}>
                            <Check className="h-3 w-3 mr-1" /> Confirmar
                          </Button>
                          <Button size="sm" variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50 h-8 text-xs" onClick={() => updateStatus(apt.id, "cancelled", apt)} disabled={isUpdating === apt.id} title="Cancelar">
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {apt.status === "confirmed" && (
                        <Button size="sm" variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50 h-8 text-xs" onClick={() => updateStatus(apt.id, "cancelled", apt)} disabled={isUpdating === apt.id}>
                          <X className="h-3 w-3 mr-1" /> Cancelar
                        </Button>
                      )}
                      {apt.status === "cancelled" && (
                        <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 h-8 text-xs" onClick={() => updateStatus(apt.id, "confirmed", apt)} disabled={isUpdating === apt.id}>
                          <Check className="h-3 w-3 mr-1" /> Reativar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-8 text-xs text-emerald-600 border-emerald-200" onClick={() => sendWhatsAppConfirmation(apt)}>
                        <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 text-xs text-amber-600 border-amber-200 hover:bg-amber-50" disabled={isUpdating === apt.id}>
                            {isUpdating === apt.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Bell className="h-3 w-3 mr-1" />} Lembrar
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 font-body">
                          <DropdownMenuItem onClick={() => sendReminder(apt, "reminder_24h")}>
                            <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                            <span>1 dia antes (24h)</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => sendReminder(apt, "reminder_2h")}>
                            <Clock className="h-4 w-4 mr-2 text-amber-500" />
                            <span>2 horas antes</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => sendReminder(apt, "reminder_20d")}>
                            <Sparkles className="h-4 w-4 mr-2 text-rose-500" />
                            <span>Manutenção (20 dias)</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(apt)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-500" onClick={() => deleteAppointment(apt.id)} disabled={isUpdating === apt.id}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingAppointment} onOpenChange={(open) => !open && setEditingAppointment(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Editar Agendamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-body text-sm">Nome</Label>
                  <Input value={editForm.client_name} onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-sm">Telefone</Label>
                  <Input value={editForm.client_phone} onChange={(e) => setEditForm({ ...editForm, client_phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-sm">Email</Label>
                <Input value={editForm.client_email} onChange={(e) => setEditForm({ ...editForm, client_email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-sm">Serviço</Label>
                <Input value={editForm.service_type} onChange={(e) => setEditForm({ ...editForm, service_type: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-body text-sm">Data</Label>
                  <Input type="date" value={editForm.appointment_date} onChange={(e) => setEditForm({ ...editForm, appointment_date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-body text-sm">Horário</Label>
                  <Input type="time" value={editForm.appointment_time} onChange={(e) => setEditForm({ ...editForm, appointment_time: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-sm">Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-body text-sm">Observações</Label>
                <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Opcional" />
              </div>
              <Button onClick={saveEdit} disabled={isUpdating === editingAppointment?.id} className="w-full">
                {isUpdating === editingAppointment?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AppointmentsManager;
