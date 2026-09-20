import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { calcMaterials } from '../utils/materialCalc';
import type { Plan } from '../types';

export default function PlanList() {
  const { plans, addPlan, deletePlan } = useStore();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleAdd = () => {
    if (!name.trim()) return;
    addPlan(name.trim());
    setName('');
  };

  // 已选方案可能已被删除，实时过滤
  const validSelected = selected.filter((id) => plans.some((p) => p.id === id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const cur = prev.filter((x) => plans.some((p) => p.id === x));
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      // 最多两个，再勾替换最早所选
      if (cur.length >= 2) return [cur[1], id];
      return [...cur, id];
    });
  };

  const handleCompare = () => {
    if (validSelected.length !== 2) return;
    navigate(`/compare/${validSelected[0]}/${validSelected[1]}`);
  };

  const budgetOf = (plan: Plan) =>
    calcMaterials(plan.rooms, plan.openings, plan.materials).reduce(
      (s, r) => s + r.totalPrice,
      0
    );

  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? '';

  return (
    <div>
      <h2 className="page-title">方案列表</h2>
      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input
            type="text"
            placeholder="新方案名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="btn btn-primary" onClick={handleAdd}>
            创建方案
          </button>
        </div>
      </div>

      {plans.length >= 2 && (
        <div className="card">
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <span style={{ color: '#666' }}>
              在下方表格勾选两个方案做比选（已选 {validSelected.length}/2）
              {validSelected.length === 2 &&
                `：${planName(validSelected[0])} vs ${planName(validSelected[1])}，再勾其他方案将替换最早所选`}
            </span>
            <button
              className="btn btn-primary"
              disabled={validSelected.length !== 2}
              onClick={handleCompare}
            >
              开始比选
            </button>
          </div>
        </div>
      )}

      <div className="card">
        {plans.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
            暂无方案，请创建一个新方案开始规划
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 50 }}>比选</th>
                <th>方案名称</th>
                <th>房间数</th>
                <th>预算总价</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={validSelected.includes(plan.id)}
                      onChange={() => toggleSelect(plan.id)}
                    />
                  </td>
                  <td>
                    <Link to={`/plan/${plan.id}`}>{plan.name}</Link>
                  </td>
                  <td>{plan.rooms.length}</td>
                  <td>¥{budgetOf(plan).toFixed(2)}</td>
                  <td>{new Date(plan.createdAt).toLocaleString()}</td>
                  <td>
                    <Link className="btn btn-secondary" to={`/plan/${plan.id}`}>
                      编辑
                    </Link>
                    <Link className="btn btn-secondary" to={`/plan/${plan.id}/bom`}>
                      材料
                    </Link>
                    <button
                      className="btn btn-danger"
                      onClick={() => deletePlan(plan.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
