import { useState, useEffect } from "react";
import { 
  CreditCard, 
  Loader2, 
  Save, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  CalendarDays,
  Info,
  Check,
  X,
  ExternalLink
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MONTHS_LIST, parseDepositMonths } from "@/lib/mercadopago";

interface MercadoPagoSettings {
  enabled: boolean;
  accessToken: string;
  publicKey: string;
  depositPercent: number;
  depositMonths: number[];
}

const MercadoPagoManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<MercadoPagoSettings>({
    enabled: true,
    accessToken: "",
    publicKey: "",
    depositPercent: 50,
    depositMonths: [12],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
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
          "mercadopago_enabled",
          "mercadopago_access_token",
          "mercadopago_public_key",
          "mercadopago_deposit_percent",
          "mercadopago_deposit_months",
        ]);

      if (error) {
        toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
      } else if (data) {
        const map: Record<string, string> = {};
        data.forEach((s) => {
          map[s.key] = s.value;
        });

        setConfig({
          enabled: map["mercadopago_enabled"] !== "false",
          accessToken: map["mercadopago_access_token"] || "",
          publicKey: map["mercadopago_public_key"] || "",
          depositPercent: parseInt(map["mercadopago_deposit_percent"] || "50", 10) || 50,
          depositMonths: parseDepositMonths(map["mercadopago_deposit_months"] || "[12]"),
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

  const toggleMonth = (monthValue: number) => {
    setConfig((prev) => {
      const exists = prev.depositMonths.includes(monthValue);
      const nextMonths = exists
        ? prev.depositMonths.filter((m) => m !== monthValue)
        : [...prev.depositMonths, monthValue].sort((a, b) => a - b);
      return { ...prev, depositMonths: nextMonths };
    });
  };

  const selectAllMonths = () => {
    setConfig((prev) => ({
      ...prev,
      depositMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    }));
  };

  const selectOnlyDecember = () => {
    setConfig((prev) => ({
      ...prev,
      depositMonths: [12],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        saveSetting("mercadopago_enabled", config.enabled ? "true" : "false", "Ativar Mercado Pago"),
        saveSetting("mercadopago_access_token", config.accessToken.trim(), "Access Token Mercado Pago"),
        saveSetting("mercadopago_public_key", config.publicKey.trim(), "Public Key Mercado Pago"),
        saveSetting("mercadopago_deposit_percent", String(config.depositPercent), "Porcentagem do Sinal"),
        saveSetting("mercadopago_deposit_months", JSON.stringify(config.depositMonths), "Meses com Cobrança de Sinal"),
        // Garante que a InfinitePay fique desativada
        saveSetting("infinitepay_enabled", "false", "Ativar InfinitePay"),
      ]);

      await queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      window.dispatchEvent(new Event("site-settings-changed"));

      toast({
        title: "Configurações salvas!",
        description: "Regras do Mercado Pago atualizadas com sucesso.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.accessToken.trim()) {
      setTestResult({
        success: false,
        message: "Por favor, preencha o Access Token antes de testar a conexão.",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/create-mercadopago-checkout", {
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
          message: "Conexão com o Mercado Pago validada com sucesso! Link de pagamento gerado perfeitamente.",
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "Não foi possível validar as credenciais no Mercado Pago.",
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
      <Card id="payment-settings">
        <CardContent className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Carregando configurações do Mercado Pago...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="payment-settings" className="border-border shadow-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-display">
              <CreditCard className="h-5 w-5 text-primary" />
              Mercado Pago & Sinal de Reserva
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Configure a cobrança antecipada de sinal (50% ou percentual personalizado) via Pix e Cartão de Crédito pelo Mercado Pago.
            </CardDescription>
          </div>
          <Badge
            variant={config.enabled ? "default" : "secondary"}
            className={config.enabled ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            {config.enabled ? "Ativo" : "Desativado"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Ativação Geral */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/30">
          <div className="space-y-0.5">
            <Label htmlFor="mp-enabled" className="text-sm font-semibold cursor-pointer">
              Cobrança de Sinal via Mercado Pago
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando ativado, clientes pagam o sinal online para agendar nos meses selecionados.
            </p>
          </div>
          <Switch
            id="mp-enabled"
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
          />
        </div>

        {/* Seleção de Meses com Cobrança de Sinal */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-primary" />
                Meses com Cobrança de Sinal
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                O sinal só será exigido nas datas que caírem nos meses selecionados abaixo.
              </p>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={selectOnlyDecember}
              >
                Só Dezembro
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={selectAllMonths}
              >
                Todos os Meses
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
            {MONTHS_LIST.map((m) => {
              const isSelected = config.depositMonths.includes(m.value);
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => toggleMonth(m.value)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <span>{m.name}</span>
                  {isSelected ? (
                    <Check className="h-3 w-3 ml-1 shrink-0" />
                  ) : (
                    <X className="h-3 w-3 ml-1 shrink-0 opacity-30" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
            <Info className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>
              {config.depositMonths.length === 0 ? (
                <strong className="text-rose-500">Nenhum mês ativo (todos agendam direto sem sinal).</strong>
              ) : config.depositMonths.length === 1 && config.depositMonths[0] === 12 ? (
                <span>Ativo <strong>apenas em Dezembro</strong> (alta temporada de fim de ano). Nos demais meses, o agendamento é livre sem sinal.</span>
              ) : (
                <span>Ativo em <strong>{config.depositMonths.length} {config.depositMonths.length === 1 ? "mês" : "meses"}</strong> do ano.</span>
              )}
            </span>
          </div>
        </div>

        {/* Porcentagem do Sinal */}
        <div className="space-y-2">
          <Label htmlFor="mp-percent" className="text-xs font-semibold">
            Porcentagem do Sinal (%)
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="mp-percent"
              type="number"
              min="10"
              max="100"
              step="5"
              value={config.depositPercent}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  depositPercent: Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 50)),
                }))
              }
              className="w-32"
            />
            <span className="text-xs text-muted-foreground">
              Valor padrão: <strong>50%</strong>. A cliente paga metade no agendamento e o restante no salão.
            </span>
          </div>
        </div>

        {/* Credenciais do Mercado Pago */}
        <div className="space-y-4 pt-2 border-t border-border">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Credenciais da API do Mercado Pago</h4>
            <p className="text-xs text-muted-foreground">
              Obtidas na sua conta de vendedor em{" "}
              <a
                href="https://www.mercadopago.com.br/developers/panel/app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
              >
                Mercado Pago Developers <ExternalLink className="h-3 w-3" />
              </a>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mp-access-token" className="text-xs font-semibold">
              Access Token de Produção
            </Label>
            <div className="relative">
              <Input
                id="mp-access-token"
                type={showAccessToken ? "text" : "password"}
                placeholder="APP_USR-0000000000000000-000000-..."
                value={config.accessToken}
                onChange={(e) => setConfig((prev) => ({ ...prev, accessToken: e.target.value }))}
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowAccessToken(!showAccessToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Chave secreta de produção gerada no painel do Mercado Pago (começa com <code>APP_USR-</code>).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mp-public-key" className="text-xs font-semibold">
              Public Key (Chave Pública - Opcional)
            </Label>
            <Input
              id="mp-public-key"
              type="text"
              placeholder="APP_USR-..."
              value={config.publicKey}
              onChange={(e) => setConfig((prev) => ({ ...prev, publicKey: e.target.value }))}
              className="font-mono text-xs"
            />
          </div>
        </div>

        {/* Guia Rápido de Configuração */}
        <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/80 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <Info className="h-4 w-4 text-primary" />
            Como pegar suas credenciais no Mercado Pago:
          </p>
          <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
            <li>Acesse o <strong>Mercado Pago Developers</strong> e faça login com a conta onde quer receber.</li>
            <li>Vá em <strong>Suas aplicações</strong> e clique na sua aplicação (ou crie uma para a manicure).</li>
            <li>No menu lateral, clique em <strong>Credenciais de produção</strong>.</li>
            <li>Copie o <strong>Access Token</strong> de produção e cole no campo acima.</li>
            <li>Clique no botão <strong>"Salvar Configurações"</strong> abaixo e depois em <strong>"Testar Conexão"</strong>.</li>
          </ol>
        </div>

        {/* Resultado do Teste */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
              testResult.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{testResult.success ? "Sucesso!" : "Falha na Conexão"}</p>
              <p className="text-[11px] opacity-90 mt-0.5">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting || isSaving}
            className="w-full sm:w-auto text-xs"
          >
            {isTesting ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Testar Conexão com Mercado Pago
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isTesting}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-2 h-3.5 w-3.5" />
            )}
            Salvar Configurações do Mercado Pago
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MercadoPagoManager;
