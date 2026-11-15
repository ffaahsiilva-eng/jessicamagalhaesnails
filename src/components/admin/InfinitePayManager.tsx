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
  X
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
import { MONTHS_LIST, parseDepositMonths } from "@/lib/infinitepay";

interface InfinitePaySettings {
  enabled: boolean;
  handle: string;
  apiKey: string;
  depositPercent: number;
  depositMonths: number[];
}

const InfinitePayManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<InfinitePaySettings>({
    enabled: true,
    handle: "paifilhoespirito",
    apiKey: "inchk_cIQ0seCo6bb6xA4y5_MasUTjWuT9T_5Mmqmhb5cVSSA",
    depositPercent: 50,
    depositMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
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
          "infinitepay_deposit_months",
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
          depositMonths: parseDepositMonths(map["infinitepay_deposit_months"]),
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

  const toggleMonth = (monthNumber: number) => {
    setConfig((prev) => {
      const exists = prev.depositMonths.includes(monthNumber);
      const newMonths = exists
        ? prev.depositMonths.filter((m) => m !== monthNumber)
        : [...prev.depositMonths, monthNumber].sort((a, b) => a - b);
      return { ...prev, depositMonths: newMonths };
    });
  };

  const handleActivateAllMonths = () => {
    setConfig((prev) => ({
      ...prev,
      depositMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    }));
  };

  const handleDeactivateAllMonths = () => {
    setConfig((prev) => ({
      ...prev,
      depositMonths: [],
    }));
  };

  const handleOnlyDecember = () => {
    setConfig((prev) => ({
      ...prev,
      depositMonths: [12],
    }));
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
        saveSetting("infinitepay_deposit_months", JSON.stringify(config.depositMonths), "Meses com Cobrança de Sinal"),
      ]);

      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      queryClient.invalidateQueries({ queryKey: ["site-settings-admin"] });

      toast({
        title: "Configurações salvas!",
        description: "Regras de cobrança mensal e dados da InfinitePay foram atualizados com sucesso.",
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
      <Card id="payment-settings" className="border-border">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="font-body text-sm text-muted-foreground">Carregando configurações de pagamento...</span>
        </CardContent>
      </Card>
    );
  }

  const activeCount = config.depositMonths.length;

  return (
    <Card id="payment-settings" className="border-border shadow-sm scroll-mt-20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="font-display text-xl text-foreground">
                Cobrança de Sinal (50%) & InfinitePay
              </CardTitle>
              <CardDescription className="font-body text-sm text-muted-foreground">
                Controle quais meses exigem sinal de 50% no agendamento e gerencie os dados de recebimento
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
        {/* SEÇÃO PRINCIPAL: Ativar / Desativar Cobrança por Mês */}
        <div className="p-4 sm:p-5 rounded-2xl bg-secondary/30 border border-primary/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary shrink-0" />
                <h3 className="font-display text-base sm:text-lg font-semibold text-foreground">
                  Cobrança de 50% por Mês do Agendamento
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground font-body mt-0.5">
                Escolha os meses em que o adiantamento de {config.depositPercent}% será cobrado. Nos meses desativados, o agendamento é direto no salão.
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleActivateAllMonths}
                className="h-8 text-xs font-body px-2.5"
              >
                Ativar Todos
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDeactivateAllMonths}
                className="h-8 text-xs font-body px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Desativar Todos
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleOnlyDecember}
                className="h-8 text-xs font-body px-2.5 bg-primary/15 hover:bg-primary/25 text-primary"
              >
                Apenas Dezembro
              </Button>
            </div>
          </div>

          {/* Grid dos 12 meses */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
            {MONTHS_LIST.map((m) => {
              const isSelected = config.depositMonths.includes(m.value);
              const isNovember = m.value === 11;
              const isDecember = m.value === 12;

              return (
                <div
                  key={m.value}
                  onClick={() => toggleMonth(m.value)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleMonth(m.value);
                    }
                  }}
                  className={`group relative p-3 rounded-xl border transition-all text-left cursor-pointer select-none flex flex-col justify-between min-h-[96px] ${
                    isSelected
                      ? "bg-primary/10 border-primary shadow-sm hover:border-primary hover:bg-primary/15"
                      : "bg-background/80 border-border/80 hover:border-border hover:bg-secondary/40 opacity-75 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold text-sm text-foreground">
                      {m.name}
                    </span>
                    <Switch
                      checked={isSelected}
                      onCheckedChange={() => toggleMonth(m.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="scale-75 origin-right"
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <Badge
                      variant={isSelected ? "default" : "outline"}
                      className={`text-[10px] px-1.5 py-0 font-medium ${
                        isSelected
                          ? "bg-emerald-600 hover:bg-emerald-600 text-white border-transparent"
                          : "text-muted-foreground border-border/70 bg-background/50"
                      }`}
                    >
                      {isSelected ? "Cobrar 50%" : "Sem Sinal (0%)"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {isDecember ? "🎄 Dez" : isNovember ? "🍂 Nov" : m.short}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resumo dinâmico da regra */}
          <div className="p-3.5 rounded-xl bg-background/80 border border-border/70 text-xs font-body space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <span>Resumo da regra atual para as clientes:</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {!config.enabled ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ O sistema de cobrança online está desativado no botão geral. Nenhum cliente pagará adiantamento independente do mês.
                </span>
              ) : activeCount === 12 ? (
                <>
                  <strong className="text-emerald-600 dark:text-emerald-400">Todos os 12 meses cobram sinal:</strong> qualquer pessoa que tentar agendar pagará {config.depositPercent}% adiantado via InfinitePay (Pix ou Cartão).
                </>
              ) : activeCount === 0 ? (
                <>
                  <strong className="text-amber-600 dark:text-amber-400">Nenhum mês cobrará sinal:</strong> todos os agendamentos serão confirmados direto na agenda, sem cobrança de adiantamento.
                </>
              ) : (
                <>
                  ✅ A cobrança de sinal ({config.depositPercent}%) está <strong>ativada</strong> em:{" "}
                  <span className="font-semibold text-primary">
                    {MONTHS_LIST.filter((m) => config.depositMonths.includes(m.value))
                      .map((m) => m.name)
                      .join(", ")}
                  </span>
                  .
                  <br />
                  🚫 Nos meses desativados (
                  <span className="text-foreground">
                    {MONTHS_LIST.filter((m) => !config.depositMonths.includes(m.value))
                      .map((m) => m.name)
                      .join(", ")}
                  </span>
                  ), o cliente que tentar agendar <strong>NÃO pagará sinal adiantado</strong> e o valor será pago diretamente no salão.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Credenciais e Ajustes da InfinitePay */}
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
