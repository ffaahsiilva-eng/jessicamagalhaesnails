import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Clock,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Copy,
  CalendarOff,
  CalendarIcon,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TimeSlot {
  id: string;
  time_slot: string;
  is_active: boolean;
  display_order: number;
  day_type: string;
}

interface BlockedSlot {
  id: string;
  blocked_date: string;
  blocked_time: string;
  reason: string | null;
}

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
};
const DAY_SHORT: Record<string, string> = {
  monday: "Seg",
  tuesday: "Ter",
  wednesday: "Qua",
  thursday: "Qui",
  friday: "Sex",
  saturday: "Sáb",
};

const TimeSlotsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getSetting } = useSiteSettings();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [newDayType, setNewDayType] = useState<string>("monday");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [togglingDateSlot, setTogglingDateSlot] = useState<string | null>(null);

  // Selected date for calendar date-based slot management
  const [selectedBlockDate, setSelectedBlockDate] = useState<Date>(new Date());
  const [maxDaysAhead, setMaxDaysAhead] = useState(() => getSetting("booking_max_days_ahead", "90"));

  useEffect(() => {
    const current = getSetting("booking_max_days_ahead", "90");
    if (current) setMaxDaysAhead(current);
  }, [getSetting]);

  const { data: timeSlots, isLoading } = useQuery({
    queryKey: ["admin-time-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("available_times")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as TimeSlot[];
    },
  });

  const { data: blockedSlots } = useQuery({
    queryKey: ["admin-blocked-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_slots")
        .select("*")
        .order("blocked_date", { ascending: true });

      if (error) throw error;
      return data as BlockedSlot[];
    },
  });

  const slotsByDay = (day: string) => timeSlots?.filter((s) => s.day_type === day) || [];

  // Map JS getDay() to day_type
  const getDayTypeForDate = (date: Date): string => {
    const jsDay = date.getDay(); // 0=Sun,1=Mon,...,6=Sat
    const map = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return map[jsDay];
  };

  // All slots for selected date's day of week
  const allSlotsForDate = selectedBlockDate
    ? slotsByDay(getDayTypeForDate(selectedBlockDate))
    : [];

  const blockedForSelectedDate = selectedBlockDate
    ? (blockedSlots || []).filter(
        (b) => b.blocked_date === format(selectedBlockDate, "yyyy-MM-dd")
      )
    : [];

  const blockedTimesSet = new Set(
    blockedForSelectedDate.map((b) => b.blocked_time.slice(0, 5))
  );

  const availableCountOnDate = allSlotsForDate.filter(
    (s) => s.is_active && !blockedTimesSet.has(s.time_slot.slice(0, 5))
  ).length;

  const datesWithBlocks = new Set(
    (blockedSlots || []).map((b) => b.blocked_date)
  );

  const handleSaveMaxDaysAhead = async (val: string) => {
    setMaxDaysAhead(val);
    try {
      const { error } = await supabase.from("site_settings").upsert(
        {
          key: "booking_max_days_ahead",
          value: val,
          category: "booking",
          label: "Dias de antecedência máxima no calendário",
        },
        { onConflict: "key" }
      );

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast({
        title: "Antecedência de agendamento atualizada!",
        description: `Clientes agora podem agendar com até ${val} dias de antecedência no site.`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao salvar antecedência", description: err.message, variant: "destructive" });
    }
  };

  // Toggle single slot for specific date
  const handleToggleSlotForDate = async (slot: TimeSlot) => {
    if (!selectedBlockDate) return;
    const dateStr = format(selectedBlockDate, "yyyy-MM-dd");
    const timeNorm = slot.time_slot.slice(0, 5);
    setTogglingDateSlot(slot.time_slot);

    try {
      const blockedEntry = (blockedSlots || []).find(
        (b) => b.blocked_date === dateStr && b.blocked_time.slice(0, 5) === timeNorm
      );

      const isCurrentlyLiberado = slot.is_active && !blockedEntry;

      if (isCurrentlyLiberado) {
        // Bloquear para esta data
        const { error } = await supabase.from("blocked_slots").insert({
          blocked_date: dateStr,
          blocked_time: slot.time_slot,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
        if (error) throw error;
        toast({ title: `Horário ${timeNorm} bloqueado para ${format(selectedBlockDate, "dd/MM")}` });
      } else {
        // Liberar para esta data
        if (blockedEntry) {
          const { error } = await supabase.from("blocked_slots").delete().eq("id", blockedEntry.id);
          if (error) throw error;
        }
        if (!slot.is_active) {
          await supabase.from("available_times").update({ is_active: true }).eq("id", slot.id);
        }
        toast({ title: `Horário ${timeNorm} liberado para ${format(selectedBlockDate, "dd/MM")}` });
      }

      queryClient.invalidateQueries({ queryKey: ["admin-blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["admin-time-slots"] });
      queryClient.invalidateQueries({ queryKey: ["available-times"] });
    } catch (err: any) {
      toast({ title: "Erro ao alterar horário", description: err.message, variant: "destructive" });
    } finally {
      setTogglingDateSlot(null);
    }
  };

  // Liberar todos os horários da data
  const handleUnblockAllDay = async () => {
    if (!selectedBlockDate) return;
    const dateStr = format(selectedBlockDate, "yyyy-MM-dd");
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("blocked_slots").delete().eq("blocked_date", dateStr);
      if (error) throw error;

      // Garantir que os horários do dia estejam ativos
      const dayType = getDayTypeForDate(selectedBlockDate);
      const inactiveSlots = slotsByDay(dayType).filter((s) => !s.is_active);
      if (inactiveSlots.length > 0) {
        await supabase
          .from("available_times")
          .update({ is_active: true })
          .in("id", inactiveSlots.map((s) => s.id));
      }

      toast({
        title: "Todos os horários liberados!",
        description: `Horários liberados para ${format(selectedBlockDate, "dd 'de' MMMM", { locale: ptBR })}.`,
      });

      queryClient.invalidateQueries({ queryKey: ["admin-blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["admin-time-slots"] });
      queryClient.invalidateQueries({ queryKey: ["available-times"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bloquear dia inteiro
  const handleBlockAllDay = async () => {
    if (!selectedBlockDate) return;
    const dateStr = format(selectedBlockDate, "yyyy-MM-dd");
    const dayType = getDayTypeForDate(selectedBlockDate);
    const daySlots = slotsByDay(dayType);
    if (daySlots.length === 0) return;

    if (!confirm(`Deseja bloquear todos os horários do dia ${format(selectedBlockDate, "dd/MM/yyyy")}?`)) return;

    setIsSubmitting(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const alreadyBlocked = new Set(
        (blockedSlots || []).filter((b) => b.blocked_date === dateStr).map((b) => b.blocked_time.slice(0, 5))
      );

      const toInsert = daySlots
        .filter((s) => !alreadyBlocked.has(s.time_slot.slice(0, 5)))
        .map((s) => ({
          blocked_date: dateStr,
          blocked_time: s.time_slot,
          created_by: userId,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from("blocked_slots").insert(toInsert);
        if (error) throw error;
      }

      toast({
        title: "Dia bloqueado!",
        description: `Todos os horários de ${format(selectedBlockDate, "dd 'de' MMMM", { locale: ptBR })} foram bloqueados.`,
      });

      queryClient.invalidateQueries({ queryKey: ["admin-blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyToDay = async (fromDay: string, toDay: string) => {
    const fromSlots = slotsByDay(fromDay);
    if (fromSlots.length === 0) {
      toast({ title: `Nenhum horário em ${DAY_LABELS[fromDay]} para copiar`, variant: "destructive" });
      return;
    }
    if (!confirm(`Copiar horários de ${DAY_LABELS[fromDay]} para ${DAY_LABELS[toDay]}? Duplicados serão ignorados.`)) return;

    setIsSubmitting(true);
    try {
      const existingTimes = new Set(slotsByDay(toDay).map((s) => s.time_slot));
      const toSlotCount = slotsByDay(toDay).length;
      const newSlots = fromSlots
        .filter((s) => !existingTimes.has(s.time_slot))
        .map((s, i) => ({
          time_slot: s.time_slot,
          display_order: toSlotCount + i + 1,
          day_type: toDay,
          is_active: s.is_active,
        }));

      if (newSlots.length === 0) {
        toast({ title: `Todos os horários já existem em ${DAY_LABELS[toDay]}` });
      } else {
        const { error } = await supabase.from("available_times").insert(newSlots);
        if (error) throw error;
        toast({ title: `${newSlots.length} horário(s) copiado(s) para ${DAY_LABELS[toDay]}!` });
        queryClient.invalidateQueries({ queryKey: ["admin-time-slots"] });
        queryClient.invalidateQueries({ queryKey: ["available-times"] });
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTimeSlot = async () => {
    if (!newTime) {
      toast({ title: "Informe o horário", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const maxOrder = timeSlots?.reduce((max, t) => Math.max(max, t.display_order), 0) || 0;

      const { error } = await supabase.from("available_times").insert({
        time_slot: newTime,
        display_order: maxOrder + 1,
        day_type: newDayType,
      });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Horário já existe", description: "Este horário já está cadastrado neste dia.", variant: "destructive" });
        } else {
          throw error;
        }
      } else {
        toast({ title: "Horário adicionado!" });
        queryClient.invalidateQueries({ queryKey: ["admin-time-slots"] });
        queryClient.invalidateQueries({ queryKey: ["available-times"] });
        setIsDialogOpen(false);
        setNewTime("");
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (slot: TimeSlot) => {
    setTogglingId(slot.id);
    try {
      const { error } = await supabase
        .from("available_times")
        .update({ is_active: !slot.is_active })
        .eq("id", slot.id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-time-slots"] });
      queryClient.invalidateQueries({ queryKey: ["available-times"] });
      toast({ title: slot.is_active ? "Horário desativado" : "Horário ativado" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este horário?")) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from("available_times").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Horário excluído!" });
      queryClient.invalidateQueries({ queryKey: ["admin-time-slots"] });
      queryClient.invalidateQueries({ queryKey: ["available-times"] });
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const formatTimeDisplay = (time: string) => time.slice(0, 5);

  const renderSlotGrid = (slots: TimeSlot[]) => {
    if (slots.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground font-body">
          <p>Nenhum horário cadastrado</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        <AnimatePresence>
          {slots.map((slot) => (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`
                relative flex items-center justify-between p-3 rounded-xl border transition-all shadow-sm
                ${slot.is_active
                  ? "bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-500/70"
                  : "bg-rose-500/10 border-rose-500/30 opacity-75 hover:border-rose-500/60"
                }
              `}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    slot.is_active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500"
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={`font-display font-semibold text-sm ${
                    slot.is_active
                      ? "text-emerald-950 dark:text-emerald-100"
                      : "text-rose-950/70 dark:text-rose-200/70 line-through decoration-rose-400/60"
                  }`}
                >
                  {formatTimeDisplay(slot.time_slot)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleToggleActive(slot)}
                  disabled={togglingId === slot.id}
                  className={`h-8 w-8 transition-colors ${
                    slot.is_active
                      ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/20"
                      : "text-rose-500 hover:text-rose-600 hover:bg-rose-500/20"
                  }`}
                  title={slot.is_active ? "Horário Ativo (clique para desativar)" : "Horário Desativado (clique para ativar)"}
                >
                  {togglingId === slot.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-current" />
                  ) : slot.is_active ? (
                    <ToggleRight className="h-5 w-5 text-emerald-600 fill-emerald-500/30" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-rose-500 fill-rose-500/30" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(slot.id)}
                  disabled={deletingId === slot.id}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Excluir Horário"
                >
                  {deletingId === slot.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  const renderDayTab = (day: string) => {
    const slots = slotsByDay(day);
    return (
      <div className="space-y-3">
        {day !== "monday" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopyToDay("monday", day)}
            disabled={isSubmitting || slotsByDay("monday").length === 0}
            className="gap-1.5 w-full"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Copiar horários de Segunda
          </Button>
        )}
        {renderSlotGrid(slots)}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="font-display text-lg sm:text-xl flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Horários Disponíveis
            </CardTitle>
            <p className="text-xs text-muted-foreground font-body mt-1">
              Gerencie a liberação de horários por data no calendário ou por dia da semana
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Novo Horário
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-display">Adicionar Horário</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="time" className="font-body">Horário</Label>
                  <Input
                    id="time"
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-body">Dia da semana</Label>
                  <Select value={newDayType} onValueChange={setNewDayType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_KEYS.map((day) => (
                        <SelectItem key={day} value={day}>
                          {DAY_LABELS[day]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAddTimeSlot}
                    disabled={isSubmitting || !newTime}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="by-date" className="w-full">
            {/* Tabs de Navegação com Scroll Suave no Celular */}
            <div className="w-full overflow-x-auto no-scrollbar pb-1 mb-4">
              <TabsList className="inline-flex w-max min-w-full sm:w-full justify-start sm:justify-start p-1 bg-muted/60 rounded-xl gap-1 h-auto">
                <TabsTrigger
                  value="by-date"
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all shadow-none data-[state=active]:shadow-sm"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Liberar por Data
                </TabsTrigger>
                {DAY_KEYS.map((day) => (
                  <TabsTrigger
                    key={day}
                    value={day}
                    className="px-3 py-1.5 text-xs rounded-lg whitespace-nowrap data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                  >
                    {DAY_SHORT[day]} ({slotsByDay(day).length})
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* TAB: GERENCIAR POR DATA NO CALENDÁRIO */}
            <TabsContent value="by-date" className="space-y-5">
              {/* Card de Configuração de Antecedência */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 sm:p-4 rounded-xl bg-primary/5 border border-primary/20 gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="font-display font-semibold text-sm text-foreground">
                      Antecedência Máxima de Agendamento
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-body">
                    Define até quando as clientes conseguem ver e agendar datas no calendário do site.
                  </p>
                </div>
                <div className="w-full sm:w-auto flex-shrink-0">
                  <Select value={maxDaysAhead} onValueChange={handleSaveMaxDaysAhead}>
                    <SelectTrigger className="w-full sm:w-60 h-9 text-xs font-body bg-background">
                      <SelectValue placeholder="Selecione o limite" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 dias (~1 mês)</SelectItem>
                      <SelectItem value="60">60 dias (~2 meses)</SelectItem>
                      <SelectItem value="90">90 dias (~3 meses - Recomendado)</SelectItem>
                      <SelectItem value="120">120 dias (~4 meses)</SelectItem>
                      <SelectItem value="180">180 dias (~6 meses)</SelectItem>
                      <SelectItem value="365">365 dias (1 ano)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Layout Calendário + Horários do Dia */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
                {/* Coluna Esquerda: Calendário Interativo */}
                <div className="lg:col-span-5 xl:col-span-5 flex flex-col items-center w-full">
                  <div className="w-full max-w-sm mx-auto lg:max-w-none bg-card rounded-2xl border border-border p-3 sm:p-4 shadow-sm overflow-hidden">
                    <Calendar
                      mode="single"
                      selected={selectedBlockDate}
                      onSelect={(d) => d && setSelectedBlockDate(d)}
                      locale={ptBR}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return date < today || date.getDay() === 0;
                      }}
                      modifiers={{
                        hasBlocked: (date) => datesWithBlocks.has(format(date, "yyyy-MM-dd")),
                      }}
                      modifiersClassNames={{
                        hasBlocked: "[&:not([aria-selected])]:bg-rose-500/15 [&:not([aria-selected])]:text-rose-600 [&:not([aria-selected])]:font-bold",
                      }}
                      classNames={{
                        months: "w-full flex justify-center",
                        month: "w-full max-w-[320px] sm:max-w-[340px] space-y-3",
                        caption: "flex justify-center pt-1 pb-2 relative items-center",
                        caption_label: "text-sm sm:text-base font-semibold capitalize font-display text-foreground",
                        nav: "flex items-center",
                        nav_button: cn(
                          buttonVariants({ variant: "outline" }),
                          "h-8 w-8 bg-background p-0 opacity-70 hover:opacity-100 hover:bg-accent rounded-lg border border-border"
                        ),
                        nav_button_previous: "absolute left-0",
                        nav_button_next: "absolute right-0",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex w-full justify-between items-center mb-1",
                        head_cell: "text-muted-foreground font-medium text-[0.75rem] sm:text-xs text-center w-8 sm:w-9 capitalize",
                        row: "flex w-full justify-between items-center mt-1.5",
                        cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 flex items-center justify-center",
                        day: cn(
                          buttonVariants({ variant: "ghost" }),
                          "h-8 w-8 sm:h-9 sm:w-9 p-0 font-normal rounded-xl transition-all aria-selected:opacity-100"
                        ),
                        day_selected:
                          "!bg-primary !text-primary-foreground font-semibold shadow-md hover:!bg-primary/90 focus:!bg-primary",
                        day_today: "border border-primary/50 text-primary font-bold",
                        day_outside: "text-muted-foreground/30 opacity-40 aria-selected:opacity-30",
                        day_disabled: "text-muted-foreground/30 opacity-30 cursor-not-allowed hover:bg-transparent",
                      }}
                      className="p-0 w-full"
                    />

                    {/* Legenda */}
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-3 mt-3 border-t border-border text-[11px] sm:text-xs font-body text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>Liberado</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span>Com bloqueios</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                        <span>Domingo (fechado)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coluna Direita: Detalhes e Horários da Data Selecionada */}
                <div className="lg:col-span-7 xl:col-span-7 bg-secondary/20 rounded-2xl border border-border p-3.5 sm:p-5 space-y-4 w-full">
                  {/* Cabeçalho da data selecionada */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                    <div>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-primary flex-shrink-0" />
                        <h4 className="font-display font-semibold text-base sm:text-lg capitalize text-foreground">
                          {format(selectedBlockDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                        </h4>
                      </div>
                      <p className="text-xs text-muted-foreground font-body mt-0.5">
                        {DAY_LABELS[getDayTypeForDate(selectedBlockDate)]} • <span className="text-foreground font-medium">{availableCountOnDate} liberado(s)</span> de {allSlotsForDate.length} horários
                      </p>
                    </div>

                    {/* Botões de Ação Rápida */}
                    <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleUnblockAllDay}
                        disabled={isSubmitting || blockedForSelectedDate.length === 0}
                        className="h-8 text-xs font-body border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 gap-1.5 justify-center"
                        title="Remove todos os bloqueios desta data"
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Liberar Todos
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBlockAllDay}
                        disabled={isSubmitting}
                        className="h-8 text-xs font-body border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 gap-1.5 justify-center"
                        title="Bloqueia todos os horários desta data"
                      >
                        <CalendarOff className="h-3.5 w-3.5 text-rose-600" />
                        Bloquear Dia
                      </Button>
                    </div>
                  </div>

                  {/* Lista de Horários do Dia */}
                  {allSlotsForDate.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground font-body text-sm">
                      Nenhum horário cadastrado para {DAY_LABELS[getDayTypeForDate(selectedBlockDate)]}.
                      <p className="text-xs mt-1">Cadastre horários para este dia da semana na aba correspondente acima.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5">
                      {allSlotsForDate.map((slot) => {
                        const isBlocked = blockedTimesSet.has(slot.time_slot.slice(0, 5));
                        const isLiberado = slot.is_active && !isBlocked;

                        return (
                          <div
                            key={`date-slot-${slot.id}`}
                            className={cn(
                              "flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all shadow-sm",
                              isLiberado
                                ? "bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-500/70"
                                : "bg-rose-500/10 border-rose-500/30 opacity-80 hover:border-rose-500/60"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full flex-shrink-0",
                                  isLiberado
                                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                                    : "bg-rose-500"
                                )}
                              />
                              <div className="flex flex-col min-w-0">
                                <span
                                  className={cn(
                                    "font-display font-semibold text-sm leading-tight",
                                    isLiberado
                                      ? "text-emerald-950 dark:text-emerald-100"
                                      : "text-rose-950/70 dark:text-rose-200/70 line-through decoration-rose-400/60"
                                  )}
                                >
                                  {formatTimeDisplay(slot.time_slot)}
                                </span>
                                <span
                                  className={cn(
                                    "text-[10px] font-body truncate",
                                    isLiberado ? "text-emerald-700 dark:text-emerald-300 font-medium" : "text-rose-600 dark:text-rose-400"
                                  )}
                                >
                                  {isLiberado ? "Liberado" : "Bloqueado"}
                                </span>
                              </div>
                            </div>

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleToggleSlotForDate(slot)}
                              disabled={togglingDateSlot === slot.time_slot}
                              className={cn(
                                "h-8 w-8 flex-shrink-0 transition-colors rounded-lg",
                                isLiberado
                                  ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/20"
                                  : "text-rose-500 hover:text-rose-600 hover:bg-rose-500/20"
                              )}
                              title={
                                isLiberado
                                  ? "Horário liberado para esta data (clique para bloquear)"
                                  : "Horário bloqueado para esta data (clique para liberar)"
                              }
                            >
                              {togglingDateSlot === slot.time_slot ? (
                                <Loader2 className="h-4 w-4 animate-spin text-current" />
                              ) : isLiberado ? (
                                <ToggleRight className="h-5 w-5 text-emerald-600 fill-emerald-500/30" />
                              ) : (
                                <ToggleLeft className="h-5 w-5 text-rose-500 fill-rose-500/30" />
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TABS INDIVIDUAIS POR DIA DA SEMANA */}
            {DAY_KEYS.map((day) => (
              <TabsContent key={day} value={day}>
                {renderDayTab(day)}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default TimeSlotsManager;
