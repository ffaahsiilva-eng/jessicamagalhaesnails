import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Star, Loader2, GripVertical, Save, Upload, ImageIcon, X } from "lucide-react";
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: string;
  duration: string;
  is_popular: boolean;
  display_order: number;
  is_active: boolean;
  image_url: string | null;
}

interface SortableServiceItemProps {
  service: Service;
  onEdit: (service: Service) => void;
  onDelete: (id: string) => void;
  onToggleActive: (service: Service) => void;
  isDeleting: boolean;
}

const SortableServiceItem = ({ service, onEdit, onDelete, onToggleActive, isDeleting }: SortableServiceItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: service.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-3 rounded-xl border transition-colors
        ${service.is_active 
          ? "bg-secondary/30 border-border" 
          : "bg-muted/30 border-muted opacity-60"
        }
        ${isDragging ? "shadow-lg z-10" : ""}
      `}
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing p-1"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      </button>
      
      {/* Image thumbnail */}
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
        {service.image_url ? (
          <img 
            src={service.image_url} 
            alt={service.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
        )}
      </div>

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
          onClick={() => onToggleActive(service)}
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
          onClick={() => onEdit(service)}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(service.id)}
          disabled={isDeleting}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};

const ServicesManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [isPopular, setIsPopular] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    setImageUrl(null);
    setImagePreview(null);
    setEditingService(null);
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setName(service.name);
    setDescription(service.description || "");
    setPrice(service.price);
    setDuration(service.duration);
    setIsPopular(service.is_popular);
    setImageUrl(service.image_url);
    setImagePreview(service.image_url);
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("service-images")
        .upload(fileName, file);

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("service-images")
        .getPublicUrl(data.path);

      setImageUrl(urlData.publicUrl);

      toast({ title: "Imagem enviada!" });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar imagem",
        description: error.message,
        variant: "destructive",
      });
      setImagePreview(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeImage = () => {
    setImageUrl(null);
    setImagePreview(null);
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
            image_url: imageUrl,
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
          image_url: imageUrl,
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && services) {
      const oldIndex = services.findIndex((s) => s.id === active.id);
      const newIndex = services.findIndex((s) => s.id === over.id);

      const newOrder = arrayMove(services, oldIndex, newIndex);

      // Optimistically update the UI
      queryClient.setQueryData(["admin-services"], newOrder);

      // Update the database
      try {
        const updates = newOrder.map((service, index) => ({
          id: service.id,
          display_order: index + 1,
        }));

        for (const update of updates) {
          await supabase
            .from("services")
            .update({ display_order: update.display_order })
            .eq("id", update.id);
        }

        queryClient.invalidateQueries({ queryKey: ["services"] });
      } catch (error: any) {
        toast({
          title: "Erro ao reordenar",
          description: error.message,
          variant: "destructive",
        });
        queryClient.invalidateQueries({ queryKey: ["admin-services"] });
      }
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
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editingService ? "Editar Serviço" : "Novo Serviço"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Image Upload */}
                <div className="space-y-2">
                  <Label className="font-body">Imagem</Label>
                  <div className="flex items-center gap-3">
                    {imagePreview ? (
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={removeImage}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                      >
                        {isUploadingImage ? (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground mt-1">Upload</span>
                          </>
                        )}
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    {!imagePreview && (
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG ou WebP. Máx 5MB.
                      </p>
                    )}
                  </div>
                </div>

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
        <p className="text-xs text-muted-foreground font-body mt-1">
          Arraste os itens para reordenar
        </p>
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={services?.map((s) => s.id) || []}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                <AnimatePresence>
                  {services?.map((service) => (
                    <motion.div
                      key={service.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <SortableServiceItem
                        service={service}
                        onEdit={openEditDialog}
                        onDelete={handleDelete}
                        onToggleActive={toggleActive}
                        isDeleting={deletingId === service.id}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
};

export default ServicesManager;
