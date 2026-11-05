import { useState, useEffect } from "react";
import { MessageCircle, Loader2, Save, Eye, EyeOff, Send, Lock, Unlock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sendDirectWhatsApp, syncWhatsAppConfigToSiteSettings } from "@/lib/whatsapp";

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
      const row = data as WhatsAppConfigRow;
      setConfig(row);
      // Auto-sincronizar com site_settings para que visitantes do site consigam notificar o admin
      if (row.instance_id && row.instance_token) {
        await syncWhatsAppConfigToSiteSettings(row);
      }
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

  const handleToggleEnabled = async (checked: boolean) => {
    if (!config) return;
    setIsSaving(true);
    const updated = { ...config, enabled: checked };
    setConfig(updated);

    try {
      const cleanAdmin = updated.admin_number.replace(/\D/g, "");
      const formattedAdmin = cleanAdmin.startsWith("55") ? cleanAdmin : `55${cleanAdmin}`;
      const payload = {
        instance_id: updated.instance_id.trim(),
        instance_token: updated.instance_token.trim(),
        admin_number: formattedAdmin,
        enabled: checked,
      };

      const { error } = await supabase
        .from("whatsapp_config")
        .update(payload)
        .eq("id", updated.id);

      if (error) throw error;
      await syncWhatsAppConfigToSiteSettings(payload);

      toast({
        title: checked ? "Integração ativada!" : "Integração desativada",
        description: checked
          ? "As informações foram bloqueadas para edição e as notificações estão ativas."
          : "As informações foram desbloqueadas. Agora você pode editar.",
      });
    } catch (err: unknown) {
      toast({
        title: "Erro ao alterar status",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    if (config.enabled) {
      toast({
        title: "Campos bloqueados",
        description: "Desative a integração acima para editar e salvar novas informações.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    const cleanAdmin = config.admin_number.replace(/\D/g, "");
    const formattedAdmin = cleanAdmin.startsWith("55") ? cleanAdmin : `55${cleanAdmin}`;
    const payload = {
      instance_id: config.instance_id.trim(),
      instance_token: config.instance_token.trim(),
      admin_number: formattedAdmin,
      enabled: config.enabled,
    };

    const { error } = await supabase
      .from("whatsapp_config")
      .update(payload)
      .eq("id", config.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      await syncWhatsAppConfigToSiteSettings(payload);
      toast({ title: "Configuração salva!", description: "WhatsApp automático atualizado e sincronizado." });
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
            onCheckedChange={handleToggleEnabled}
            disabled={isSaving}
          />
        </div>

        {/* Status de bloqueio visual */}
        {config.enabled ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <Lock className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Integração ativa. Os campos estão protegidos contra alteração acidental. Desative para editar.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            <Unlock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Integração desativada. Os campos estão liberados para edição.</span>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="font-body text-sm">ID da Instância</Label>
            {config.enabled && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-body">
                <Lock className="h-3 w-3" /> Bloqueado
              </span>
            )}
          </div>
          <Input
            value={config.instance_id}
            onChange={(e) => setConfig({ ...config, instance_id: e.target.value })}
            placeholder="instance_xxxxx"
            disabled={config.enabled}
            className={config.enabled ? "bg-muted/60 text-muted-foreground cursor-not-allowed" : ""}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="font-body text-sm">Token da Instância</Label>
            {config.enabled && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-body">
                <Lock className="h-3 w-3" /> Bloqueado
              </span>
            )}
          </div>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              value={config.instance_token}
              onChange={(e) => setConfig({ ...config, instance_token: e.target.value })}
              placeholder="••••••••••••"
              disabled={config.enabled}
              className={`pr-10 ${config.enabled ? "bg-muted/60 text-muted-foreground cursor-not-allowed" : ""}`}
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
          <div className="flex items-center justify-between">
            <Label className="font-body text-sm">Número do Admin (com DDI)</Label>
            {config.enabled && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-body">
                <Lock className="h-3 w-3" /> Bloqueado
              </span>
            )}
          </div>
          <Input
            value={config.admin_number}
            onChange={(e) => setConfig({ ...config, admin_number: e.target.value })}
            placeholder="559191837179"
            disabled={config.enabled}
            className={config.enabled ? "bg-muted/60 text-muted-foreground cursor-not-allowed" : ""}
          />
          <p className="text-xs text-muted-foreground">Apenas números. Ex: 559191837179</p>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSave}
            disabled={isSaving || config.enabled}
            className={`flex-1 ${config.enabled ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : config.enabled ? (
              <Lock className="h-4 w-4 mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {config.enabled ? "Bloqueado para edição" : "Salvar"}
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
