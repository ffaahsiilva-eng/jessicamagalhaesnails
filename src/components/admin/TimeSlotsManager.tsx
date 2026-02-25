import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Clock, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface TimeSlot {
  id: string;
  time_slot: string;
  is_active: boolean;
  display_order: number;
  day_type: string;
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

  const weekdaySlots = timeSlots?.filter((s) => s.day_type === "weekday") || [];
  const weekendSlots = timeSlots?.filter((s) => s.day_type === "weekend") || [];

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
                      <SelectItem value="weekend">Fins de Semana (Sáb–Dom)</SelectItem>
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
                Sáb–Dom ({weekendSlots.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="weekday">
              {renderSlotGrid(weekdaySlots)}
            </TabsContent>
            <TabsContent value="weekend">
              {renderSlotGrid(weekendSlots)}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default TimeSlotsManager;
