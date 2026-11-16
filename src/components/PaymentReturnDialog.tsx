import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, CreditCard, ExternalLink, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { checkInfinitePayPayment } from "@/lib/infinitepay";
import { formatPrice } from "@/lib/price";

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

  const verifyPayment = async (orderNsu: string, slug?: string, transactionNsu?: string, receipt?: string) => {
    setStatus("checking");
    setErrorMessage("");

    try {
      const res = await checkInfinitePayPayment({
        orderNsu,
        slug,
        transactionNsu,
        receiptUrl: receipt,
      });

      if (res.paid) {
        setStatus("success");
        setAppointment(res.appointment || null);
        // Limpar parâmetros da URL de forma limpa sem recarregar a página
        if (window.history.replaceState) {
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      } else {
        setStatus("pending");
      }
    } catch (err: any) {
      setStatus("pending");
      setErrorMessage(err.message || "Não foi possível confirmar o pagamento neste momento.");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderNsu = params.get("order_nsu");
    const payment = params.get("payment");
    const transactionNsu = params.get("transaction_nsu");
    const slug = params.get("slug");
    const receipt = params.get("receipt_url");

    if (receipt) setReceiptUrl(receipt);

    // Se detectou parâmetros de retorno do checkout da InfinitePay
    if (orderNsu || payment === "success" || transactionNsu) {
      setIsOpen(true);
      verifyPayment(orderNsu || "", slug || undefined, transactionNsu || undefined, receipt || undefined);
    }
  }, []);

  const handleRetry = () => {
    const params = new URLSearchParams(window.location.search);
    const orderNsu = params.get("order_nsu") || "";
    const slug = params.get("slug") || undefined;
    const transactionNsu = params.get("transaction_nsu") || undefined;
    const receipt = params.get("receipt_url") || undefined;
    verifyPayment(orderNsu, slug, transactionNsu, receipt);
  };

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
                Estamos confirmando a aprovação do seu sinal de reserva na InfinitePay e garantindo o seu horário na agenda.
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
                Seu sinal de reserva foi recebido pela <strong>InfinitePay</strong> e o seu horário foi <strong>oficialmente marcado</strong> na agenda da Jéssica Magalhães!
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
                  <span>Sinal 50% Pago via InfinitePay:</span>
                  <span>Aprovado</span>
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <a
                href={`https://wa.me/${formattedAdminPhone}?text=${encodeURIComponent(
                  `Olá Jéssica! Acabei de pagar o sinal na InfinitePay e meu agendamento foi confirmado. Gostaria de tirar uma dúvida!`
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
                  Ver Comprovante da InfinitePay
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
                  "A InfinitePay ainda está processando o pagamento. Se você pagou via Pix ou Cartão, pode levar alguns segundos para ser atualizado."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 pt-2">
              <Button
                type="button"
                onClick={handleRetry}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm"
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin hidden" />
                Verificar Novamente
              </Button>

              <a
                href={`https://wa.me/${formattedAdminPhone}?text=${encodeURIComponent(
                  `Olá Jéssica! Realizei o pagamento do sinal pela InfinitePay, mas gostaria de confirmar se já caiu para você.`
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
