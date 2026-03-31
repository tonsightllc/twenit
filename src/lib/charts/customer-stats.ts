import type { NewCustomersDataPoint } from "@/components/charts/new-customers-chart";

interface CustomerRow {
  created_at: string;
}

/**
 * Aggregates customer rows into daily data points with cumulative totals.
 * Fills gaps so every day in the range has an entry (count = 0 if no new customers).
 */
export function aggregateNewCustomers(
  customers: CustomerRow[]
): NewCustomersDataPoint[] {
  if (!customers.length) return [];

  const countsByDate = new Map<string, number>();

  for (const c of customers) {
    const date = c.created_at.slice(0, 10); // YYYY-MM-DD
    countsByDate.set(date, (countsByDate.get(date) ?? 0) + 1);
  }

  const sortedDates = [...countsByDate.keys()].sort();
  const startDate = new Date(sortedDates[0] + "T00:00:00");
  const endDate = new Date(sortedDates[sortedDates.length - 1] + "T00:00:00");

  const result: NewCustomersDataPoint[] = [];
  let cumulative = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateStr = current.toISOString().slice(0, 10);
    const count = countsByDate.get(dateStr) ?? 0;
    cumulative += count;

    result.push({ date: dateStr, count, cumulative });

    current.setDate(current.getDate() + 1);
  }

  return result;
}
