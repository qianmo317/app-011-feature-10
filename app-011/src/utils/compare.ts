import type { Plan, Room, Unit } from '../types';
import { calcMaterials } from './materialCalc';
import { polygonArea } from './geometry';

export interface MaterialCompareRow {
  matId: string;
  name: string;
  unit: Unit;
  qtyA: number;
  qtyB: number;
  priceA: number;
  priceB: number;
  totalA: number;
  totalB: number;
  /** 总价差 = B小计 - A小计 */
  totalDiff: number;
  /** 用量差 = (B用量 - A用量) × A单价 */
  usageDiff: number;
  /** 单价差 = (B单价 - A单价) × B用量 */
  priceDiff: number;
  /** 该材料仅一侧使用（另一侧用量为 0） */
  onlyIn: 'A' | 'B' | null;
  editedAtA?: number;
  editedAtB?: number;
}

export interface RoomOnly {
  name: string;
  area: number;
}

export interface RoomMatched {
  name: string;
  areaA: number;
  areaB: number;
}

export interface PlanComparison {
  areaA: number;
  areaB: number;
  matCountA: number;
  matCountB: number;
  outletCountA: number;
  outletCountB: number;
  totalA: number;
  totalB: number;
  usageDiffTotal: number;
  priceDiffTotal: number;
  rows: MaterialCompareRow[];
  roomsMatched: RoomMatched[];
  roomsOnlyA: RoomOnly[];
  roomsOnlyB: RoomOnly[];
  lastPriceEditA: number | null;
  lastPriceEditB: number | null;
}

function lastPriceEdit(plan: Plan): number | null {
  let max = 0;
  for (const m of plan.materials) {
    if (m.priceUpdatedAt && m.priceUpdatedAt > max) max = m.priceUpdatedAt;
  }
  return max > 0 ? max : null;
}

/** 按房间名做多重集合配对，配不上的归入单侧列表 */
function matchRooms(roomsA: Room[], roomsB: Room[]) {
  const poolB = new Map<string, Room[]>();
  for (const r of roomsB) {
    const arr = poolB.get(r.name);
    if (arr) arr.push(r);
    else poolB.set(r.name, [r]);
  }
  const matched: RoomMatched[] = [];
  const onlyA: RoomOnly[] = [];
  for (const r of roomsA) {
    const cand = poolB.get(r.name);
    if (cand && cand.length > 0) {
      const other = cand.shift()!;
      matched.push({
        name: r.name,
        areaA: polygonArea(r.polygon),
        areaB: polygonArea(other.polygon),
      });
    } else {
      onlyA.push({ name: r.name, area: polygonArea(r.polygon) });
    }
  }
  const onlyB: RoomOnly[] = [];
  for (const arr of poolB.values()) {
    for (const r of arr) onlyB.push({ name: r.name, area: polygonArea(r.polygon) });
  }
  return { matched, onlyA, onlyB };
}

export function comparePlans(planA: Plan, planB: Plan): PlanComparison {
  const resA = calcMaterials(planA.rooms, planA.openings, planA.materials);
  const resB = calcMaterials(planB.rooms, planB.openings, planB.materials);
  const mapA = new Map(resA.map((r) => [r.matId, r]));
  const mapB = new Map(resB.map((r) => [r.matId, r]));

  const matIds: string[] = resA.map((r) => r.matId);
  for (const r of resB) {
    if (!mapA.has(r.matId)) matIds.push(r.matId);
  }

  const rows: MaterialCompareRow[] = matIds.map((id) => {
    const ra = mapA.get(id);
    const rb = mapB.get(id);
    const ma = planA.materials.find((m) => m.id === id);
    const mb = planB.materials.find((m) => m.id === id);
    const qtyA = ra?.quantity ?? 0;
    const qtyB = rb?.quantity ?? 0;
    const totalA = ra?.totalPrice ?? 0;
    const totalB = rb?.totalPrice ?? 0;
    const priceA = ma?.price ?? mb?.price ?? 0;
    const priceB = mb?.price ?? ma?.price ?? 0;
    // 差额分解：用量差按 A 单价计价，单价差按 B 用量计价，两者之和恒等于总价差
    const usageDiff = (qtyB - qtyA) * priceA;
    const priceDiff = (priceB - priceA) * qtyB;
    return {
      matId: id,
      name: ra?.name ?? rb?.name ?? ma?.name ?? mb?.name ?? id,
      unit: ra?.unit ?? rb?.unit ?? ma?.unit ?? mb?.unit ?? 'm2',
      qtyA,
      qtyB,
      priceA,
      priceB,
      totalA,
      totalB,
      totalDiff: totalB - totalA,
      usageDiff,
      priceDiff,
      onlyIn: !ra ? 'B' : !rb ? 'A' : null,
      editedAtA: ma?.priceUpdatedAt,
      editedAtB: mb?.priceUpdatedAt,
    };
  });

  // 差得最多的排最前
  rows.sort((x, y) => Math.abs(y.totalDiff) - Math.abs(x.totalDiff));

  const { matched, onlyA, onlyB } = matchRooms(planA.rooms, planB.rooms);

  return {
    areaA: planA.rooms.reduce((s, r) => s + polygonArea(r.polygon), 0),
    areaB: planB.rooms.reduce((s, r) => s + polygonArea(r.polygon), 0),
    matCountA: resA.length,
    matCountB: resB.length,
    outletCountA: planA.outlets.length,
    outletCountB: planB.outlets.length,
    totalA: resA.reduce((s, r) => s + r.totalPrice, 0),
    totalB: resB.reduce((s, r) => s + r.totalPrice, 0),
    usageDiffTotal: rows.reduce((s, r) => s + r.usageDiff, 0),
    priceDiffTotal: rows.reduce((s, r) => s + r.priceDiff, 0),
    rows,
    roomsMatched: matched,
    roomsOnlyA: onlyA,
    roomsOnlyB: onlyB,
    lastPriceEditA: lastPriceEdit(planA),
    lastPriceEditB: lastPriceEdit(planB),
  };
}
