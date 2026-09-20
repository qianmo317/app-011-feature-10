import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import { comparePlans } from '../utils/compare';

function fmtMoney(v: number): string {
  return `¥${v.toFixed(2)}`;
}

function fmtSignedMoney(v: number): string {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}¥${Math.abs(v).toFixed(2)}`;
}

function fmtSignedNum(v: number, digits = 2): string {
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sign}${Math.abs(v).toFixed(digits)}`;
}

/** 差额颜色：正=B更贵(红)，负=B更省(绿) */
function moneyDiffClass(v: number): string {
  if (v > 0.005) return 'diff-pos';
  if (v < -0.005) return 'diff-neg';
  return 'diff-zero';
}

function fmtTime(t: number): string {
  return new Date(t).toLocaleString();
}

export default function Compare() {
  const { aId, bId } = useParams<{ aId: string; bId: string }>();
  const { getPlan } = useStore();
  const planA = getPlan(aId || '');
  const planB = getPlan(bId || '');

  if (!planA || !planB) {
    return (
      <div className="card">
        方案不存在或已删除。<Link to="/">返回方案列表</Link>
      </div>
    );
  }

  if (planA.id === planB.id) {
    return (
      <div className="card">
        请在方案列表勾选两个不同的方案进行比选。<Link to="/">返回方案列表</Link>
      </div>
    );
  }

  const cmp = comparePlans(planA, planB);
  const totalDiff = cmp.totalB - cmp.totalA;
  const priceMismatchRows = cmp.rows.filter((r) => r.priceA !== r.priceB);
  const hasPriceEdits = cmp.lastPriceEditA !== null || cmp.lastPriceEditB !== null;
  const showPriceWarning = hasPriceEdits || priceMismatchRows.length > 0;

  const priceStatus = (lastEdit: number | null, createdAt: number) =>
    lastEdit
      ? `单价最后手动修改于 ${fmtTime(lastEdit)}`
      : `无改价记录，使用方案创建时保存的单价（创建于 ${fmtTime(createdAt)}）`;

  return (
    <div>
      <h2 className="page-title">方案比选</h2>

      <div className="toolbar no-print">
        <Link className="btn btn-secondary" to="/">
          ← 返回方案列表
        </Link>
        <Link className="btn btn-secondary" to={`/plan/${planA.id}/bom`}>
          「{planA.name}」材料清单
        </Link>
        <Link className="btn btn-secondary" to={`/plan/${planB.id}/bom`}>
          「{planB.name}」材料清单
        </Link>
      </div>

      {/* 单价时效提醒：改过价或两边单价不一致时醒目标出，防止拿旧结论下单 */}
      {showPriceWarning ? (
        <div className="alert alert-warning">
          <strong>⚠ 单价时效提醒</strong>
          <div>
            「{planA.name}」：{priceStatus(cmp.lastPriceEditA, planA.createdAt)}
          </div>
          <div>
            「{planB.name}」：{priceStatus(cmp.lastPriceEditB, planB.createdAt)}
          </div>
          {priceMismatchRows.length > 0 && (
            <div>
              以下材料两方案单价不一致：
              {priceMismatchRows.map((r) => (
                <span key={r.matId} style={{ marginRight: 12, whiteSpace: 'nowrap' }}>
                  {r.name}（A {fmtMoney(r.priceA)} / B {fmtMoney(r.priceB)}）
                </span>
              ))}
            </div>
          )}
          <div>
            本页按两方案<strong>当前保存的单价</strong>实时计算；单价一旦被修改，此前记下的比较结论即过时，
            下单前请以本页最新结果为准。
          </div>
        </div>
      ) : (
        <div className="alert alert-info">
          两方案材料单价一致，且均无改价记录（使用创建时保存的单价）。
          若方案创建已久，下单前请先到材料清单页核实单价是否仍是最新行情。
        </div>
      )}

      {/* 总结论 */}
      <div className="verdict">
        {Math.abs(totalDiff) < 0.005 ? (
          <span>
            结论：两方案材料总价相同，均为 <strong>{fmtMoney(cmp.totalA)}</strong>。
          </span>
        ) : (
          <span>
            结论：<strong>{totalDiff > 0 ? `「${planA.name}」更省钱` : `「${planB.name}」更省钱`}</strong>
            ，材料总价低 {fmtMoney(Math.abs(totalDiff))}
            （总差额 {fmtSignedMoney(totalDiff)} = 用量差 {fmtSignedMoney(cmp.usageDiffTotal)} + 单价差{' '}
            {fmtSignedMoney(cmp.priceDiffTotal)}）。
          </span>
        )}
      </div>

      {/* 汇总对比 */}
      <div className="card">
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>汇总对比</h3>
        <table>
          <thead>
            <tr>
              <th>指标</th>
              <th>A：{planA.name}</th>
              <th>B：{planB.name}</th>
              <th>差值（B−A）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>总面积</td>
              <td>{cmp.areaA.toFixed(2)} m²</td>
              <td>{cmp.areaB.toFixed(2)} m²</td>
              <td>{fmtSignedNum(cmp.areaB - cmp.areaA)} m²</td>
            </tr>
            <tr>
              <td>材料项数</td>
              <td>{cmp.matCountA}</td>
              <td>{cmp.matCountB}</td>
              <td>{fmtSignedNum(cmp.matCountB - cmp.matCountA, 0)}</td>
            </tr>
            <tr>
              <td>点位数量</td>
              <td>{cmp.outletCountA}</td>
              <td>{cmp.outletCountB}</td>
              <td>{fmtSignedNum(cmp.outletCountB - cmp.outletCountA, 0)}</td>
            </tr>
            <tr>
              <td>材料总价</td>
              <td>{fmtMoney(cmp.totalA)}</td>
              <td>{fmtMoney(cmp.totalB)}</td>
              <td className={moneyDiffClass(totalDiff)}>{fmtSignedMoney(totalDiff)}</td>
            </tr>
          </tbody>
        </table>
        <div className="compare-note">差值 = 方案B − 方案A；总价行红色表示 B 更贵，绿色表示 B 更省。</div>
      </div>

      {/* 材料逐项对比 */}
      <div className="card">
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>材料逐项对比（差得最多的排最前）</h3>
        {cmp.rows.length === 0 ? (
          <p style={{ color: '#999' }}>两方案均暂无材料用量，请先在平面绘制中添加房间。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th rowSpan={2}>材料</th>
                <th rowSpan={2}>单位</th>
                <th colSpan={3}>A：{planA.name}</th>
                <th colSpan={3}>B：{planB.name}</th>
                <th colSpan={3}>差额（B−A）</th>
              </tr>
              <tr>
                <th>用量</th>
                <th>单价</th>
                <th>小计</th>
                <th>用量</th>
                <th>单价</th>
                <th>小计</th>
                <th>总价差</th>
                <th>用量差</th>
                <th>单价差</th>
              </tr>
            </thead>
            <tbody>
              {cmp.rows.map((r) => (
                <tr key={r.matId}>
                  <td>
                    {r.name}
                    {r.onlyIn && <span className="badge badge-info">仅{r.onlyIn}侧使用</span>}
                    {r.priceA !== r.priceB && (
                      <span
                        className="badge badge-warn"
                        title={`A ${fmtMoney(r.priceA)} / B ${fmtMoney(r.priceB)}`}
                      >
                        单价不同
                      </span>
                    )}
                    {(r.editedAtA || r.editedAtB) && (
                      <span
                        className="badge badge-warn"
                        title={`改价时间：${r.editedAtA ? `A ${fmtTime(r.editedAtA)}` : ''}${
                          r.editedAtA && r.editedAtB ? '；' : ''
                        }${r.editedAtB ? `B ${fmtTime(r.editedAtB)}` : ''}`}
                      >
                        改过价
                      </span>
                    )}
                  </td>
                  <td>{r.unit}</td>
                  <td className={r.qtyA > r.qtyB ? 'cell-max' : ''}>
                    {r.onlyIn === 'B' ? '—' : r.qtyA.toFixed(2)}
                  </td>
                  <td>{r.onlyIn === 'B' ? '—' : fmtMoney(r.priceA)}</td>
                  <td>{r.onlyIn === 'B' ? '—' : fmtMoney(r.totalA)}</td>
                  <td className={r.qtyB > r.qtyA ? 'cell-max' : ''}>
                    {r.onlyIn === 'A' ? '—' : r.qtyB.toFixed(2)}
                  </td>
                  <td>{r.onlyIn === 'A' ? '—' : fmtMoney(r.priceB)}</td>
                  <td>{r.onlyIn === 'A' ? '—' : fmtMoney(r.totalB)}</td>
                  <td className={moneyDiffClass(r.totalDiff)}>{fmtSignedMoney(r.totalDiff)}</td>
                  <td className={moneyDiffClass(r.usageDiff)}>{fmtSignedMoney(r.usageDiff)}</td>
                  <td className={moneyDiffClass(r.priceDiff)}>{fmtSignedMoney(r.priceDiff)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 'bold', background: '#f8f9fa' }}>
                <td colSpan={4}>合计</td>
                <td>{fmtMoney(cmp.totalA)}</td>
                <td colSpan={2}></td>
                <td>{fmtMoney(cmp.totalB)}</td>
                <td className={moneyDiffClass(totalDiff)}>{fmtSignedMoney(totalDiff)}</td>
                <td className={moneyDiffClass(cmp.usageDiffTotal)}>
                  {fmtSignedMoney(cmp.usageDiffTotal)}
                </td>
                <td className={moneyDiffClass(cmp.priceDiffTotal)}>
                  {fmtSignedMoney(cmp.priceDiffTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
        <div className="compare-note">
          用量差 =（B用量 − A用量）× A单价；单价差 =（B单价 − A单价）× B用量；两者之和即总价差。
          用量差为正是 B 多用料多花的钱，单价差为正是 B 单价更贵多花的钱；用量较多一侧以加粗标出。
        </div>
      </div>

      {/* 房间对应情况 */}
      <div className="card">
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>房间对应情况</h3>
        {cmp.roomsOnlyA.length === 0 && cmp.roomsOnlyB.length === 0 ? (
          <p style={{ color: '#27ae60' }}>
            ✓ 两方案房间一一对应（共 {cmp.roomsMatched.length} 个），没有只出现在单侧的房间。
          </p>
        ) : (
          <div className="alert alert-warning" style={{ marginBottom: 12 }}>
            <strong>⚠ 两边房间对不齐</strong>
            {cmp.roomsOnlyA.length > 0 && (
              <div>
                仅「{planA.name}」有：
                {cmp.roomsOnlyA.map((r) => `${r.name}（${r.area.toFixed(2)}m²）`).join('、')}
              </div>
            )}
            {cmp.roomsOnlyB.length > 0 && (
              <div>
                仅「{planB.name}」有：
                {cmp.roomsOnlyB.map((r) => `${r.name}（${r.area.toFixed(2)}m²）`).join('、')}
              </div>
            )}
            <div>单侧房间的用料只计入对应方案，解读材料差额时请注意。</div>
          </div>
        )}
        {cmp.roomsMatched.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>房间（按名称匹配）</th>
                <th>A 面积</th>
                <th>B 面积</th>
                <th>面积差（B−A）</th>
              </tr>
            </thead>
            <tbody>
              {cmp.roomsMatched.map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{r.areaA.toFixed(2)} m²</td>
                  <td>{r.areaB.toFixed(2)} m²</td>
                  <td>{fmtSignedNum(r.areaB - r.areaA)} m²</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
