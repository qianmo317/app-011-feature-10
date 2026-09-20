import type { Plan, Room, Unit } from '../types';
import { calcMaterials } from './materialCalc';
import { polygonArea } from './geometry';

export interface PlanSummary {
  totalArea: number;
  matItemCount: number;
  totalPrice: number;
  outletCount: number;
}

export function summarizePlan(plan: Plan): PlanSummary {
  const results = calcMaterials(plan.rooms, plan.openings, plan.materials);
  return {
    totalArea: plan.rooms.reduce((s, r) => s + polygonArea(r.polygon), 0),
    matItemCount: results.length,
    totalPrice: results.reduce((s, r) => s + r.totalPrice, 0),
    outletCount: plan.outlets.length,
  };
}

export interface MatCompareRow {
  matId: string;
  name: string;
  unit: Unit;
  qtyA: number;
  qtyB: number;
  priceA: number | null;
  priceB: number | null;
  priceAUpdatedAt?: number;
  priceBUpdatedAt?: number;
  amountA: number;
  amountB: number;
  /** B 总价 - A 总价，正数表示 B 更贵 */
  diff: number;
  /** 差额中由单价不同引起的部分（按 A 方用量折算） */
  priceEffect: number;
  /** 差额中由用量不同引起的部分（按 B 方单价折算） */
  qtyEffect: number;
  /** 材料只出现在哪一侧；两侧都有则为 null */
  onlySide: 'A' | 'B' | null;
  /** 同一材料两边单价不一致（有一方可能是旧价） */
  priceMismatch: boolean;
}

const PRICE_EPS = 0.005;

export function comparePlanMaterials(a: Plan, b: Plan): MatCompareRow[] {
  const resA = calcMaterials(a.rooms, a.openings, a.materials);
  const resB = calcMaterials(b.rooms, b.openings, b.materials);
  const mapA = new Map(resA.map((r) => [r.matId, r]));
  const mapB = new Map(resB.map((r) => [r.matId, r]));
  const matInfoA = new Map(a.materials.map((m) => [m.id, m]));
  const matInfoB = new Map(b.materials.map((m) => [m.id, m]));

  const ids = new Set([...mapA.keys(), ...mapB.keys()]);
  const rows: MatCompareRow[] = [];

  for (const id of ids) {
    const ra = mapA.get(id);
    const rb = mapB.get(id);
    const ma = matInfoA.get(id);
    const mb = matInfoB.get(id);
    const qtyA = ra?.quantity ?? 0;
    const qtyB = rb?.quantity ?? 0;
    const priceA = ma?.price ?? null;
    const priceB = mb?.price ?? null;
    const amountA = ra?.totalPrice ?? 0;
    const amountB = rb?.totalPrice ?? 0;
    const diff = amountB - amountA;

    let priceEffect = 0;
    let qtyEffect = 0;
    let onlySide: 'A' | 'B' | null = null;
    if (ra && rb) {
      // 单价差按 A 方用量折算、用量差按 B 方单价折算，两者相加恰等于总价差
      priceEffect = ((priceB ?? 0) - (priceA ?? 0)) * qtyA;
      qtyEffect = (qtyB - qtyA) * (priceB ?? 0);
    } else {
      onlySide = ra ? 'A' : 'B';
      qtyEffect = diff;
    }

    rows.push({
      matId: id,
      name: ra?.name ?? rb?.name ?? id,
      unit: ra?.unit ?? rb?.unit ?? 'm2',
      qtyA,
      qtyB,
      priceA,
      priceB,
      priceAUpdatedAt: ma?.priceUpdatedAt,
      priceBUpdatedAt: mb?.priceUpdatedAt,
      amountA,
      amountB,
      diff,
      priceEffect,
      qtyEffect,
      onlySide,
      priceMismatch:
        !!ra && !!rb && priceA !== null && priceB !== null && Math.abs(priceA - priceB) > PRICE_EPS,
    });
  }

  // 差额绝对值大的排最前
  rows.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  return rows;
}

export interface RoomCompare {
  matchedCount: number;
  onlyA: Room[];
  onlyB: Room[];
}

/** 按房间名（忽略大小写与首尾空格）做多重集合对齐，重名房间按数量逐个配对 */
export function compareRooms(a: Room[], b: Room[]): RoomCompare {
  const norm = (s: string) => s.trim().toLowerCase();
  const poolB = new Map<string, Room[]>();
  for (const r of b) {
    const k = norm(r.name);
    const arr = poolB.get(k) ?? [];
    arr.push(r);
    poolB.set(k, arr);
  }

  const onlyA: Room[] = [];
  let matchedCount = 0;
  for (const r of a) {
    const arr = poolB.get(norm(r.name));
    if (arr && arr.length > 0) {
      arr.shift();
      matchedCount++;
    } else {
      onlyA.push(r);
    }
  }
  const onlyB = Array.from(poolB.values()).flat();
  return { matchedCount, onlyA, onlyB };
}

/** 方案内材料单价最近的手动修改时间；从未改过返回 undefined */
export function latestPriceUpdate(plan: Plan): number | undefined {
  let latest: number | undefined;
  for (const m of plan.materials) {
    if (m.priceUpdatedAt && (!latest || m.priceUpdatedAt > latest)) {
      latest = m.priceUpdatedAt;
    }
  }
  return latest;
}
