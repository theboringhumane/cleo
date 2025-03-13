import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

interface MetricsChartProps {
  data: any[];
  title: string;
  metrics: string[];
  colors?: Record<string, string>;
}

const defaultColors = {
  waiting: "#2563eb",
  active: "#16a34a",
  completed: "#84cc16",
  failed: "#dc2626",
  delayed: "#ca8a04",
  paused: "#64748b",
};

export function MetricsChart({
  data,
  title,
  metrics,
  colors = defaultColors,
}: MetricsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) =>
                  new Date(value).toLocaleString()
                }
              />
              <Legend />
              {metrics.map((metric) => (
                <Line
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  stroke={colors[metric as keyof typeof colors] || defaultColors[metric as keyof typeof defaultColors]}
                  activeDot={{ r: 8 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
} 