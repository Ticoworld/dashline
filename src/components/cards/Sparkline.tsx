"use client";
import React from "react";
import { LineChart as ReLineChart, Line, ResponsiveContainer } from "recharts";

export function Sparkline({ data }: { data: Array<{ date: string; value: number }> }) {
  return (
    <div style={{ width: "100%", height: 50 }}>
      <ResponsiveContainer>
        <ReLineChart data={data}>
          <Line type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={2} dot={false} />
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default Sparkline;
