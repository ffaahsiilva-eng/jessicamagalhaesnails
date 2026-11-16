import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { checkMercadoPagoPayment } from "@/lib/mercadopago";
import { checkInfinitePayPayment } from "@/lib/infinitepay";

interface PaymentReturnDialogProps {
  whatsappNumber?: string;
}

export const PaymentReturnDialog = ({ whatsappNumber }: PaymentReturnDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<"checking" | "success" | "pending">("checking");
  const [appointment, setAppointment] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const cleanAdmin = (whatsappNumber || "559191837179").replace(/\D/g, "");
  const formattedAdminPhone = cleanAdmin.startsWith("55") ? cleanAdmin : `55${cleanAdmin}`;

  const verifyPayment = async () => {
    setStatus("checking");
    setErrorMessage("");

    const params = new URLSearchParams(window.location.search);
    const orderNsu = params.get("order_nsu") || params.get("external_reference") || "";
    const paymentId = params.get("payment_id") || params.get("collection_id") || "";
    const preferenceId = params.get("preference_id") || "";
    const statusParam = params.get("status") || params.get("collection_status") || "";
    const provider = params.get("provider") || "";

    try {
      // 1. Tentar verificação pelo Mercado Pago
      const mpRes = await checkMercadoPagoPayment({
        orderNsu,
        paymentId,
        preferenceId,
        status: statusParam,
      });

      if (mpRes.paid) {
        setStatus("success");
        setAppointment(mpRes.appointment || null);
        if (window.history.replaceState) {
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
        return;
      }

      // 2. Se for link legado InfinitePay, tentar InfinitePay
      if (provider === "infinitepay" || (!paymentId && orderNsu)) {
        const infRes = await checkInfinitePayPayment({
          orderNsu,
          slug: params.get("slug") || undefined,
          transactionNsu: params.get("transaction_nsu") || undefined,
          receiptUrl: params.get("receipt_url") || undefined,
        });

        if (infRes.paid) {
          setStatus("success");
          setAppointment(infRes.appointment || null);
          if (window.history.replaceState) {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
          return;
        }
      }

      setStatus("pending");
    } catch (err: any) {
      setStatus("pending");
      setErrorMessage(err.message || "Não foi possível confirmar o pagamento neste momento.");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderNsu = params.get("order_nsu") || params.get("external_reference");
    const payment = params.get("payment");
    const paymentId = params.get("payment_id") || params.get("collection_id");
    const receipt = params.get("receipt_url");

    if (receipt) setReceiptUrl(receipt);

    // Se detectou parâmetros de retorno do Mercado Pago ou de checkout
    if (orderNsu || payment === "success" || paymentId) {
      setIsOpen(true);
      verifyPayment();
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    if (window.history.replaceState) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md text-center p-6 bg-card border-border shadow-2xl">
        {status === "checking" && (
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl text-foreground text-center">
                Verificando Pagamento...
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm text-center">
                Estamos confirmando a aprovação do seu sinal de reserva no <strong>Mercado Pago</strong> e garantindo o seu horário na agenda.
              </DialogDescription>
            </DialogHeader>
          </div>
        )}

        {status === "success" && (
          <div className="py-2 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>

            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-bold text-foreground text-center">
                Pagamento Confirmado! 🎉
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm text-center">
                Seu sinal de reserva foi recebido pelo <strong>Mercado Pago</strong> e o seu horário foi <strong>oficialmente marcado</strong> na agenda da Jéssica Magalhães!
              </DialogDescription>
            </DialogHeader>

            {appointment && (
              <div className="p-4 rounded-xl bg-secondary/50 border border-border/80 text-left text-xs space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-border/40 font-semibold text-foreground text-sm">
                  <span>{appointment.client_name}</span>
                  <span className="text-emerald-600 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" /> Confirmado
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serviço:</span>
                  <span className="font-medium text-foreground text-right max-w-[200px] truncate">{appointment.service_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data e Horário:</span>
                  <span className="font-medium text-foreground">
                    {appointment.appointment_date ? String(appointment.appointment_date).split("T")[0] : ""} às {String(appointment.appointment_time || "").slice(0, 5)}
                  </span>
                </div>
                <div className="pt-2 border-t border-border/40 flex justify-between text-emerald-600 font-semibold">
                  <span>Sinal 50% Pago via Mercado Pago:</span>
                  <span>Aprovado</span>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <a
                href={`https://wa.me/${formattedAdminPhone}?text=${encodeURIComponent(
                  `Olá Jéssica! Acabei de pagar o sinal no Mercado Pago e meu agendamento foi confirmado. Gostaria de tirar uma dúvida!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-medium text-sm transition-colors shadow-sm"
              >
                Conversar no WhatsApp da Jéssica
              </a>

              {receiptUrl && (
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background hover:bg-secondary text-foreground text-xs font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver Comprovante
                </a>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="w-full h-10 text-xs border-border"
              >
                Concluir e Fechar
              </Button>
            </div>
          </div>
        )}

        {status === "pending" && (
          <div className="py-2 space-y-4">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/40 rounded-full flex items-center justify-center mx-auto text-amber-600">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>

            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-bold text-foreground text-center">
                Aguardando Confirmação
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm text-center">
                {errorMessage ||
                  "O Mercado Pago ainda está processando o pagamento. Se você pagou via Pix ou Cartão, pode levar alguns segundos para ser atualizado."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 pt-2">
              <Button
                type="button"
                onClick={verifyPayment}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm"
              >
                Verificar Novamente
              </Button>

              <a
                href={`https://wa.me/${formattedAdminPhone}?text=${encodeURIComponent(
                  `Olá Jéssica! Realizei o pagamento do sinal pelo Mercado Pago, mas gostaria de confirmar se já caiu para você.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-medium text-xs transition-colors shadow-sm"
              >
                Falar com a Jéssica no WhatsApp
              </a>

              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                className="w-full h-9 text-xs text-muted-foreground"
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PaymentReturnDialog;
