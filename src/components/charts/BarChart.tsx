"use client";
// Claude P4: Themed BarChart - reduced gridlines, padded area, tooltip styling
import React from "react";
import { ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

type DataPoint = Record<string, string | number | null>;

export function BarChart<T extends DataPoint>({
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
        <ReBarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 6 }}>
          <CartesianGrid vertical={false} stroke="#151515" strokeOpacity={0.25} />
          <XAxis dataKey={xKey} tick={{ fill: "#9CA3AF", fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip wrapperStyle={{ background: "rgba(10,10,10,0.95)", border: "1px solid #151515", borderRadius: 8 }} contentStyle={{ background: "transparent", border: "none" }} />
          <Bar dataKey={yKey} fill={color} radius={[4,4,0,0]} />
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BarChart;
