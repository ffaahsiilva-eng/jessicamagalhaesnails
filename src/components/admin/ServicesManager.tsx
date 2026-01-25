import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Star, Loader2, GripVertical, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: string;
  duration: string;
  is_popular: boolean;
  display_order: number;
  is_active: boolean;
}

const ServicesManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [isPopular, setIsPopular] = useState(false);

  const { data: services, isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as Service[];
    },
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setDuration("");
    setIsPopular(false);
    setEditingService(null);
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setName(service.name);
    setDescription(service.description || "");
    setPrice(service.price);
    setDuration(service.duration);
    setIsPopular(service.is_popular);
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !price.trim() || !duration.trim()) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Nome, preço e duração são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingService) {
        // Update existing
        const { error } = await supabase
          .from("services")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            price: price.trim(),
            duration: duration.trim(),
            is_popular: isPopular,
          })
          .eq("id", editingService.id);

        if (error) throw error;

        toast({ title: "Serviço atualizado!" });
      } else {
        // Create new
        const maxOrder = services?.reduce((max, s) => Math.max(max, s.display_order), 0) || 0;

        const { error } = await supabase.from("services").insert({
          name: name.trim(),
          description: description.trim() || null,
          price: price.trim(),
          duration: duration.trim(),
          is_popular: isPopular,
          display_order: maxOrder + 1,
        });

        if (error) throw error;

        toast({ title: "Serviço criado!" });
      }

      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;

    setDeletingId(id);

    try {
      const { error } = await supabase.from("services").delete().eq("id", id);

      if (error) throw error;

      toast({ title: "Serviço excluído!" });
      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleActive = async (service: Service) => {
    try {
      const { error } = await supabase
        .from("services")
        .update({ is_active: !service.is_active })
        .eq("id", service.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });

      toast({
        title: service.is_active ? "Serviço desativado" : "Serviço ativado",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            💅 Tabela de Preços
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNewDialog} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Novo Serviço
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingService ? "Editar Serviço" : "Novo Serviço"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-body">
                    Nome *
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Manicure Simples"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="font-body">
                    Descrição
                  </Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Esmaltação tradicional com cutilagem"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="font-body">
                      Preço *
                    </Label>
                    <Input
                      id="price"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="Ex: R$ 35"
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration" className="font-body">
                      Duração *
                    </Label>
                    <Input
                      id="duration"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="Ex: 45 min"
                      className="bg-secondary/50"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" />
                    <Label htmlFor="popular" className="font-body">
                      Marcar como Popular
                    </Label>
                  </div>
                  <Switch
                    id="popular"
                    checked={isPopular}
                    onCheckedChange={setIsPopular}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        Salvar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : services?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground font-body">
            <p>Nenhum serviço cadastrado</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            <AnimatePresence>
              {services?.map((service, index) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.03 }}
                  className={`
                    flex items-center gap-3 p-3 rounded-xl border transition-colors
                    ${service.is_active 
                      ? "bg-secondary/30 border-border" 
                      : "bg-muted/30 border-muted opacity-60"
                    }
                  `}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-medium text-foreground truncate">
                        {service.name}
                      </span>
                      {service.is_popular && (
                        <Star className="h-3 w-3 text-primary fill-primary flex-shrink-0" />
                      )}
                      {!service.is_active && (
                        <span className="text-xs text-muted-foreground">(inativo)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground font-body">
                      <span className="text-primary font-medium">{service.price}</span>
                      <span>•</span>
                      <span>{service.duration}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleActive(service)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title={service.is_active ? "Desativar" : "Ativar"}
                    >
                      <Switch
                        checked={service.is_active}
                        className="pointer-events-none scale-75"
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditDialog(service)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(service.id)}
                      disabled={deletingId === service.id}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      {deletingId === service.id ? (
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
        )}
      </CardContent>
    </Card>
  );
};

export default ServicesManager;
