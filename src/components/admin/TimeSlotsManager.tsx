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

const TimeSlotsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [newDayType, setNewDayType] = useState<string>("weekday");
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

  const weekdaySlots = timeSlots?.filter((s) => s.day_type === "weekday") || [];
  const saturdaySlots = timeSlots?.filter((s) => s.day_type === "weekend") || [];

  // Get available slots for selected block date
  const slotsForSelectedDate = selectedBlockDate
    ? (isSaturday(selectedBlockDate) ? saturdaySlots : weekdaySlots).filter((s) => s.is_active)
    : [];

  const blockedForSelectedDate = selectedBlockDate
    ? (blockedSlots || []).filter(
        (b) => b.blocked_date === format(selectedBlockDate, "yyyy-MM-dd")
      )
    : [];

  const blockedTimesSet = new Set(blockedForSelectedDate.map((b) => b.blocked_time));

  // Get dates that have blocked slots for calendar highlighting
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

  const handleCopyWeekdayToSaturday = async () => {
    if (weekdaySlots.length === 0) {
      toast({ title: "Nenhum horário de semana para copiar", variant: "destructive" });
      return;
    }
    if (!confirm("Copiar todos os horários da semana para o Sábado? Horários duplicados serão ignorados.")) return;

    setIsSubmitting(true);
    try {
      const existingSatTimes = new Set(saturdaySlots.map((s) => s.time_slot));
      const newSlots = weekdaySlots
        .filter((s) => !existingSatTimes.has(s.time_slot))
        .map((s, i) => ({
          time_slot: s.time_slot,
          display_order: (saturdaySlots.length + i + 1),
          day_type: "weekend",
          is_active: s.is_active,
        }));

      if (newSlots.length === 0) {
        toast({ title: "Todos os horários já estão cadastrados no Sábado" });
      } else {
        const { error } = await supabase.from("available_times").insert(newSlots);
        if (error) throw error;
        toast({ title: `${newSlots.length} horário(s) copiado(s) para Sábado!` });
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
          toast({ title: "Horário já existe", description: "Este horário já está cadastrado.", variant: "destructive" });
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        <AnimatePresence>
          {slots.map((slot) => (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`
                relative flex items-center justify-between p-3 rounded-xl border transition-colors
                ${slot.is_active
                  ? "bg-secondary/30 border-border"
                  : "bg-muted/30 border-muted opacity-60"
                }
              `}
            >
              <span className={`font-display font-semibold ${slot.is_active ? "text-foreground" : "text-muted-foreground"}`}>
                {formatTimeDisplay(slot.time_slot)}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleToggleActive(slot)}
                  disabled={togglingId === slot.id}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title={slot.is_active ? "Desativar" : "Ativar"}
                >
                  {togglingId === slot.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : slot.is_active ? (
                    <ToggleRight className="h-4 w-4 text-primary" />
                  ) : (
                    <ToggleLeft className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(slot.id)}
                  disabled={deletingId === slot.id}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
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
                  <Label className="font-body">Tipo de dia</Label>
                  <Select value={newDayType} onValueChange={setNewDayType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekday">Dias da Semana (Seg–Sex)</SelectItem>
                      <SelectItem value="weekend">Sábado</SelectItem>
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
          Gerencie os horários disponíveis para agendamento
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="weekday" className="w-full">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="weekday" className="flex-1">
                Seg–Sex ({weekdaySlots.length})
              </TabsTrigger>
              <TabsTrigger value="weekend" className="flex-1">
                Sábado ({saturdaySlots.length})
              </TabsTrigger>
              <TabsTrigger value="block" className="flex-1">
                <CalendarOff className="h-3.5 w-3.5 mr-1" />
                Bloqueios
              </TabsTrigger>
            </TabsList>
            <TabsContent value="weekday">
              {renderSlotGrid(weekdaySlots)}
            </TabsContent>
            <TabsContent value="weekend">
              <div className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyWeekdayToSaturday}
                  disabled={isSubmitting || weekdaySlots.length === 0}
                  className="gap-1.5 w-full"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  Copiar horários da semana para Sábado
                </Button>
                {renderSlotGrid(saturdaySlots)}
              </div>
            </TabsContent>
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
                          ? format(selectedBlockDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : "Escolha uma data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                      <Calendar
                        mode="single"
                        selected={selectedBlockDate}
                        onSelect={setSelectedBlockDate}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today || date.getDay() === 0;
                        }}
                        locale={ptBR}
                        className={cn("p-3 pointer-events-auto")}
                        modifiers={{
                          blocked: (date) => datesWithBlocks.has(format(date, "yyyy-MM-dd")),
                        }}
                        modifiersClassNames={{
                          blocked: "bg-destructive/20 text-destructive font-bold",
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {selectedBlockDate && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-display text-sm font-semibold">
                        {format(selectedBlockDate, "dd/MM/yyyy")} — {isSaturday(selectedBlockDate) ? "Sábado" : "Dia de semana"}
                      </h4>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBlockAllDay}
                        disabled={isSubmitting || slotsForSelectedDate.length === 0}
                        className="gap-1 text-xs"
                      >
                        {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarOff className="h-3 w-3" />}
                        Bloquear dia todo
                      </Button>
                    </div>

                    {slotsForSelectedDate.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum horário disponível para este tipo de dia
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {slotsForSelectedDate.map((slot) => {
                          const isBlocked = blockedTimesSet.has(slot.time_slot);
                          const blockedEntry = blockedForSelectedDate.find((b) => b.blocked_time === slot.time_slot);

                          return (
                            <motion.button
                              key={slot.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              onClick={() => {
                                if (isBlocked && blockedEntry) {
                                  handleUnblockSlot(blockedEntry.id);
                                } else {
                                  handleBlockSlot(slot.time_slot);
                                }
                              }}
                              disabled={blockingSlot === slot.time_slot || unblockingId === blockedEntry?.id}
                              className={cn(
                                "relative flex items-center justify-center p-3 rounded-xl border transition-all text-sm font-semibold",
                                isBlocked
                                  ? "bg-destructive/15 border-destructive/40 text-destructive line-through"
                                  : "bg-secondary/30 border-border text-foreground hover:bg-primary/10 hover:border-primary/40"
                              )}
                            >
                              {(blockingSlot === slot.time_slot || unblockingId === blockedEntry?.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  {formatTimeDisplay(slot.time_slot)}
                                  {isBlocked && (
                                    <CalendarOff className="h-3 w-3 ml-1.5 inline" />
                                  )}
                                </>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {blockedForSelectedDate.length > 0 && (
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        {blockedForSelectedDate.length} horário(s) bloqueado(s) — clique para desbloquear
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Summary of upcoming blocked dates */}
                {(blockedSlots || []).length > 0 && !selectedBlockDate && (
                  <div className="space-y-2 mt-4">
                    <h4 className="font-display text-sm font-semibold text-muted-foreground">Bloqueios futuros</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {[...datesWithBlocks]
                        .filter((d) => d >= format(new Date(), "yyyy-MM-dd"))
                        .sort()
                        .slice(0, 10)
                        .map((dateStr) => {
                          const count = (blockedSlots || []).filter((b) => b.blocked_date === dateStr).length;
                          return (
                            <Badge
                              key={dateStr}
                              variant="secondary"
                              className="cursor-pointer hover:bg-destructive/20"
                              onClick={() => setSelectedBlockDate(new Date(dateStr + "T12:00:00"))}
                            >
                              {dateStr.split("-").reverse().join("/")} ({count})
                            </Badge>
                          );
                        })}
                    </div>
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
