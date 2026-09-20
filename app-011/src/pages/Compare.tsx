import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
import type { Plan } from '../types';
import { polygonArea } from '../utils/geometry';
import {
  summarizePlan,
  comparePlanMaterials,
  compareRooms,
  latestPriceUpdate,
  type MatCompareRow,
} from '../utils/compare';

const EPS = 0.005;

const fmtMoney = (n: number) => `¥${n.toFixed(2)}`;
const fmtSignedMoney = (n: number) =>
  `${n > EPS ? '+' : n < -EPS ? '-' : ''}¥${Math.abs(n).toFixed(2)}`;
const fmtSignedQty = (n: number) =>
  `${n > EPS ? '+' : n < -EPS ? '-' : ''}${Math.abs(n).toFixed(2)}`;
const fmtSignedInt = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n)}`;
const fmtTime = (t: number) => new Date(t).toLocaleString();
/** 差额为正 = 方案B更贵（红），为负 = 方案B更省（绿） */
const diffColor = (n: number) => (n > EPS ? '#e74c3c' : n < -EPS ? '#27ae60' : '#999');
/** 非金额指标（面积/数量）的差值用中性色，大小不代表贵贱 */
const NEUTRAL = '#666';

export default function Compare() {
  const [searchParams] = useSearchParams();
  const { plans } = useStore();
  const planA = plans.find((p) => p.id === searchParams.get('a'));
  const planB = plans.find((p) => p.id === searchParams.get('b'));

  if (!planA || !planB) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ marginBottom: 16, color: '#666' }}>
          无法进行比选：方案不存在或已被删除，请返回列表重新勾选两个方案。
        </p>
        <Link className="btn btn-primary" to="/">
          返回方案列表
        </Link>
      </div>
    );
  }

  const sumA = summarizePlan(planA);
  const sumB = summarizePlan(planB);
  const rows = comparePlanMaterials(planA, planB);
  const roomCmp = compareRooms(planA.rooms, planB.rooms);
  const staleRows = rows.filter((r) => r.priceMismatch);

  const totalDiff = sumB.totalPrice - sumA.totalPrice;
  const priceEffectSum = rows.reduce((s, r) => s + r.priceEffect, 0);
  const qtyEffectSum = rows.reduce((s, r) => s + r.qtyEffect, 0);
  const cheaper: 'A' | 'B' | null =
    totalDiff > EPS ? 'A' : totalDiff < -EPS ? 'B' : null;
  const maxTotal = Math.max(sumA.totalPrice, sumB.totalPrice);

  return (
    <div>
      <h2 className="page-title">方案比选</h2>

      <div className="toolbar no-print">
        <Link className="btn btn-secondary" to="/">
          ← 返回方案列表
        </Link>
        <span style={{ color: '#999', fontSize: 13 }}>
          数据为实时计算；改价或改图后刷新本页即为最新结论
        </span>
      </div>

      {staleRows.length > 0 && (
        <div
          className="card"
          style={{ border: '1px solid #e67e22', background: '#fdf6ec' }}
        >
          <div style={{ color: '#d35400', fontWeight: 600, marginBottom: 8 }}>
            ⚠ {staleRows.length} 项材料两边单价不一致，下面按各自单价算出的结论可能基于旧价，核实前请勿据此下单
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#7f4f16' }}>
            {staleRows.map((r) => (
              <li key={r.matId} style={{ marginBottom: 4 }}>
                {staleNote(r, planA.name, planB.name)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 汇总并排 */}
      <div className="card">
        <div
          style={{
            marginBottom: 12,
            fontSize: 16,
            fontWeight: 600,
            color: cheaper ? '#27ae60' : '#2c3e50',
          }}
        >
          {cheaper === null
            ? '两方案材料总价相同'
            : `方案${cheaper}「${cheaper === 'A' ? planA.name : planB.name}」更省钱：总价低 ${fmtMoney(Math.abs(totalDiff))}` +
              (maxTotal > 0 ? `（约低 ${((Math.abs(totalDiff) / maxTotal) * 100).toFixed(1)}%）` : '')}
          {staleRows.length > 0 && (
            <span className="badge badge-warn" style={{ fontWeight: 400 }}>
              含旧价材料，结论可能过时
            </span>
          )}
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ width: 140 }}>指标</th>
              <th>
                方案A：
                <Link to={`/plan/${planA.id}/bom`}>{planA.name}</Link>
              </th>
              <th>
                方案B：
                <Link to={`/plan/${planB.id}/bom`}>{planB.name}</Link>
              </th>
              <th style={{ width: 160 }}>差值（B − A）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>总面积</td>
              <td>{sumA.totalArea.toFixed(2)} m²</td>
              <td>{sumB.totalArea.toFixed(2)} m²</td>
              <td style={{ color: NEUTRAL }}>
                {fmtSignedQty(sumB.totalArea - sumA.totalArea)} m²
              </td>
            </tr>
            <tr>
              <td>材料项数</td>
              <td>{sumA.matItemCount}</td>
              <td>{sumB.matItemCount}</td>
              <td style={{ color: NEUTRAL }}>
                {fmtSignedInt(sumB.matItemCount - sumA.matItemCount)}
              </td>
            </tr>
            <tr>
              <td>点位数量</td>
              <td>{sumA.outletCount}</td>
              <td>{sumB.outletCount}</td>
              <td style={{ color: NEUTRAL }}>
                {fmtSignedInt(sumB.outletCount - sumA.outletCount)}
              </td>
            </tr>
            <tr style={{ fontWeight: 600 }}>
              <td>材料总价</td>
              <td style={{ color: cheaper === 'A' ? '#27ae60' : '#2c3e50' }}>
                {fmtMoney(sumA.totalPrice)}
              </td>
              <td style={{ color: cheaper === 'B' ? '#27ae60' : '#2c3e50' }}>
                {fmtMoney(sumB.totalPrice)}
              </td>
              <td style={{ color: diffColor(totalDiff) }}>{fmtSignedMoney(totalDiff)}</td>
            </tr>
            <tr>
              <td>单价最近修改</td>
              <td>{priceFreshness(planA)}</td>
              <td>{priceFreshness(planB)}</td>
              <td style={{ color: '#999' }}>—</td>
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
          总价差构成：单价差合计{' '}
          <strong style={{ color: diffColor(priceEffectSum) }}>{fmtSignedMoney(priceEffectSum)}</strong>
          ＋用量差合计{' '}
          <strong style={{ color: diffColor(qtyEffectSum) }}>{fmtSignedMoney(qtyEffectSum)}</strong>
          ＝总价差 {fmtSignedMoney(totalDiff)}
        </div>
      </div>

      {/* 房间对齐 */}
      <div className="card">
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>房间对照（按房间名对应）</h3>
        {roomCmp.onlyA.length === 0 && roomCmp.onlyB.length === 0 ? (
          <p style={{ color: '#27ae60', fontSize: 14 }}>
            ✓ 两边 {roomCmp.matchedCount} 个房间一一对应，没有落单的房间
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14, marginBottom: 8 }}>
              共同房间 {roomCmp.matchedCount} 个；以下房间只出现在一侧，对应材料用量会全部计为单边差异：
            </p>
            {roomCmp.onlyA.length > 0 && (
              <div style={{ fontSize: 14, marginBottom: 6 }}>
                <span className="badge badge-info">仅方案A有</span>
                {roomCmp.onlyA.map((r) => (
                  <span key={r.id} style={{ marginRight: 12 }}>
                    {r.name}（{polygonArea(r.polygon).toFixed(2)}m²）
                  </span>
                ))}
              </div>
            )}
            {roomCmp.onlyB.length > 0 && (
              <div style={{ fontSize: 14 }}>
                <span className="badge badge-info">仅方案B有</span>
                {roomCmp.onlyB.map((r) => (
                  <span key={r.id} style={{ marginRight: 12 }}>
                    {r.name}（{polygonArea(r.polygon).toFixed(2)}m²）
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 材料逐项对比 */}
      <div className="card">
        <h3 style={{ marginBottom: 4, fontSize: 16 }}>材料逐项对比</h3>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
          按总价差绝对值从大到小排列；差额为正表示方案B更贵。差额构成：单价差 =（B单价 − A单价）× A用量，用量差 =（B用量 − A用量）× B单价，两者相加即总价差；仅一侧有的材料全额计为用量差。
        </p>
        {rows.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '24px 0' }}>
            两个方案都还没有材料用量，请先在平面绘制中添加房间
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>材料（单位）</th>
                <th>A用量</th>
                <th>B用量</th>
                <th>A单价</th>
                <th>B单价</th>
                <th>A小计</th>
                <th>B小计</th>
                <th>总价差（B−A）</th>
                <th>差额构成</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.matId}>
                  <td>
                    {r.name}
                    <span style={{ color: '#999', fontSize: 12 }}>（{r.unit}）</span>
                    {r.onlySide && (
                      <span className="badge badge-info">
                        仅{r.onlySide === 'A' ? 'A' : 'B'}有
                      </span>
                    )}
                    {r.priceMismatch && (
                      <span className="badge badge-warn" title="两边单价不一致，可能有一方是旧价">
                        ⚠ 单价不一致
                      </span>
                    )}
                  </td>
                  <td>{r.onlySide === 'B' ? '—' : r.qtyA.toFixed(2)}</td>
                  <td>{r.onlySide === 'A' ? '—' : r.qtyB.toFixed(2)}</td>
                  <td>{r.priceA === null ? '—' : fmtMoney(r.priceA)}</td>
                  <td>{r.priceB === null ? '—' : fmtMoney(r.priceB)}</td>
                  <td>{r.onlySide === 'B' ? '—' : fmtMoney(r.amountA)}</td>
                  <td>{r.onlySide === 'A' ? '—' : fmtMoney(r.amountB)}</td>
                  <td style={{ color: diffColor(r.diff), fontWeight: 600 }}>
                    {fmtSignedMoney(r.diff)}
                  </td>
                  <td style={{ fontSize: 12, lineHeight: 1.6 }}>
                    {r.onlySide ? (
                      <span style={{ color: diffColor(r.qtyEffect) }}>
                        用量差 {fmtSignedMoney(r.qtyEffect)}（单侧材料）
                      </span>
                    ) : (
                      <>
                        <div style={{ color: diffColor(r.priceEffect) }}>
                          单价差 {fmtSignedMoney(r.priceEffect)}
                        </div>
                        <div style={{ color: diffColor(r.qtyEffect) }}>
                          用量差 {fmtSignedMoney(r.qtyEffect)}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold', background: '#f8f9fa' }}>
                <td colSpan={5}>合计</td>
                <td>{fmtMoney(sumA.totalPrice)}</td>
                <td>{fmtMoney(sumB.totalPrice)}</td>
                <td style={{ color: diffColor(totalDiff) }}>{fmtSignedMoney(totalDiff)}</td>
                <td style={{ fontSize: 12 }}>
                  <div style={{ color: diffColor(priceEffectSum) }}>
                    单价差 {fmtSignedMoney(priceEffectSum)}
                  </div>
                  <div style={{ color: diffColor(qtyEffectSum) }}>
                    用量差 {fmtSignedMoney(qtyEffectSum)}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

function priceFreshness(plan: Plan): string {
  const t = latestPriceUpdate(plan);
  return t ? fmtTime(t) : '未改过（默认价）';
}

function staleNote(row: MatCompareRow, nameA: string, nameB: string): string {
  const fmtT = (t?: number) => (t ? `${fmtTime(t)} 修改` : '默认价，未改过');
  const text = `${row.name}：方案A ${fmtMoney(row.priceA ?? 0)}（${fmtT(row.priceAUpdatedAt)}），方案B ${fmtMoney(row.priceB ?? 0)}（${fmtT(row.priceBUpdatedAt)}）`;

  const aUp = row.priceAUpdatedAt;
  const bUp = row.priceBUpdatedAt;
  let hint = '';
  if (aUp && bUp) {
    if (aUp < bUp) hint = `方案A「${nameA}」的单价较旧，可能未同步`;
    else if (bUp < aUp) hint = `方案B「${nameB}」的单价较旧，可能未同步`;
  } else if (aUp && !bUp) {
    hint = `方案B「${nameB}」仍是默认价，可能未同步`;
  } else if (!aUp && bUp) {
    hint = `方案A「${nameA}」仍是默认价，可能未同步`;
  }
  return hint ? `${text} —— ${hint}` : text;
}
