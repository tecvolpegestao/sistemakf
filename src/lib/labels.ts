import type { ServiceStatus } from "./types";

export const ROLE_LABEL = {
  OWNER: "Dono",
  ATTENDANT: "Atendimento",
  APPLICATOR: "Aplicador",
} as const;

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  QUOTE: "Orçamento",
  AWAITING_APPROVAL: "Aguardando aprovação",
  APPROVED: "Aprovado",
  IN_PROGRESS: "Em execução",
  READY: "Pronto",
  DELIVERED: "Entregue",
  REFUSED: "Recusado",
  CANCELLED: "Cancelado",
};

export const STATUS_ACTION: Record<ServiceStatus, string> = {
  QUOTE: "Voltar para orçamento",
  AWAITING_APPROVAL: "Enviar para aprovação",
  APPROVED: "Registrar aprovação",
  IN_PROGRESS: "Iniciar execução",
  READY: "Marcar pronto",
  DELIVERED: "Marcar entregue",
  REFUSED: "Recusar",
  CANCELLED: "Cancelar",
};

export const PAYMENT_LABEL = {
  UNPAID: "Sem pagamento",
  PARTIAL: "Pago em parte",
  PAID: "Pago",
} as const;

export const TYPE_LABEL = {
  LABOR: "Mão de obra",
  MATERIAL_SERVICE: "Serviço com produto",
  PACKAGE: "Pacote",
  RESALE: "Produto",
} as const;

export const BILLING_LABEL = {
  PER_SERVICE: "Por serviço",
  PER_METER: "Por metro",
  PER_UNIT: "Por unidade",
} as const;

export const METHOD_LABEL = {
  PIX: "Pix",
  CASH: "Dinheiro",
  CARD: "Cartão",
} as const;

export const CLIENT_LABEL = {
  PRIVATE: "Particular",
  PARTNER: "Parceiro",
} as const;

export const ATTACHMENT_LABEL = {
  BEFORE: "Antes",
  AFTER: "Depois",
} as const;

export const ICONS = [
  { id: "sparkles", label: "Brilho" },
  { id: "droplets", label: "Lavagem" },
  { id: "shield", label: "Proteção" },
  { id: "car", label: "Veículo" },
  { id: "wind", label: "Motor" },
  { id: "sun", label: "Vidro" },
  { id: "spray", label: "Higienização" },
  { id: "package", label: "Pacote" },
  { id: "flower", label: "Produto" },
] as const;

export const ICON_IDS = new Set<string>(ICONS.map((icon) => icon.id));

export const DEFAULT_PRESENTATION =
  "A KF Detail apresenta o orçamento dos serviços de estética automotiva para o veículo abaixo. O escopo e o valor descritos neste documento são o combinado para a execução.";

export const DEFAULT_CLOSING =
  "A aprovação confirma o escopo e o valor. A data de entrada do veículo é alinhada em seguida com a equipe.";
