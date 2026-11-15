import { useState, useEffect } from "react";
import { CreditCard, Loader2, Save, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface InfinitePaySettings {
  enabled: boolean;
  handle: string;
  apiKey: string;
  depositPercent: number;
}

const InfinitePayManager = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<InfinitePaySettings>({
    enabled: true,
    handle: "paifilhoespirito",
    apiKey: "inchk_cIQ0seCo6bb6xA4y5_MasUTjWuT9T_5Mmqmhb5cVSSA",
    depositPercent: 50,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", [
          "infinitepay_enabled",
          "infinitepay_handle",
          "infinitepay_api_key",
          "infinitepay_deposit_percent",
        ]);

      if (error) {
        toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
      } else if (data) {
        const map: Record<string, string> = {};
        data.forEach((s) => {
          map[s.key] = s.value;
        });

        setConfig({
          enabled: map["infinitepay_enabled"] !== "false",
          handle: map["infinitepay_handle"] || "paifilhoespirito",
          apiKey: map["infinitepay_api_key"] || "inchk_cIQ0seCo6bb6xA4y5_MasUTjWuT9T_5Mmqmhb5cVSSA",
          depositPercent: parseInt(map["infinitepay_deposit_percent"] || "50", 10) || 50,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string, label: string) => {
    return supabase.from("site_settings").upsert(
      {
        key,
        value,
        label,
        category: "payment",
        type: "text",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setTestResult(null);
    try {
      await Promise.all([
        saveSetting("infinitepay_enabled", config.enabled ? "true" : "false", "Pagamento InfinitePay Ativo"),
        saveSetting("infinitepay_handle", config.handle.trim(), "InfinitePay Handle/Tag"),
        saveSetting("infinitepay_api_key", config.apiKey.trim(), "InfinitePay API Key"),
        saveSetting("infinitepay_deposit_percent", String(config.depositPercent), "Porcentagem de Sinal (%)"),
      ]);

      toast({
        title: "Configurações salvas!",
        description: "Os dados da InfinitePay foram atualizados com sucesso.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/create-infinitepay-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: "test-connection-" + Date.now(),
          client_name: "Teste de Conexão",
          service_type: "Teste",
          total_amount: 10,
          site_url: window.location.origin,
        }),
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setTestResult({
          success: true,
          message: "Conexão com a InfinitePay funcionando perfeitamente! Link gerado com sucesso.",
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "Não foi possível validar as credenciais.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Erro de rede ao conectar com a API.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="font-body text-sm text-muted-foreground">Carregando configurações de pagamento...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="font-display text-xl text-foreground">
                Pagamentos InfinitePay (Checkout Automático)
              </CardTitle>
              <CardDescription className="font-body text-sm text-muted-foreground">
                Cobrança de sinal de 50% para confirmação automática de agendamentos via Pix e Cartão
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="pay-enabled" className="text-xs font-body text-muted-foreground">
              {config.enabled ? "Ativo" : "Inativo"}
            </Label>
            <Switch
              id="pay-enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="handle" className="font-body text-foreground">
              Sua Tag / Handle da InfinitePay *
            </Label>
            <div className="relative">
              <Input
                id="handle"
                value={config.handle}
                onChange={(e) => setConfig((prev) => ({ ...prev, handle: e.target.value.replace(/^[@$]/, "").trim() }))}
                placeholder="Ex: jessicamagalhaes"
                className="bg-secondary/40 font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground font-body">
              Seu identificador na InfinitePay (sem o @ ou $).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deposit-percent" className="font-body text-foreground">
              Porcentagem do Sinal de Reserva (%)
            </Label>
            <Input
              id="deposit-percent"
              type="number"
              min={10}
              max={100}
              value={config.depositPercent}
              onChange={(e) => setConfig((prev) => ({ ...prev, depositPercent: parseInt(e.target.value, 10) || 50 }))}
              className="bg-secondary/40 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground font-body">
              Definido como {config.depositPercent}% (ex: em um serviço de R$ 100, a cliente paga R$ {config.depositPercent} no Pix/Cartão).
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-key" className="font-body text-foreground">
            Chave de API (API Key do Checkout) *
          </Label>
          <div className="relative">
            <Input
              id="api-key"
              type={showApiKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => setConfig((prev) => ({ ...prev, apiKey: e.target.value.trim() }))}
              placeholder="inchk_..."
              className="bg-secondary/40 font-mono text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground font-body">
            Chave gerada no menu Checkout Integrado da InfinitePay (começa com inchk_).
          </p>
        </div>

        {testResult && (
          <div
            className={`p-4 rounded-xl flex items-start gap-3 border ${
              testResult.success
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-800 dark:text-emerald-300"
                : "bg-destructive/10 border-destructive/20 text-destructive"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            )}
            <span className="font-body text-sm leading-relaxed">{testResult.message}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting || !config.apiKey || !config.handle}
            className="w-full sm:w-auto font-body"
          >
            {isTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Testar Conexão com a InfinitePay
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-body shadow-button"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InfinitePayManager;
