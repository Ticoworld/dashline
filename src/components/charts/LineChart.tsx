"use client";
// Claude P4: Themed LineChart - indigo gradient, reduced gridlines, padded area, styled tooltip
import React from "react";
import { ResponsiveContainer, LineChart as ReLineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

type DataPoint = Record<string, string | number | null>;

export function LineChart<T extends DataPoint>({
  data,
  xKey = "date",
  yKey = "value",
  color = "#6366F1",
}: {
  data: T[];
  xKey?: keyof T & string;
  yKey?: keyof T & string;
  color?: string;
}): React.ReactElement {
  return (
    <div style={{ width: "100%", minHeight: 260 }}>
      <ResponsiveContainer>
        <ReLineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 6 }}>
          <defs>
            <linearGradient id="dl_grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#151515" strokeOpacity={0.3} />
          <XAxis dataKey={xKey} tick={{ fill: "#9CA3AF", fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            wrapperStyle={{ background: "rgba(10,10,10,0.95)", border: "1px solid #151515", borderRadius: 8 }}
            contentStyle={{ background: "transparent", border: "none" }}
            itemStyle={{ color: "#fff" }}
            labelStyle={{ color: "#9CA3AF" }}
          />
          <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={false} fill="url(#dl_grad)" isAnimationActive={true} animationDuration={700} />
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default LineChart;
