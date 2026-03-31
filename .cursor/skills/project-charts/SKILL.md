---
name: project-charts
description: >-
  Guidelines for creating charts and data visualizations in this project.
  Use when adding a new chart, graph, visualization, or when the user asks
  about metrics, analytics, dashboards, or data trends.
---

# Charts en este proyecto

Usamos **Recharts v3** con un componente base shadcn en `src/components/ui/chart.tsx`.
Los colores de charts están en `globals.css` como `--chart-1` a `--chart-5` (light + dark).

## Arquitectura en 3 capas

### 1. Componente base (`src/components/ui/chart.tsx`)

Ya existe y NO debe modificarse salvo para agregar funcionalidad genérica.

Exports disponibles:

| Export | Uso |
|--------|-----|
| `ChartContainer` | Wrapper responsivo. Recibe `config: ChartConfig` y aplica colores del tema |
| `ChartTooltip` | Re-export de `Tooltip` de Recharts |
| `ChartTooltipContent` | Tooltip temático con indicadores dot/line/dashed |
| `ChartLegend` | Re-export de `Legend` de Recharts |
| `ChartLegendContent` | Leyenda temática |
| `ChartConfig` | Tipo para declarar series (label, color, icon) |

### 2. Componentes de chart específicos (`src/components/charts/`)

Cada gráfico es un componente `"use client"` que recibe data tipada como props.

### 3. Funciones de agregación (`src/lib/charts/`)

Funciones puras server-side que transforman filas de Supabase en data points.

## Crear un nuevo chart

### Paso 1: Función de agregación

Crear en `src/lib/charts/` una función pura que reciba filas de DB y devuelva un array tipado.

```typescript
// src/lib/charts/my-stats.ts
export interface MyDataPoint {
  date: string;  // YYYY-MM-DD para series temporales
  value: number;
}

export function aggregateMyData(rows: { created_at: string }[]): MyDataPoint[] {
  // Agrupar por fecha, rellenar gaps, calcular acumulados si aplica
}
```

Reglas para agregaciones:
- Rellenar gaps de fechas (días sin datos = 0) para que la línea sea continua
- Usar `slice(0, 10)` sobre ISO strings para extraer `YYYY-MM-DD`
- Calcular acumulados con un simple `cumulative += count` en el loop
- Exportar la interface del data point desde este archivo

### Paso 2: Componente de chart

Crear en `src/components/charts/`. Ejemplo de referencia: `new-customers-chart.tsx`.

```typescript
// src/components/charts/my-chart.tsx
"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const chartConfig = {
  value: {
    label: "Mi métrica",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function MyChart({ data }: { data: MyDataPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mi Gráfico</CardTitle>
        <CardDescription>Descripción del período</CardDescription>
      </CardHeader>
      <CardContent className="pt-4 px-2 sm:px-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <AreaChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area dataKey="value" type="monotone" fill="url(#fill)" stroke="var(--color-value)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

### Paso 3: Integrar en la página (server component)

```typescript
// En el server component de la página
import { MyChart } from "@/components/charts/my-chart";
import { aggregateMyData } from "@/lib/charts/my-stats";

// Dentro del componente async:
const { data } = await supabase.from("tabla").select("created_at").eq("org_id", orgId);
const chartData = aggregateMyData(data ?? []);
// En el JSX: <MyChart data={chartData} />
```

## Convenciones obligatorias

### Colores

Usar siempre CSS variables, nunca colores hardcodeados:

```typescript
const chartConfig = {
  series1: { label: "Serie 1", color: "hsl(var(--chart-1))" },
  series2: { label: "Serie 2", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;
```

Variables disponibles: `--chart-1` a `--chart-5` (con variantes light/dark automáticas).

### Gradientes para Area charts

Definir gradientes en `<defs>` usando `var(--color-{key})`:

```tsx
<defs>
  <linearGradient id="fillSeries1" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="var(--color-series1)" stopOpacity={0.3} />
    <stop offset="95%" stopColor="var(--color-series1)" stopOpacity={0.05} />
  </linearGradient>
</defs>
```

### Ejes

- `tickLine={false}` y `axisLine={false}` siempre
- `allowDecimals={false}` en YAxis para conteos
- `minTickGap={32}` en XAxis para evitar solapamiento

### Tooltips

- Usar `ChartTooltipContent` del componente base
- Formatear fechas en español: `toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })`

### Interactividad

Para charts interactivos, agregar controles con los `Select` de shadcn en el `CardHeader`:
- Selector de rango temporal (7d / 30d / 90d / todo)
- Selector de métrica si el chart soporta múltiples vistas
- Usar `React.useMemo` para filtrar/transformar data según selección

### Responsive

- Usar `className="aspect-auto h-[280px] w-full"` en `ChartContainer`
- Padding del `CardContent`: `className="pt-4 px-2 sm:px-6"`
- Controles del header: flex-col en mobile, flex-row en desktop

### Estado vacío

Siempre manejar el caso sin datos con un mensaje amigable dentro de un `Card`.

## Tipos de chart recomendados por caso de uso

| Caso | Tipo de Recharts | Cuándo |
|------|-----------------|--------|
| Evolución temporal | `AreaChart` con gradiente | Clientes nuevos, revenue, tickets |
| Comparación de categorías | `BarChart` | Status de suscripciones, distribución |
| Composición / proporción | `PieChart` / `RadialBarChart` | Breakdown por plan, churn reasons |
| Correlación de dos métricas | `LineChart` multi-serie | Revenue vs churn, nuevos vs cancelados |

## Ejemplo de referencia completo

Ver `src/components/charts/new-customers-chart.tsx` como modelo canónico.
Incluye: selector de rango, toggle de métrica, gradientes, tooltip con fecha formateada, estado vacío.
