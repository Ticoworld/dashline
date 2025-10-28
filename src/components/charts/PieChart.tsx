"use client";
import React from "react";
import { ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip, Legend } from "recharts";

export function PieChart({ data, colors }: { data: Array<{ name: string; value: number }>; colors?: string[] }) {
  const palette = colors ?? ["#6366F1", "#10B981", "#F59E0B", "#EF4444"];
  const total = data.reduce((s, d) => s + (d.value ?? 0), 0);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [outerRadius, setOuterRadius] = React.useState<number>(100);
  const [innerRadius, setInnerRadius] = React.useState<number>(60);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function CustomTooltip({ active, payload }: any) {
    if (!active || !payload || payload.length === 0) return null;
    const p = payload[0];
    const name = p.name ?? p.payload?.name;
    const value = p.value ?? p.payload?.value ?? 0;
    const percent = total > 0 ? ((value / total) * 100).toFixed(2) : "0.00";
    return (
      <div style={{ background: 'rgba(10,10,10,0.95)', border: '1px solid #151515', borderRadius: 8, padding: 8, color: '#fff' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{String(name)}</div>
        <div style={{ fontSize: 12, color: '#d1d5db' }}>{String(value)} • {percent}%</div>
      </div>
    );
  }

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => {
      const h = node.clientHeight;
      const computedOuter = Math.max(60, Math.min(140, Math.floor(h * 0.45)));
      const computedInner = Math.max(30, Math.floor(computedOuter * 0.55));
      setOuterRadius(computedOuter);
      setInnerRadius(computedInner);
    });
    obs.observe(node);
    // initial set
    const initH = node.clientHeight;
    const initOuter = Math.max(60, Math.min(140, Math.floor(initH * 0.45)));
    setOuterRadius(initOuter);
    setInnerRadius(Math.max(30, Math.floor(initOuter * 0.55)));
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: '100%' }} className="min-h-[260px]">
      <ResponsiveContainer>
        <RePieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius={outerRadius} fill="#8884d8">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="middle"
            align="right"
            layout="vertical"
            wrapperStyle={{ color: "#9CA3AF" }}
            iconType="circle"
            formatter={(value) => (
              <span style={{ color: "#9CA3AF", fontSize: 12 }}>{String(value)}</span>
            )}
          />
        </RePieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PieChart;
