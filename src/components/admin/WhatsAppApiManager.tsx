import { useState, useEffect } from "react";
import { MessageCircle, Loader2, Save, Eye, EyeOff, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sendDirectWhatsApp } from "@/lib/whatsapp";

interface WhatsAppConfigRow {
  id: string;
  instance_id: string;
  instance_token: string;
  admin_number: string;
  enabled: boolean;
}

const WhatsAppApiManager = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<WhatsAppConfigRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else if (data) {
      setConfig(data as WhatsAppConfigRow);
    } else {
      const { data: created, error: insErr } = await supabase
        .from("whatsapp_config")
        .insert({ instance_id: "", instance_token: "", admin_number: "559191837179", enabled: false })
        .select()
        .single();
      if (insErr) {
        toast({ title: "Erro ao iniciar", description: insErr.message, variant: "destructive" });
      } else {
        setConfig(created as WhatsAppConfigRow);
      }
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    const { error } = await supabase
      .from("whatsapp_config")
      .update({
        instance_id: config.instance_id.trim(),
        instance_token: config.instance_token.trim(),
        admin_number: config.admin_number.replace(/\D/g, ""),
        enabled: config.enabled,
      })
      .eq("id", config.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configuração salva!", description: "WhatsApp automático atualizado." });
    }
    setIsSaving(false);
  };

  const handleTest = async () => {
    if (!config) return;
    if (!config.instance_id || !config.instance_token || !config.admin_number) {
      toast({
        title: "Preencha os campos",
        description: "Preencha o ID da Instância, o Token e o Número do Admin.",
        variant: "destructive",
      });
      return;
    }
    setIsTesting(true);
    try {
      await sendDirectWhatsApp(
        config.instance_id,
        config.instance_token,
        config.admin_number,
        "🔔 *Teste de Conexão WhatsApp*\n\nSua integração com o site da Jéssica Magalhães está ativa e funcionando perfeitamente! 💅✨"
      );
      toast({ title: "Teste enviado com sucesso!", description: "Verifique a mensagem recebida no WhatsApp." });
    } catch (e) {
      toast({
        title: "Falha no teste",
        description: (e as Error).message || "Verifique se a instância está conectada no painel W-API.",
        variant: "destructive",
      });
    }
    setIsTesting(false);
  };

  if (isLoading || !config) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          WhatsApp Automático
        </CardTitle>
        <CardDescription className="font-body text-xs">
          Envia notificação automática para o admin a cada novo agendamento, pedindo confirmação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label className="font-body text-sm">Ativar integração</Label>
            <p className="text-xs text-muted-foreground">Quando ativo, envia mensagens automáticas.</p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="font-body text-sm">ID da Instância</Label>
          <Input
            value={config.instance_id}
            onChange={(e) => setConfig({ ...config, instance_id: e.target.value })}
            placeholder="instance_xxxxx"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="font-body text-sm">Token da Instância</Label>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              value={config.instance_token}
              onChange={(e) => setConfig({ ...config, instance_token: e.target.value })}
              placeholder="••••••••••••"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setShowToken((s) => !s)}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="font-body text-sm">Número do Admin (com DDI)</Label>
          <Input
            value={config.admin_number}
            onChange={(e) => setConfig({ ...config, admin_number: e.target.value })}
            placeholder="559191837179"
          />
          <p className="text-xs text-muted-foreground">Apenas números. Ex: 559191837179</p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSave} disabled={isSaving} className="flex-1">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
          <Button onClick={handleTest} disabled={isTesting} variant="outline" className="flex-1">
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Testar envio
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppApiManager;
