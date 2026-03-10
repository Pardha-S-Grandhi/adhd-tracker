`use client`;

import React, { useEffect, useMemo, useState } from "react";
import {
  Flame,
  Droplets,
  Moon,
  BookOpen,
  Dumbbell,
  Weight,
  Download,
  Upload,
  Smartphone,
  Calendar as CalendarIcon,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type LogSection = "intention" | "reality";

type DayMetrics = {
  notes: string;
  calories: number | null;
  waterTargetMl: number;
  waterConsumedMl: number;
  sleepHours: number | null;
  studyHours: number | null;
  exerciseMinutes: number | null;
  weightKg: number | null;
};

type DayEntry = {
  date: string; // ISO yyyy-mm-dd
  dayIndex: number; // 1-14
  phase: "FOCUS" | "CHEAT";
  intention: DayMetrics;
  reality: DayMetrics;
};

type UserData = {
  version: 1;
  createdAt: string;
  lastUpdated: string;
  settings: {
    cycleStartDate: string; // ISO date for Day 1 of OMAD cycle
    defaultWaterTargetMl: number;
  };
  days: DayEntry[];
};

type MetricKey =
  | "calories"
  | "waterConsumedMl"
  | "sleepHours"
  | "studyHours"
  | "exerciseMinutes"
  | "weightKg";

type GraphMetric = {
  key: MetricKey;
  label: string;
  unit: string;
};

const STORAGE_KEY = "adhd_life_os_user_data_v1";

const GRAPH_METRICS: GraphMetric[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "studyHours", label: "Study", unit: "h" },
  { key: "sleepHours", label: "Sleep", unit: "h" },
  { key: "exerciseMinutes", label: "Exercise", unit: "min" },
  { key: "waterConsumedMl", label: "Water", unit: "ml" },
  { key: "weightKg", label: "Weight", unit: "kg" },
];

function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function addDays(dateISO: string, delta: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCycleInfo(cycleStart: string, dateISO: string): {
  dayIndex: number;
  phase: "FOCUS" | "CHEAT";
} {
  const start = new Date(cycleStart + "T00:00:00");
  const current = new Date(dateISO + "T00:00:00");
  const diffMs = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const normalized = ((diffDays % 14) + 14) % 14; // 0-13
  const dayIndex = normalized + 1;
  const phase: "FOCUS" | "CHEAT" = dayIndex === 14 ? "CHEAT" : "FOCUS";
  return { dayIndex, phase };
}

function createEmptyMetrics(defaultWaterTargetMl: number): DayMetrics {
  return {
    notes: "",
    calories: null,
    waterTargetMl: defaultWaterTargetMl,
    waterConsumedMl: 0,
    sleepHours: null,
    studyHours: null,
    exerciseMinutes: null,
    weightKg: null,
  };
}

function createInitialUserData(): UserData {
  const today = getTodayISO();
  const defaultWaterTargetMl = 2500;
  const { dayIndex, phase } = getCycleInfo(today, today);
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    settings: {
      cycleStartDate: today,
      defaultWaterTargetMl,
    },
    days: [
      {
        date: today,
        dayIndex,
        phase,
        intention: createEmptyMetrics(defaultWaterTargetMl),
        reality: createEmptyMetrics(defaultWaterTargetMl),
      },
    ],
  };
}

function normalizeUserData(data: any): UserData {
  try {
    if (!data || typeof data !== "object") return createInitialUserData();
    if (data.version !== 1) return createInitialUserData();
    if (!Array.isArray(data.days)) return createInitialUserData();
    const safe: UserData = {
      ...createInitialUserData(),
      ...data,
      days: data.days.map((d: any) => ({
        ...d,
        intention: {
          ...createEmptyMetrics(data.settings?.defaultWaterTargetMl ?? 2500),
          ...(d.intention || {}),
        },
        reality: {
          ...createEmptyMetrics(data.settings?.defaultWaterTargetMl ?? 2500),
          ...(d.reality || {}),
        },
      })),
    };
    return safe;
  } catch {
    return createInitialUserData();
  }
}

function getDayEntry(userData: UserData, dateISO: string): DayEntry {
  const existing = userData.days.find((d) => d.date === dateISO);
  const { cycleStartDate, defaultWaterTargetMl } = userData.settings;
  const cycleInfo = getCycleInfo(cycleStartDate, dateISO);
  if (existing) {
    return {
      ...existing,
      dayIndex: cycleInfo.dayIndex,
      phase: cycleInfo.phase,
    };
  }
  return {
    date: dateISO,
    dayIndex: cycleInfo.dayIndex,
    phase: cycleInfo.phase,
    intention: createEmptyMetrics(defaultWaterTargetMl),
    reality: createEmptyMetrics(defaultWaterTargetMl),
  };
}

