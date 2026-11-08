import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Clock, Loader2, ToggleLeft, ToggleRight, Copy, CalendarOff, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { format, isSaturday } from "date-fns";
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [newDayType, setNewDayType] = useState<string>("monday");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Blocked slots state
  const [selectedBlockDate, setSelectedBlockDate] = useState<Date | undefined>(undefined);
  const [blockingSlot, setBlockingSlot] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

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

  // Map JS getDay() to day_type for blocked slots
  const getDayTypeForDate = (date: Date): string => {
    const jsDay = date.getDay(); // 0=Sun,1=Mon,...,6=Sat
    return DAY_KEYS[jsDay === 0 ? 5 : jsDay - 1]; // Sun shouldn't happen, fallback to saturday
  };

  // Get available slots for selected block date
  const slotsForSelectedDate = selectedBlockDate
    ? slotsByDay(getDayTypeForDate(selectedBlockDate)).filter((s) => s.is_active)
    : [];

  const blockedForSelectedDate = selectedBlockDate
    ? (blockedSlots || []).filter(
        (b) => b.blocked_date === format(selectedBlockDate, "yyyy-MM-dd")
      )
    : [];

  const blockedTimesSet = new Set(blockedForSelectedDate.map((b) => b.blocked_time));

  const datesWithBlocks = new Set(
    (blockedSlots || []).map((b) => b.blocked_date)
  );

  const handleBlockSlot = async (timeSlot: string) => {
    if (!selectedBlockDate) return;
    setBlockingSlot(timeSlot);
    try {
      const { error } = await supabase.from("blocked_slots").insert({
        blocked_date: format(selectedBlockDate, "yyyy-MM-dd"),
        blocked_time: timeSlot,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast({ title: "Horário bloqueado!" });
      queryClient.invalidateQueries({ queryKey: ["admin-blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setBlockingSlot(null);
    }
  };

  const handleUnblockSlot = async (id: string) => {
    setUnblockingId(id);
    try {
      const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Horário desbloqueado!" });
      queryClient.invalidateQueries({ queryKey: ["admin-blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setUnblockingId(null);
    }
  };

  const handleBlockAllDay = async () => {
    if (!selectedBlockDate || slotsForSelectedDate.length === 0) return;
    const unblockedSlots = slotsForSelectedDate.filter((s) => !blockedTimesSet.has(s.time_slot));
    if (unblockedSlots.length === 0) {
      toast({ title: "Todos os horários já estão bloqueados nesta data" });
      return;
    }
    if (!confirm(`Bloquear todos os ${unblockedSlots.length} horários disponíveis nesta data?`)) return;

    setIsSubmitting(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const inserts = unblockedSlots.map((s) => ({
        blocked_date: format(selectedBlockDate, "yyyy-MM-dd"),
        blocked_time: s.time_slot,
        created_by: userId,
      }));
      const { error } = await supabase.from("blocked_slots").insert(inserts);
      if (error) throw error;
      toast({ title: `${unblockedSlots.length} horário(s) bloqueado(s)!` });
      queryClient.invalidateQueries({ queryKey: ["admin-blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Horários Disponíveis
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
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
        <p className="text-xs text-muted-foreground font-body mt-1">
          Gerencie os horários disponíveis para cada dia da semana
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="monday" className="w-full">
            <TabsList className="w-full mb-4 flex-wrap h-auto gap-1">
              {DAY_KEYS.map((day) => (
                <TabsTrigger key={day} value={day} className="flex-1 min-w-0 text-xs px-2">
                  {DAY_SHORT[day]} ({slotsByDay(day).length})
                </TabsTrigger>
              ))}
              <TabsTrigger value="block" className="flex-1 min-w-0 text-xs px-2">
                <CalendarOff className="h-3.5 w-3.5 mr-1" />
                Bloqueios
              </TabsTrigger>
            </TabsList>
            {DAY_KEYS.map((day) => (
              <TabsContent key={day} value={day}>
                {renderDayTab(day)}
              </TabsContent>
            ))}
            <TabsContent value="block">
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-muted-foreground font-body text-center">
                    Selecione uma data para bloquear horários específicos
                  </p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full max-w-xs justify-start text-left font-normal",
                          !selectedBlockDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedBlockDate
                          ? format(selectedBlockDate, "PPP", { locale: ptBR })
                          : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                      <Calendar
                        mode="single"
                        selected={selectedBlockDate}
                        onSelect={setSelectedBlockDate}
                        locale={ptBR}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today || date.getDay() === 0;
                        }}
                        modifiers={{
                          blocked: (date) =>
                            datesWithBlocks.has(format(date, "yyyy-MM-dd")),
                        }}
                        modifiersClassNames={{
                          blocked: "bg-destructive/20 text-destructive",
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {selectedBlockDate && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-body font-medium text-sm text-foreground">
                        {format(selectedBlockDate, "EEEE, dd/MM/yyyy", { locale: ptBR })}
                      </h4>
                      {slotsForSelectedDate.length > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBlockAllDay}
                          disabled={isSubmitting}
                          className="gap-1 text-xs"
                        >
                          {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarOff className="h-3 w-3" />}
                          Bloquear dia inteiro
                        </Button>
                      )}
                    </div>

                    {slotsForSelectedDate.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum horário ativo para este dia
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {slotsForSelectedDate.map((slot) => {
                          const isBlocked = blockedTimesSet.has(slot.time_slot);
                          const blockedEntry = blockedForSelectedDate.find(
                            (b) => b.blocked_time === slot.time_slot
                          );

                          return (
                            <div
                              key={slot.id}
                              className={cn(
                                "flex items-center justify-between p-2.5 rounded-lg border text-sm",
                                isBlocked
                                  ? "bg-destructive/10 border-destructive/30"
                                  : "bg-secondary/30 border-border"
                              )}
                            >
                              <span className={cn("font-display font-semibold", isBlocked && "line-through text-muted-foreground")}>
                                {formatTimeDisplay(slot.time_slot)}
                              </span>
                              {isBlocked ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => blockedEntry && handleUnblockSlot(blockedEntry.id)}
                                  disabled={unblockingId === blockedEntry?.id}
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  title="Desbloquear"
                                >
                                  {unblockingId === blockedEntry?.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <ToggleLeft className="h-4 w-4" />
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleBlockSlot(slot.time_slot)}
                                  disabled={blockingSlot === slot.time_slot}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  title="Bloquear"
                                >
                                  {blockingSlot === slot.time_slot ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CalendarOff className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {blockedForSelectedDate.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        <span className="text-xs text-muted-foreground">Bloqueados:</span>
                        {blockedForSelectedDate.map((b) => (
                          <Badge key={b.id} variant="destructive" className="text-xs">
                            {formatTimeDisplay(b.blocked_time)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default TimeSlotsManager;
