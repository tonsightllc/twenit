"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface NewCustomersDataPoint {
  date: string;
  count: number;
  cumulative: number;
}

interface NewCustomersChartProps {
  data: NewCustomersDataPoint[];
  className?: string;
}

const chartConfig = {
  count: {
    label: "Nuevos clientes",
    color: "hsl(var(--chart-1))",
  },
  cumulative: {
    label: "Total acumulado",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

type TimeRange = "7d" | "30d" | "90d" | "all";

function filterByRange(data: NewCustomersDataPoint[], range: TimeRange) {
  if (range === "all") return data;

  const now = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return data.filter((d) => new Date(d.date) >= cutoff);
}

function formatDateLabel(dateStr: string, dataLength: number) {
  const date = new Date(dateStr + "T00:00:00");
  if (dataLength <= 31) {
    return date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  }
  return date.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

export function NewCustomersChart({ data, className }: NewCustomersChartProps) {
  const [range, setRange] = React.useState<TimeRange>("30d");
  const [metric, setMetric] = React.useState<"count" | "cumulative">("count");

  const filtered = React.useMemo(() => filterByRange(data, range), [data, range]);

  const totalInRange = React.useMemo(
    () => filtered.reduce((sum, d) => sum + d.count, 0),
    [filtered]
  );

  if (!data.length) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Clientes Nuevos</CardTitle>
          <CardDescription>
            No hay datos de clientes todavía. Se mostrarán una vez que sincronices Stripe.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-2 space-y-0 border-b py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 space-y-1">
          <CardTitle className="text-base">Clientes Nuevos</CardTitle>
          <CardDescription>
            {metric === "count"
              ? `${totalInRange} nuevos clientes en el período`
              : "Evolución del total acumulado de clientes"}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={metric} onValueChange={(v) => setMetric(v as "count" | "cumulative")}>
            <SelectTrigger className="w-[160px] text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count">Nuevos por día</SelectItem>
              <SelectItem value="cumulative">Acumulado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
            <SelectTrigger className="w-[130px] text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 días</SelectItem>
              <SelectItem value="30d">30 días</SelectItem>
              <SelectItem value="90d">90 días</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-4 px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <AreaChart data={filtered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-cumulative)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-cumulative)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(v) => formatDateLabel(v, filtered.length)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={40}
              allowDecimals={false}
            />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value + "T00:00:00").toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    });
                  }}
                />
              }
            />
            <Area
              dataKey={metric}
              type="monotone"
              fill={metric === "count" ? "url(#fillCount)" : "url(#fillCumulative)"}
              stroke={`var(--color-${metric})`}
              strokeWidth={2}
              dot={filtered.length <= 31}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
