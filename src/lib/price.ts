/**
 * Utilitários para parse e formatação de preços de serviços em BRL.
 */

export const parsePrice = (priceStr?: string | null): number => {
  if (!priceStr) return 0;
  // Limpar R$, símbolos, espaços
  const cleaned = priceStr.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return 0;

  // Se tiver vírgula, tratamos como separador decimal brasileiro: "80,00" ou "1.200,50"
  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const val = parseFloat(normalized);
    return isNaN(val) ? 0 : val;
  }

  // Sem vírgula, ex: "80", "120" ou "80.00"
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
};

export const formatPrice = (val: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
};

export interface ServicePriceSummary {
  names: string[];
  totalNumber: number;
  totalFormatted: string;
  breakdown: Array<{ name: string; price: string; parsed: number }>;
}

export const calculateServicesTotal = (
  serviceInput: string | string[],
  availableServices: Array<{ name: string; price: string }>
): ServicePriceSummary => {
  const names = (Array.isArray(serviceInput) ? serviceInput : serviceInput.split(/\s*\+\s*/))
    .map((s) => s.trim())
    .filter(Boolean);

  let totalNumber = 0;
  const breakdown: Array<{ name: string; price: string; parsed: number }> = [];

  for (const name of names) {
    const matched = availableServices.find(
      (s) => s.name.trim().toLowerCase() === name.toLowerCase()
    );
    const rawPrice = matched?.price || "";
    const parsed = parsePrice(rawPrice);
    totalNumber += parsed;
    breakdown.push({
      name,
      price: rawPrice || (parsed > 0 ? formatPrice(parsed) : ""),
      parsed,
    });
  }

  return {
    names,
    totalNumber,
    totalFormatted: totalNumber > 0 ? formatPrice(totalNumber) : "",
    breakdown,
  };
};

/**
 * Extrai o valor salvo nas observações (ex: "[Valor: R$ 115,00]") se houver
 */
export const extractPriceFromNotes = (notes?: string | null): string => {
  if (!notes) return "";
  const match = notes.match(/\[Valor:\s*([^\]]+)\]/i);
  return match ? match[1].trim() : "";
};

/**
 * Remove a tag interna de valor das anotações antes de exibir para o cliente
 */
export const cleanNotesForDisplay = (notes?: string | null): string => {
  if (!notes) return "";
  return notes.replace(/\s*\[Valor:[^\]]*\]/gi, "").trim();
};

