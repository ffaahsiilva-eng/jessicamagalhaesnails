import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
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

const bibleVerses = [
  "O Senhor é o meu pastor, nada me faltará. - Salmos 23:1",
  "Tudo posso naquele que me fortalece. - Filipenses 4:13",
  "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito. - João 3:16",
  "Confie no Senhor de todo o seu coração. - Provérbios 3:5",
  "Alegrem-se sempre no Senhor. Novamente direi: alegrem-se! - Filipenses 4:4",
  "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará. - Salmos 37:5",
  "Seja forte e corajoso! Não se apavore, nem desanime, pois o Senhor estará com você. - Josué 1:9",
];

const AppointmentsManager = () => {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
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
    const message = encodeURIComponent(
      `✨ Olá ${apt.client_name}! ✨\n\n` +
      `✅ Seu agendamento foi *CONFIRMADO*! ✅\n\n` +
      `📅 *Data:* ${formattedDate}\n` +
      `🕐 *Horário:* ${apt.appointment_time.slice(0, 5)}\n` +
      `💅 *Serviço:* ${apt.service_type}\n\n` +
      `📖 ${getRandomVerse()}\n\n` +
      `⏰ *Tolerância de 15 minutos para chegada.*\n\n` +
      `📸 *Instagram:* https://www.instagram.com/jessica_magalhaes_nail\n\n` +
      `🙏 Te espero! 💕`
    );
    const phone = apt.client_phone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  const notifyAdmin = async (apt: Appointment, action: "confirmed" | "cancelled") => {
    try {
      await supabase.functions.invoke("notify-admin-booking", {
        body: {
          client_name: apt.client_name,
          client_phone: apt.client_phone,
          client_email: apt.client_email,
          service_type: apt.service_type,
          appointment_date: apt.appointment_date,
          appointment_time: apt.appointment_time,
          notes: apt.notes,
          action,
        },
      });
    } catch (e) {
      console.error("notify-admin-booking failed", e);
    }
  };

  const updateStatus = async (id: string, status: string, apt?: Appointment) => {
    setIsUpdating(id);
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Status: ${statusLabels[status]}` });
      if (apt && (status === "confirmed" || status === "cancelled")) {
        notifyAdmin(apt, status);
      }
      if (status === "confirmed" && apt) sendWhatsAppConfirmation(apt);
      fetchAppointments();
    }
    setIsUpdating(null);
  };

  const deleteAppointment = async (id: string) => {
    if (!confirm("Excluir este agendamento permanentemente?")) return;
    setIsUpdating(id);
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Agendamento excluído!" });
      fetchAppointments();
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
      setEditingAppointment(null);
      fetchAppointments();
    }
    setIsUpdating(null);
  };

  const filtered = appointments.filter((apt) => {
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
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          Todos os Agendamentos
        </CardTitle>
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
        <Badge variant="secondary" className="font-body text-xs w-fit mt-2">
          {filtered.length} agendamento{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground font-body">
            <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum agendamento encontrado</p>
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
                          {apt.service_type}
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
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
                              onClick={() => sendWhatsAppConfirmation(apt)}
                              title="Enviar WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
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
                    {apt.notes && (
                      <p className="text-xs text-muted-foreground italic">📝 {apt.notes}</p>
                    )}
                    <div className="flex gap-1.5 pt-1">
                      {apt.status === "pending" && (
                        <>
                          <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs" onClick={() => updateStatus(apt.id, "confirmed", apt)} disabled={isUpdating === apt.id}>
                            <Check className="h-3 w-3 mr-1" /> Confirmar
                          </Button>
                          <Button size="sm" variant="outline" className="border-rose-200 text-rose-600 h-8 text-xs" onClick={() => updateStatus(apt.id, "cancelled")} disabled={isUpdating === apt.id}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="outline" className="h-8 text-xs text-emerald-600 border-emerald-200" onClick={() => sendWhatsAppConfirmation(apt)}>
                        <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                      </Button>
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
