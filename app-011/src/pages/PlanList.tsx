import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { calcMaterials } from '../utils/materialCalc';

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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      // 最多勾两个，再勾替换最早的选择
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  // 已删除的方案自动从勾选里剔除
  const selectedPlans = selected
    .map((sid) => plans.find((p) => p.id === sid))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const goCompare = () => {
    if (selectedPlans.length !== 2) return;
    navigate(`/compare?a=${selectedPlans[0].id}&b=${selectedPlans[1].id}`);
  };

  return (
    <div>
      <h2 className="page-title">方案列表</h2>
      <div className="card">
        <div className="toolbar">
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

      {selectedPlans.length > 0 && (
        <div className="card compare-bar">
          <span style={{ color: '#666' }}>比选（勾两个方案）：</span>
          <span>
            方案A：<strong>{selectedPlans[0].name}</strong>
          </span>
          <span>
            方案B：
            {selectedPlans[1] ? (
              <strong>{selectedPlans[1].name}</strong>
            ) : (
              <span style={{ color: '#999' }}>再勾选一个</span>
            )}
          </span>
          <button
            className="btn btn-primary"
            disabled={selectedPlans.length !== 2}
            onClick={goCompare}
          >
            开始比选
          </button>
          <button className="btn btn-secondary" onClick={() => setSelected([])}>
            清除勾选
          </button>
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
                <th style={{ width: 40 }}>比选</th>
                <th>方案名称</th>
                <th>房间数</th>
                <th>点位数</th>
                <th>预算总价</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const totalPrice = calcMaterials(
                  plan.rooms,
                  plan.openings,
                  plan.materials
                ).reduce((s, r) => s + r.totalPrice, 0);
                return (
                  <tr key={plan.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.includes(plan.id)}
                        onChange={() => toggleSelect(plan.id)}
                        title="勾选两个方案后可比选，超出会替换最早的选择"
                      />
                    </td>
                    <td>
                      <Link to={`/plan/${plan.id}`}>{plan.name}</Link>
                    </td>
                    <td>{plan.rooms.length}</td>
                    <td>{plan.outlets.length}</td>
                    <td style={{ color: '#e74c3c' }}>¥{totalPrice.toFixed(2)}</td>
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