function upsertDay(userData: UserData, entry: DayEntry): UserData {
  const others = userData.days.filter((d) => d.date !== entry.date);
  const updated: UserData = {
    ...userData,
    lastUpdated: new Date().toISOString(),
    days: [...others, entry].sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
  return updated;
}

function useUserData() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [ipHint, setIpHint] = useState<string>("");
  const [graphMetricKey, setGraphMetricKey] = useState<MetricKey>("studyHours");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const initial =
      raw && raw.trim().length > 0
        ? normalizeUserData(JSON.parse(raw))
        : createInitialUserData();
    setUserData(initial);
    setSelectedDate(getTodayISO());

    const host = window.location.hostname || "";
    setIpHint(host);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userData) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  }, [userData]);

  const currentDay: DayEntry | null = useMemo(() => {
    if (!userData || !selectedDate) return null;
    return getDayEntry(userData, selectedDate);
  }, [userData, selectedDate]);

  const updateDayMetrics = (
    section: LogSection,
    field: keyof DayMetrics,
    value: string | number | null
  ) => {
    if (!userData || !currentDay) return;
    const updatedDay: DayEntry = {
      ...currentDay,
      [section]: {
        ...currentDay[section],
        [field]: value,
      },
    };
    setUserData((prev) => (prev ? upsertDay(prev, updatedDay) : prev));
  };

  const offsetDay = (delta: number) => {
    setSelectedDate((prev) => {
      const base = prev || getTodayISO();
      return addDays(base, delta);
    });
  };

  const goToToday = () => setSelectedDate(getTodayISO());

  const setCycleStartToSelected = () => {
    if (!userData || !selectedDate) return;
    const updated: UserData = {
      ...userData,
      settings: {
        ...userData.settings,
        cycleStartDate: selectedDate,
      },
      lastUpdated: new Date().toISOString(),
    };
    setUserData(updated);
  };

  const exportData = () => {
    if (!userData || typeof window === "undefined") return;
    const blob = new Blob([JSON.stringify(userData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = getTodayISO();
    a.href = url;
    a.download = `adhd-life-os-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const normalized = normalizeUserData(parsed);
      setUserData(normalized);
      if (!selectedDate) {
        setSelectedDate(getTodayISO());
      }
    } catch (e) {
      console.error("Invalid JSON import", e);
      if (typeof window !== "undefined") {
        window.alert("Import failed. File is not valid ADHD Life OS JSON.");
      }
    }
  };

  return {
    userData,
    currentDay,
    selectedDate,
    ipHint,
    graphMetricKey,
    setGraphMetricKey,
    updateDayMetrics,
    offsetDay,
    goToToday,
    setCycleStartToSelected,
    exportData,
    importData,
  };
}

type LogCardProps = {
  label: string;
  accent: "emerald" | "sky";
  metrics: DayMetrics;
  onChange: (field: keyof DayMetrics, value: string | number | null) => void;
};

function LogCard({ label, accent, metrics, onChange }: LogCardProps) {
  const accentColor =
    accent === "emerald"
      ? "border-emerald-400 bg-emerald-500/10"
      : "border-sky-400 bg-sky-500/10";

  const handleNumberChange =
    (field: keyof DayMetrics) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "") {
        onChange(field, null);
      } else {
        const num = Number(raw);
        onChange(field, Number.isNaN(num) ? null : num);
      }
    };

  const bumpNumber = (
    field: keyof DayMetrics,
    delta: number,
    min: number | null = null
  ) => {
    const current = metrics[field] as number | null;
    const next = (current ?? 0) + delta;
    const clamped = min != null ? Math.max(min, next) : next;
    onChange(field, clamped);
  };

  const bumpWaterConsumed = (delta: number) => {
    const current = metrics.waterConsumedMl ?? 0;
    const target = metrics.waterTargetMl || 0;
    const next = Math.max(0, current + delta);
    const capped = target > 0 ? Math.min(next, target) : next;
    onChange("waterConsumedMl", capped);
  };

  const waterRemaining = Math.max(
    0,
    (metrics.waterTargetMl || 0) - (metrics.waterConsumedMl || 0)
  );

  return (
    <section
      className={`rounded-2xl border ${accentColor} p-4 space-y-4 shadow-lg`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              accent === "emerald"
                ? "bg-emerald-500 text-slate-950"
                : "bg-sky-500 text-slate-950"
            }`}
          >
            {label[0]}
          </span>
          <h2 className="text-lg font-semibold tracking-tight">{label}</h2>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1">
            <Flame className="h-4 w-4 text-amber-400" />
            OMAD Calories
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 text-lg font-semibold text-slate-50 outline-none ring-0 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/40"
              placeholder="0"
              value={metrics.calories ?? ""}
              onChange={handleNumberChange("calories")}
            />
            <span className="text-xs font-semibold text-slate-400">kcal</span>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wide">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-sky-400" />
              <span>Water</span>
            </div>
            <span className="text-[10px] text-slate-400">
              Subtractive tracking
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="space-y-1">
              <div className="text-[11px] text-slate-400">Target</div>
              <input
                type="number"
                inputMode="numeric"
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-sm font-semibold text-slate-50 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                value={metrics.waterTargetMl}
                onChange={(e) =>
                  onChange("waterTargetMl", Number(e.target.value || 0))
                }
              />
              <div className="text-[10px] text-slate-500">ml</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-slate-400">Drank</div>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => bumpWaterConsumed(-250)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-lg leading-none text-slate-300 active:scale-95"
                >
                  -
                </button>
                <div className="min-w-[3.5rem] text-sm font-semibold">
                  {metrics.waterConsumedMl ?? 0}
                </div>
                <button
                  type="button"
                  onClick={() => bumpWaterConsumed(250)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-sky-500 text-lg leading-none text-slate-950 active:scale-95"
                >
                  +
                </button>
              </div>
              <div className="text-[10px] text-slate-500">ml</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-slate-400">Remaining</div>
              <div className="h-9 rounded-lg bg-slate-950/70 px-2 text-sm font-semibold text-sky-400 flex items-center justify-center">
                {waterRemaining}
              </div>
              <div className="text-[10px] text-slate-500">ml</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Moon className="h-4 w-4 text-indigo-300" />
              Sleep
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-sm font-semibold text-slate-50 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40"
                placeholder="0"
                value={metrics.sleepHours ?? ""}
                onChange={handleNumberChange("sleepHours")}
              />
              <span className="text-[11px] text-slate-400">h</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <BookOpen className="h-4 w-4 text-emerald-300" />
              Study
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-sm font-semibold text-slate-50 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                placeholder="0"
                value={metrics.studyHours ?? ""}
                onChange={handleNumberChange("studyHours")}
              />
              <span className="text-[11px] text-slate-400">h</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Dumbbell className="h-4 w-4 text-pink-300" />
              Exercise
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-sm font-semibold text-slate-50 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                placeholder="0"
                value={metrics.exerciseMinutes ?? ""}
                onChange={handleNumberChange("exerciseMinutes")}
              />
              <span className="text-[11px] text-slate-400">min</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Weight className="h-4 w-4 text-amber-300" />
              Weight
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 text-sm font-semibold text-slate-50 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/40"
                placeholder="0"
                value={metrics.weightKg ?? ""}
                onChange={handleNumberChange("weightKg")}
              />
              <span className="text-[11px] text-slate-400">kg</span>
            </div>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            <CalendarIcon className="h-4 w-4 text-slate-300" />
            Notes / Intention
          </label>
          <textarea
            rows={2}
            className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-50 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-300/30"
            placeholder="Write your simple one-line plan or reflection."
            value={metrics.notes}
            onChange={(e) => onChange("notes", e.target.value)}
          />
        </div>
      </div>
    </section>
  );
}

function DeviationChart({
  userData,
  metricKey,
}: {
  userData: UserData | null;
  metricKey: MetricKey;
}) {
  const metric = GRAPH_METRICS.find((m) => m.key === metricKey) ?? GRAPH_METRICS[1];
  const data = useMemo(() => {
    if (!userData) return [];
    const sorted = [...userData.days].sort((a, b) => (a.date < b.date ? -1 : 1));
    return sorted.slice(-14).map((d) => {
      const planned = d.intention[metricKey] as number | null;
      const actual = d.reality[metricKey] as number | null;
      const deviation =
        planned != null && actual != null ? actual - planned : null;
      return {
        date: d.date.slice(5),
        planned,
        actual,
        deviation,
        phase: d.phase,
      };
    });
  }, [userData, metricKey]);

  if (!userData || data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-slate-500">
        Graph will appear once you have at least one day logged.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          stroke="#64748b"
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          stroke="#64748b"
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#020617",
            borderRadius: 12,
            border: "1px solid #1e293b",
            padding: 8,
          }}
          labelStyle={{ fontSize: 12, color: "#e2e8f0" }}
          itemStyle={{ fontSize: 11 }}
          formatter={(value, name) => {
            if (typeof value !== "number") return [value, name];
            const label =
              name === "planned"
                ? "Plan"
                : name === "actual"
                ? "Reality"
                : "Δ";
            return [`${value.toFixed(2)} ${metric.unit}`, label];
          }}
        />
        <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="planned"
          name="planned"
          stroke="#38bdf8"
          strokeWidth={2.2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="actual"
          name="actual"
          stroke="#22c55e"
          strokeWidth={2.4}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="deviation"
          name="deviation"
          stroke="#f97316"
          strokeWidth={1.6}
          dot={false}
          strokeDasharray="5 4"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function Page() {
  const {
    userData,
    currentDay,
    selectedDate,
    ipHint,
    graphMetricKey,
    setGraphMetricKey,
    updateDayMetrics,
    offsetDay,
    goToToday,
    setCycleStartToSelected,
    exportData,
    importData,
  } = useUserData();

  const [isImporting, setIsImporting] = useState(false);

  const onFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      await importData(file);
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  if (!userData || !currentDay || !selectedDate) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto flex h-screen max-w-xl items-center justify-center px-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
            <p className="text-sm text-slate-400">
              Loading your ADHD Life OS…
            </p>
          </div>
        </div>
      </main>
    );
  }

  const phaseAccent =
    currentDay.phase === "FOCUS"
      ? "bg-emerald-500 text-slate-950"
      : "bg-amber-400 text-slate-950";

  const phaseLabel =
    currentDay.phase === "FOCUS" ? "Focus Day" : "Cheat / Flex Day";

  const metricForDisplay =
    GRAPH_METRICS.find((m) => m.key === graphMetricKey) ?? GRAPH_METRICS[1];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 pb-6 pt-4">
        <header className="mb-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                ADHD Life OS
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Zero-friction daily cockpit
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                14-day OMAD, intention vs reality, one thumb.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <div className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1">
                <Smartphone className="h-3.5 w-3.5 text-sky-300" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Local IP
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Connect via{" "}
                <span className="font-mono text-sky-300">
                  {ipHint || "your-laptop-ip"}:3000
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2.5">
            <div className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => offsetDay(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-lg leading-none text-slate-200 active:scale-95"
              >
                ‹
              </button>
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {formatDisplayDate(selectedDate)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">
                    Day {currentDay.dayIndex} of 14
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${phaseAccent}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-950/70" />
                    {phaseLabel}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => offsetDay(1)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-lg leading-none text-slate-200 active:scale-95"
              >
                ›
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={goToToday}
                className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 active:scale-95"
              >
                Today
              </button>
              <button
                type="button"
                onClick={setCycleStartToSelected}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300 active:scale-95"
              >
                <RefreshCw className="h-3 w-3" />
                Set Day 1 here
              </button>
            </div>
          </div>
        </header>

        <section className="mb-3 grid grid-cols-1 gap-3">
          <LogCard
            label="Intention (Plan)"
            accent="emerald"
            metrics={currentDay.intention}
            onChange={(field, value) =>
              updateDayMetrics("intention", field, value)
            }
          />
          <LogCard
            label="Reality (Actual)"
            accent="sky"
            metrics={currentDay.reality}
            onChange={(field, value) =>
              updateDayMetrics("reality", field, value)
            }
          />
        </section>

        <section className="mb-3 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Deviation graph
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                <span>Plan</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>Reality</span>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>Δ Variance</span>
              </div>
            </div>
            <div className="flex gap-1">
              {GRAPH_METRICS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setGraphMetricKey(m.key)}
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                    m.key === graphMetricKey
                      ? "bg-slate-100 text-slate-950"
                      : "bg-slate-900 text-slate-300 border border-slate-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-2 py-2">
            <DeviationChart userData={userData} metricKey={graphMetricKey} />
          </div>
          <div className="text-[11px] text-slate-400">
            Tracking: <span className="font-semibold">{metricForDisplay.label}</span>{" "}
            ({metricForDisplay.unit}) — aim for small, consistent gaps between
            intention and reality.
          </div>
        </section>

        <section className="mb-4 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Sync & backup
              </div>
              <p className="text-[11px] text-slate-500">
                Local-only. Use JSON to move between laptop and phone.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportData}
                className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-950 active:scale-95"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-50 active:scale-95">
                <Upload className="h-3.5 w-3.5" />
                <span>{isImporting ? "Importing…" : "Import"}</span>
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={onFileChange}
                />
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
            <Smartphone className="h-3.5 w-3.5 text-sky-300" />
            <span className="font-semibold text-slate-200">
              iPhone 14+ friendly:
            </span>
            <span>open the same IP in Safari, then import your JSON backup.</span>
          </div>
        </section>

        <footer className="mt-auto pt-2 text-[10px] text-slate-500">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Built for ADHD Combined Type — friction first.</span>
            <span className="font-mono text-slate-600">
              No cloud. No login. Just data.
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}

