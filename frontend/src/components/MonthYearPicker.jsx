import { MONTHS } from "@/lib/utils-app";

/**
 * Shared Month/Year selector dropdown pair.
 * Props: value = { year, month }, onChange, fromYear?, toYear?
 */
export default function MonthYearPicker({ value, onChange, fromYear, toYear, compact }) {
  const now = new Date();
  const f = fromYear || (now.getFullYear() - 2);
  const t = toYear || (now.getFullYear() + 1);
  const years = [];
  for (let y = t; y >= f; y--) years.push(y);

  return (
    <div className={`inline-flex items-center gap-1.5 ${compact ? "" : "bg-white rounded-xl border border-slate-200 p-1 shadow-sm"}`}>
      <select
        value={value.month}
        onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
        className={`bg-transparent px-2.5 py-1.5 text-sm font-bold rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#4DA3FF]/30 ${compact ? "border border-slate-200" : ""}`}
        data-testid="month-picker"
      >
        {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
      </select>
      <select
        value={value.year}
        onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
        className={`bg-transparent px-2.5 py-1.5 text-sm font-bold rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#4DA3FF]/30 ${compact ? "border border-slate-200" : ""}`}
        data-testid="year-picker"
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
