import type { AlertEvent, AlertLevel, EquipmentNode, EquipmentType } from "./types.js";

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(++seq).toString().padStart(4, "0")}`;

function buildSeed(): Array<[string, EquipmentType, number, string]> {
  const seed: Array<[string, EquipmentType, number, string]> = [];

  const solarZones = ["A", "B", "C", "D", "E", "F"];
  for (const zone of solarZones) {
    for (let n = 1; n <= 10; n++) {
      const capacity = 300 + Math.round(Math.random() * 300);
      seed.push([`Solar Array ${zone}${n}`, "solar", capacity, `屋頂 ${zone} 區`]);
    }
  }

  const windFarms = ["北側風場", "南側風場"];
  windFarms.forEach((farm, i) => {
    for (let n = 1; n <= 6; n++) {
      const capacity = 700 + Math.round(Math.random() * 200);
      seed.push([`Wind Turbine ${i === 0 ? "N" : "S"}${n}`, "wind", capacity, farm]);
    }
  });

  for (let n = 1; n <= 8; n++) {
    seed.push([`Battery Bank ${n}`, "battery", 800 + Math.round(Math.random() * 400), `地下室機房 B${n}`]);
  }

  for (let n = 1; n <= 12; n++) {
    seed.push([`Inverter INV-${String(n).padStart(2, "0")}`, "inverter", 500 + Math.round(Math.random() * 200), `屋頂 ${solarZones[n % solarZones.length]} 區`]);
  }

  for (let n = 1; n <= 10; n++) {
    seed.push([`Smart Meter M-${String(n).padStart(2, "0")}`, "meter", 0, `配電室 ${n}`]);
  }

  return seed;
}

const EQUIPMENT_SEED = buildSeed();

export function createEquipmentFleet(): EquipmentNode[] {
  return EQUIPMENT_SEED.map(([name, type, capacityKw, location]) => ({
    id: nextId("EQ"),
    name,
    type,
    status: "online",
    outputKw: type === "meter" ? 0 : Math.round(capacityKw * (0.4 + Math.random() * 0.4)),
    capacityKw,
    soc: type === "battery" ? Math.round(50 + Math.random() * 40) : undefined,
    location,
    lastUpdated: Date.now(),
  }));
}

export function jitterEquipment(node: EquipmentNode): Partial<EquipmentNode> & { id: string } {
  const delta = node.capacityKw * (Math.random() * 0.1 - 0.05);
  const outputKw = Math.max(0, Math.min(node.capacityKw, Math.round(node.outputKw + delta)));
  const soc =
    node.type === "battery" && node.soc !== undefined
      ? Math.max(0, Math.min(100, Math.round(node.soc + (Math.random() * 4 - 2))))
      : undefined;

  const roll = Math.random();
  const status = roll > 0.985 ? "critical" : roll > 0.95 ? "warning" : "online";

  return {
    id: node.id,
    outputKw,
    ...(soc !== undefined ? { soc } : {}),
    status,
    lastUpdated: Date.now(),
  };
}

const ALERT_TEMPLATES: Array<[AlertLevel, string, string]> = [
  ["warning", "輸出功率偏低", "設備輸出低於預期容量的 40%，建議檢查面板遮蔽或線路狀況。"],
  ["warning", "SOC 偏低", "電池組電量低於 20%，請留意夜間備援能力。"],
  ["critical", "設備離線", "設備已超過 30 秒未回報狀態，可能發生通訊中斷。"],
  ["critical", "頻率異常波動", "電網頻率偏離 60Hz 超過 0.5Hz，請立即確認電網穩定性。"],
  ["info", "例行維護提醒", "設備已連續運轉 720 小時，建議排程例行檢查。"],
];

export function createRandomAlert(sourceId: string): AlertEvent {
  const [level, title, message] = ALERT_TEMPLATES[Math.floor(Math.random() * ALERT_TEMPLATES.length)];
  return {
    id: nextId("ALERT"),
    level,
    title,
    message,
    source: sourceId,
    timestamp: Date.now(),
    acknowledged: false,
  };
}

export function nextGridFrequency(prev: number): number {
  const drift = (Math.random() - 0.5) * 0.06;
  const reversion = (60 - prev) * 0.05;
  const next = prev + drift + reversion;
  return Math.round(next * 1000) / 1000;
}
