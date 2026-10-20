import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { DEFAULT_CLOSING, DEFAULT_PRESENTATION } from "../src/lib/labels";

const prisma = new PrismaClient();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

async function main() {
  await prisma.attachment.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.serviceStep.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.workOrderItem.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.packageComponent.deleteMany();
  await prisma.catalogItem.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();

  const passwordHash = hashSync("kfdetail", 10);
  const [victor, atendimento, aplicador] = await Promise.all([
    prisma.user.create({ data: { name: "Victor", email: "victor@kfdetail.com.br", passwordHash, role: "OWNER" } }),
    prisma.user.create({ data: { name: "Atendimento", email: "atendimento@kfdetail.com.br", passwordHash, role: "ATTENDANT" } }),
    prisma.user.create({ data: { name: "Aplicador", email: "aplicador@kfdetail.com.br", passwordHash, role: "APPLICATOR" } }),
  ]);

  await prisma.setting.createMany({
    data: [
      { key: "presentation", value: DEFAULT_PRESENTATION },
      { key: "closing", value: DEFAULT_CLOSING },
      { key: "instagram", value: "" },
      { key: "city", value: "" },
      { key: "pixKey", value: "" },
    ],
  });

  const gallery = await prisma.client.create({
    data: {
      name: "Auto Gallery",
      type: "PARTNER",
      phone: "11988881000",
      notes: "Loja parceira. O pacote comercial é R$ 500 por veículo.",
    },
  });
  const ricardo = await prisma.client.create({
    data: { name: "Ricardo Almeida", type: "PRIVATE", phone: "11977772000", email: "ricardo.almeida@example.com" },
  });
  const fernanda = await prisma.client.create({
    data: { name: "Fernanda Lopes", type: "PRIVATE", phone: "11966663000" },
  });

  const corolla = await prisma.vehicle.create({
    data: { clientId: gallery.id, plate: "RTD1A11", brand: "Toyota", model: "Corolla", year: 2022, color: "Prata" },
  });
  const tcross = await prisma.vehicle.create({
    data: { clientId: gallery.id, plate: "RTD2B22", brand: "Volkswagen", model: "T-Cross", year: 2023, color: "Cinza" },
  });
  const hb20 = await prisma.vehicle.create({
    data: { clientId: gallery.id, plate: "RTD3C33", brand: "Hyundai", model: "HB20", year: 2021, color: "Preto" },
  });
  const civic = await prisma.vehicle.create({
    data: { clientId: ricardo.id, plate: "RAL4D44", brand: "Honda", model: "Civic", year: 2021, color: "Prata" },
  });
  const compass = await prisma.vehicle.create({
    data: { clientId: fernanda.id, plate: "FLO5E55", brand: "Jeep", model: "Compass", year: 2020, color: "Branco" },
  });

  const service = (data: {
    name: string;
    description: string;
    priceCents: number;
    icon: string;
    type?: string;
    billing?: string;
  }) =>
    prisma.catalogItem.create({
      data: {
        type: data.type ?? "LABOR",
        billing: data.billing ?? "PER_SERVICE",
        name: data.name,
        description: data.description,
        priceCents: data.priceCents,
        icon: data.icon,
        active: true,
      },
    });

  const polimento = await service({
    name: "Polimento comercial",
    description: "Correção de brilho e riscos leves da pintura.",
    priceCents: 28000,
    icon: "sparkles",
  });
  const vitrificacao = await service({
    name: "Vitrificação",
    description: "Proteção da pintura com camada de vitrificação.",
    priceCents: 90000,
    icon: "shield",
  });
  const lavagem = await service({
    name: "Lavagem detalhada",
    description: "Lavagem completa com descontaminação da pintura.",
    priceCents: 18000,
    icon: "droplets",
  });
  const motor = await service({
    name: "Lavagem de motor",
    description: "Limpeza do cofre e do motor.",
    priceCents: 12000,
    icon: "wind",
  });
  const higienizacao = await service({
    name: "Higienização interna",
    description: "Limpeza de bancos, painel, portas e carpete.",
    priceCents: 22000,
    icon: "spray",
  });
  const remocao = await service({
    name: "Remoção de película",
    description: "Retirada da película antiga e limpeza dos vidros.",
    priceCents: 15000,
    icon: "sun",
  });
  await service({
    name: "PPF",
    description: "Aplicação de paint protection film na área combinada.",
    priceCents: 35000,
    icon: "shield",
    type: "MATERIAL_SERVICE",
    billing: "PER_METER",
  });
  await service({
    name: "Película fumê",
    description: "Aplicação de película fumê nos vidros combinados.",
    priceCents: 18000,
    icon: "sun",
    type: "MATERIAL_SERVICE",
    billing: "PER_METER",
  });
  const pacote = await prisma.catalogItem.create({
    data: {
      type: "PACKAGE",
      name: "Pacote comercial Auto Gallery",
      description: "Pacote por veículo combinado com a loja.",
      priceCents: 50000,
      billing: "PER_SERVICE",
      icon: "package",
      partnerId: gallery.id,
      components: {
        create: [polimento, higienizacao, lavagem, remocao, motor].map((item) => ({ componentId: item.id })),
      },
    },
  });
  await prisma.catalogItem.create({
    data: {
      type: "RESALE",
      name: "Aromatizante",
      description: "Aromatizante automotivo para revenda.",
      category: "Interior",
      priceCents: 1600,
      costCents: 800,
      billing: "PER_UNIT",
      unit: "un",
      minStock: 6,
      icon: "flower",
    },
  });

  const line = (item: { id: string; name: string; description: string; icon: string; type: string; billing: string; priceCents: number }, extra?: { meters?: number; quantity?: number }) => ({
    catalogItemId: item.id,
    name: item.name,
    description: item.description,
    icon: item.icon,
    type: item.type,
    billing: item.billing,
    quantity: extra?.quantity ?? 1,
    meters: extra?.meters ?? null,
    unitPriceCents: item.priceCents,
    costCents: 0,
  });

  await prisma.workOrder.create({
    data: {
      number: 1001,
      clientId: fernanda.id,
      vehicleId: compass.id,
      status: "QUOTE",
      paymentStatus: "UNPAID",
      createdById: atendimento.id,
      items: { create: [line(vitrificacao)] },
      steps: { create: [{ name: vitrificacao.name, sortOrder: 0 }] },
      events: { create: { userId: atendimento.id, message: "Atendimento criou o orçamento.", createdAt: daysAgo(1) } },
      createdAt: daysAgo(1),
    },
  });

  await prisma.workOrder.create({
    data: {
      number: 1002,
      clientId: ricardo.id,
      vehicleId: civic.id,
      status: "AWAITING_APPROVAL",
      paymentStatus: "UNPAID",
      createdById: atendimento.id,
      items: { create: [line(lavagem, { quantity: 1 }), { ...line(polimento), sortOrder: 1 }] },
      steps: { create: [{ name: lavagem.name, sortOrder: 0 }, { name: polimento.name, sortOrder: 1 }] },
      events: { create: { userId: atendimento.id, message: "Atendimento enviou o orçamento para aprovação.", createdAt: daysAgo(2) } },
      createdAt: daysAgo(2),
    },
  });

  await prisma.workOrder.create({
    data: {
      number: 1003,
      clientId: gallery.id,
      vehicleId: corolla.id,
      status: "IN_PROGRESS",
      paymentStatus: "UNPAID",
      createdById: atendimento.id,
      assignedToId: aplicador.id,
      approvedAt: daysAgo(1),
      items: { create: [line(pacote)] },
      steps: {
        create: [polimento, higienizacao, lavagem, remocao, motor].map((item, index) => ({
          name: item.name,
          sortOrder: index,
          done: index < 2,
          doneAt: index < 2 ? daysAgo(0) : null,
          doneById: index < 2 ? aplicador.id : null,
        })),
      },
      events: {
        create: [
          { userId: atendimento.id, message: "Atendimento criou o orçamento.", createdAt: daysAgo(3) },
          { userId: victor.id, message: "Victor: Registrar aprovação.", createdAt: daysAgo(1) },
          { userId: aplicador.id, message: "Aplicador concluiu a etapa Polimento comercial.", createdAt: daysAgo(0) },
        ],
      },
      createdAt: daysAgo(3),
    },
  });

  await prisma.workOrder.create({
    data: {
      number: 1004,
      clientId: gallery.id,
      vehicleId: tcross.id,
      status: "READY",
      paymentStatus: "UNPAID",
      createdById: atendimento.id,
      assignedToId: aplicador.id,
      approvedAt: daysAgo(4),
      readyAt: daysAgo(1),
      items: { create: [line(pacote)] },
      steps: {
        create: [polimento, higienizacao, lavagem, remocao, motor].map((item, index) => ({
          name: item.name,
          sortOrder: index,
          done: true,
          doneAt: daysAgo(1),
          doneById: aplicador.id,
        })),
      },
      events: { create: { userId: aplicador.id, message: "Aplicador: Marcar pronto.", createdAt: daysAgo(1) } },
      createdAt: daysAgo(5),
    },
  });

  await prisma.workOrder.create({
    data: {
      number: 1005,
      clientId: gallery.id,
      vehicleId: hb20.id,
      status: "DELIVERED",
      paymentStatus: "UNPAID",
      createdById: atendimento.id,
      approvedAt: daysAgo(14),
      readyAt: daysAgo(13),
      deliveredAt: daysAgo(12),
      items: { create: [line(pacote)] },
      steps: {
        create: [polimento, higienizacao, lavagem, remocao, motor].map((item, index) => ({
          name: item.name,
          sortOrder: index,
          done: true,
          doneAt: daysAgo(13),
          doneById: aplicador.id,
        })),
      },
      events: { create: { userId: atendimento.id, message: "Atendimento: Marcar entregue.", createdAt: daysAgo(12) } },
      createdAt: daysAgo(15),
    },
  });

  await prisma.workOrder.create({
    data: {
      number: 1006,
      clientId: ricardo.id,
      vehicleId: civic.id,
      status: "DELIVERED",
      paymentStatus: "PAID",
      createdById: victor.id,
      approvedAt: daysAgo(21),
      readyAt: daysAgo(20),
      deliveredAt: daysAgo(20),
      items: { create: [line(polimento)] },
      steps: { create: [{ name: polimento.name, sortOrder: 0, done: true, doneAt: daysAgo(20), doneById: aplicador.id }] },
      payments: {
        create: {
          amountCents: 28000,
          method: "PIX",
          paidAt: daysAgo(18),
          recordedById: atendimento.id,
        },
      },
      events: { create: { userId: atendimento.id, message: "Atendimento registrou um recebimento.", createdAt: daysAgo(18) } },
      createdAt: daysAgo(22),
    },
  });

  console.log("Base de demonstração pronta.");
  console.log("Dono: victor@kfdetail.com.br");
  console.log("Atendimento: atendimento@kfdetail.com.br");
  console.log("Aplicador: aplicador@kfdetail.com.br");
  console.log("Senha: kfdetail");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
