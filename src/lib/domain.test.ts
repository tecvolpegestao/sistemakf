import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canTransition,
  lineTotalCents,
  marginRatio,
  packageCostCents,
  parseBRL,
  parseDraftItem,
  paymentStatus,
  priceBoxLabel,
  summarize,
  normalizePlate,
  isValidPlate,
} from "./domain";
import { quoteSummary, whatsAppUrl } from "./format";

describe("custo e margem", () => {
  it("soma insumos e metragem no custo do serviço", () => {
    const supplies = packageCostCents([1200, 800]);
    const material = lineTotalCents({
      billing: "PER_METER",
      quantity: 1,
      meters: 2.5,
      unitPriceCents: 3500,
    });
    assert.equal(supplies + material, 10750);
  });

  it("calcula a margem sobre o preço", () => {
    assert.equal(marginRatio(1600, 800), 0.5);
    assert.equal(marginRatio(0, 800), null);
  });

  it("o custo do pacote é a soma dos serviços", () => {
    assert.equal(packageCostCents([28000, 22000, 18000, 15000, 12000]), 95000);
  });

  it("separa subtotal, desconto e saldo", () => {
    const result = summarize(
      [
        { billing: "PER_SERVICE", quantity: 1, meters: null, unitPriceCents: 50000, costCents: 0 },
        { billing: "PER_METER", quantity: 1, meters: 2, unitPriceCents: 10000, costCents: 4000 },
      ],
      5000,
      20000,
    );
    assert.equal(result.subtotalCents, 70000);
    assert.equal(result.totalCents, 65000);
    assert.equal(result.balanceCents, 45000);
    assert.equal(result.paymentStatus, "PARTIAL");
    assert.equal(result.costCents, 4000);
  });

  it("não deixa o desconto passar do subtotal", () => {
    const result = summarize(
      [{ billing: "PER_SERVICE", quantity: 1, meters: null, unitPriceCents: 1000, costCents: 0 }],
      99999,
      0,
    );
    assert.equal(result.totalCents, 0);
    assert.equal(result.paymentStatus, "UNPAID");
  });
});

describe("pagamento", () => {
  it("classifica sem pagamento, parcial e pago", () => {
    assert.equal(paymentStatus(50000, 0), "UNPAID");
    assert.equal(paymentStatus(50000, 49999), "PARTIAL");
    assert.equal(paymentStatus(50000, 50000), "PAID");
  });
});

describe("situação da ordem", () => {
  it("deixa o aplicador só avançar a execução", () => {
    assert.equal(canTransition("APPROVED", "IN_PROGRESS", "APPLICATOR"), true);
    assert.equal(canTransition("IN_PROGRESS", "READY", "APPLICATOR"), true);
    assert.equal(canTransition("AWAITING_APPROVAL", "APPROVED", "APPLICATOR"), false);
    assert.equal(canTransition("READY", "DELIVERED", "APPLICATOR"), false);
  });

  it("impede cancelar ordem entregue sem ser o dono", () => {
    assert.equal(canTransition("DELIVERED", "CANCELLED", "ATTENDANT"), false);
    assert.equal(canTransition("DELIVERED", "CANCELLED", "OWNER"), true);
  });

  it("segue o fluxo do orçamento até a entrega", () => {
    assert.equal(canTransition("QUOTE", "AWAITING_APPROVAL", "ATTENDANT"), true);
    assert.equal(canTransition("AWAITING_APPROVAL", "APPROVED", "ATTENDANT"), true);
    assert.equal(canTransition("APPROVED", "IN_PROGRESS", "ATTENDANT"), true);
    assert.equal(canTransition("IN_PROGRESS", "READY", "ATTENDANT"), true);
    assert.equal(canTransition("READY", "DELIVERED", "ATTENDANT"), true);
    assert.equal(canTransition("DELIVERED", "IN_PROGRESS", "OWNER"), false);
  });
});

describe("leitura de valores e placa", () => {
  it("entende real com vírgula e milhar", () => {
    assert.equal(parseBRL("R$ 1.500,50"), 150050);
    assert.equal(parseBRL("500"), 50000);
    assert.equal(parseBRL("1.500"), 150000);
    assert.equal(parseBRL("12,5"), 1250);
    assert.equal(parseBRL("-1"), null);
  });

  it("exige metragem no item por metro", () => {
    const missing = parseDraftItem(
      { catalogItemId: "1", quantity: "1", meters: "", price: "350,00" },
      "PER_METER",
    );
    assert.equal(missing.ok, false);
    const parsed = parseDraftItem(
      { catalogItemId: "1", quantity: "2", meters: "8,5", price: "350,00" },
      "PER_METER",
    );
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.meters, 8.5);
      assert.equal(parsed.value.quantity, 1);
      assert.equal(parsed.value.unitPriceCents, 35000);
    }
  });

  it("normaliza placa antiga e Mercosul", () => {
    assert.equal(normalizePlate("abc-1d23"), "ABC1D23");
    assert.equal(isValidPlate("ABC1D23"), true);
    assert.equal(isValidPlate("ABC1234"), true);
    assert.equal(isValidPlate("123"), false);
  });
});

describe("orçamento", () => {
  it("chama o destaque de pacote de valor por veículo", () => {
    assert.equal(
      priceBoxLabel([{ type: "PACKAGE", quantity: 1, billing: "PER_SERVICE" }]),
      "Valor por veículo",
    );
    assert.equal(
      priceBoxLabel([{ type: "MATERIAL_SERVICE", quantity: 1, billing: "PER_METER" }]),
      "Valor total",
    );
  });

  it("monta o texto de WhatsApp e o link", () => {
    const text = quoteSummary({
      number: 1001,
      clientName: "Auto Gallery",
      vehicleLine: "RTD1A11 · Toyota Corolla",
      items: [{ name: "Pacote comercial", detail: "" }],
      totalCents: 50000,
      priceLabel: "Valor por veículo",
    });
    assert.match(text, /Auto Gallery/);
    assert.match(text, /R\$\s*500,00/);
    assert.equal(whatsAppUrl("(11) 98888-1000", "Olá"), "https://wa.me/5511988881000?text=Ol%C3%A1");
    assert.equal(whatsAppUrl("", "Olá"), null);
  });
});
