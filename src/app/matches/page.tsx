"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Classification =
  | "AUTO_APPLY_CANDIDATE"
  | "REVIEW_REQUIRED"
  | "NOT_RECOMMENDED";

type Role = {
  id: string;
  name: string;
  minFitScore: number;
  status: string;
};

type JobMatch = {
  id: string;
  score: number;
  classification: Classification;
  eligibility: "ELIGIBLE" | "INELIGIBLE" | "UNCERTAIN";
  meetsThreshold: boolean;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  reasons: {
    items?: string[];
    jobSkillsFound?: string[];
    classification?: Classification;
  } | null;
  evaluatedAt: string;
  scoringVersion: number;
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    canonicalUrl: string;
    description: string;
    employmentType: string;
    remote: boolean;
    minExperienceMonths: number | null;
    maxExperienceMonths: number | null;
    minSalaryAnnual: number | null;
    maxSalaryAnnual: number | null;
    salaryCurrency: string;
    postedAt: string | null;
    lastSeenAt: string;
    source: { id: string; name: string; type: string };
  };
  role: { id: string; name: string; minFitScore: number };
};

type MatchResponse = { matches: JobMatch[]; count: number };

type Queue = "STRONG" | "EXPLORE" | "EXCLUDED";

function normalizeClassification(value: unknown): Classification {
  if (value === "AUTO_APPLY_CANDIDATE") {
    return "AUTO_APPLY_CANDIDATE";
  }

  if (value === "NOT_RECOMMENDED") {
    return "NOT_RECOMMENDED";
  }

  return "REVIEW_REQUIRED";
}

function normalizeMatches(data: MatchResponse): JobMatch[] {
  if (!Array.isArray(data.matches)) {
    return [];
  }

  return data.matches.map((match) => ({
    ...match,
    classification: normalizeClassification(
      match.classification ?? match.reasons?.classification,
    ),
    matchedSkills: Array.isArray(match.matchedSkills)
      ? match.matchedSkills
      : [],
    missingRequiredSkills: Array.isArray(match.missingRequiredSkills)
      ? match.missingRequiredSkills
      : [],
    reasons: match.reasons ?? null,
  }));
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-IN");
}

function salaryText(min: number | null, max: number | null, currency: string) {
  if (min === null && max === null) return "Salary not disclosed";

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
      notation: n >= 100000 ? "compact" : "standard",
    }).format(n);

  if (min !== null && max !== null) return `${fmt(min)} – ${fmt(max)} / year`;
  if (min !== null) return `From ${fmt(min)} / year`;
  return `Up to ${fmt(max!)} / year`;
}

function employmentText(value: string) {
  return value.toLowerCase().split("_").map(
    (part) => part.charAt(0).toUpperCase() + part.slice(1)
  ).join(" ");
}

function Icon({
  name,
  size = 20,
}: {
  name: "briefcase" | "target" | "chart" | "refresh" | "pin" | "arrow" | "clock" | "spark";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  const paths: Record<string, React.ReactNode> = {
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-7" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function StatCard({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: "briefcase" | "target" | "chart";
  accent: "indigo" | "emerald" | "violet";
}) {
  const colors = {
    indigo: {
      icon: "bg-indigo-50 text-indigo-600",
      glow: "from-indigo-500/10",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-600",
      glow: "from-emerald-500/10",
    },
    violet: {
      icon: "bg-violet-50 text-violet-600",
      glow: "from-violet-500/10",
    },
  }[accent];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/50">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${colors.glow} via-transparent to-transparent opacity-80`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors.icon} transition-transform duration-300 group-hover:scale-105`}>
          <Icon name={icon} size={21} />
        </div>
      </div>
      <p className="relative mt-3 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function ScoreGauge({ score, threshold }: { score: number; threshold: number }) {
  const safeScore = Math.max(0, Math.min(100, score));
  const circumference = 2 * Math.PI * 39;
  const dash = (safeScore / 100) * circumference;

  return (
    <div className="relative flex w-[112px] shrink-0 flex-col items-center rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/80 to-white p-3">
      <svg viewBox="0 0 100 100" className="h-[82px] w-[82px] -rotate-90" role="img" aria-label={`Estimated fit ${safeScore}%`}>
        <defs>
          <linearGradient id="careerpilot-score-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="39" fill="none" stroke="#E0E7FF" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="39"
          fill="none"
          stroke="url(#careerpilot-score-gradient)"
          strokeWidth="8"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="pointer-events-none absolute top-[31px] flex flex-col items-center">
        <span className="text-xl font-bold tracking-tight text-slate-900">{safeScore}%</span>
      </div>
      <span className="mt-1 text-[11px] font-semibold text-slate-500">Estimated fit</span>
      <span className="mt-1 text-[10px] text-slate-400">Target {threshold}%</span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
      >
        {children}
      </select>
    </label>
  );
}

function SkillGroup({
  title,
  skills,
  kind,
  empty,
}: {
  title: string;
  skills: string[];
  kind: "matched" | "missing" | "neutral";
  empty: string;
}) {
  const styles = {
    matched: "border-emerald-200 bg-emerald-50 text-emerald-800",
    missing: "border-amber-200 bg-amber-50 text-amber-800",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
  };
  const uniqueSkills = [...new Set(skills)];

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <span className={`h-2 w-2 rounded-full ${kind === "matched" ? "bg-emerald-500" : kind === "missing" ? "bg-amber-500" : "bg-slate-400"}`} />
        {title}
        <span className="ml-auto text-xs font-medium text-slate-400">{uniqueSkills.length}</span>
      </h4>
      {uniqueSkills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {uniqueSkills.map((skill) => (
            <span key={skill} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${styles[kind]}`}>
              {skill}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs leading-5 text-slate-500">{empty}</p>
      )}
    </div>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [minimumScore, setMinimumScore] = useState("ALL");
  const [eligibility, setEligibility] = useState("ALL");
  const [matching, setMatching] = useState(false);
const [taskMessage, setTaskMessage] = useState("");
const [taskError, setTaskError] = useState("");
const [activeQueue, setActiveQueue] = useState<
  "STRONG" | "EXPLORE" | "EXCLUDED"
>("EXPLORE");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
  if (isRefresh) {
    setRefreshing(true);
    setError("");
  }

  try {
      const [matchesResponse, rolesResponse] = await Promise.all([
        fetch("/api/matches", { cache: "no-store" }),
        fetch("/api/roles", { cache: "no-store" }),
      ]);

      if (!matchesResponse.ok) throw new Error("Could not load job matches.");
      if (!rolesResponse.ok) throw new Error("Could not load target roles.");

      const matchData: MatchResponse = await matchesResponse.json();
      const roleData: { roles: Role[] } = await rolesResponse.json();

      setMatches(normalizeMatches(matchData));
      setRoles((roleData.roles ?? []).filter((role) => role.status === "ACTIVE"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);
const startMatching = useCallback(async () => {
  setMatching(true);
  setTaskError("");
  setTaskMessage("Queueing job matching...");

  try {
    const response = await fetch("/api/matching/tasks", {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not start matching.");
    }

    const taskId: string | undefined = data.task?.id;

    if (!taskId) {
      throw new Error("The server did not return a task ID.");
    }

    setTaskMessage(
      data.alreadyRunning
        ? "Matching is already queued or running."
        : "Matching task queued.",
    );

    for (let attempt = 0; attempt < 120; attempt++) {
      const statusResponse = await fetch(
        `/api/matching/tasks?taskId=${encodeURIComponent(taskId)}`,
        { cache: "no-store" },
      );

      const statusData = await statusResponse.json();

      if (!statusResponse.ok) {
        throw new Error(
          statusData.error || "Could not retrieve matching status.",
        );
      }

      const task = statusData.task;

      if (!task) {
        throw new Error("The server did not return the task status.");
      }

      if (task.status === "SUCCEEDED") {
        setTaskMessage("Matching completed. Refreshing results...");
        await loadData(true);
        setTaskMessage("Matching completed successfully.");
        return;
      }

      if (task.status === "FAILED") {
        throw new Error(
          task.lastError || "Matching failed after its retry attempts.",
        );
      }

      setTaskMessage(
        task.status === "RETRY_WAIT"
          ? `Matching failed temporarily; retrying (${task.attempts}/${task.maxAttempts}).`
          : task.status === "RUNNING"
            ? `Matching is running (attempt ${task.attempts}/${task.maxAttempts}).`
            : "Matching is waiting in the queue...",
      );

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    setTaskMessage(
      "Matching is taking longer than expected. You can refresh the page to check results.",
    );
  } catch (error) {
    setTaskError(
      error instanceof Error ? error.message : "Matching failed.",
    );
    setTaskMessage("");
  } finally {
    setMatching(false);
  }
}, [loadData]);

  const filteredMatches = useMemo(
    () => matches.filter((match) =>
      (selectedRole === "ALL" || match.role.id === selectedRole) &&
      (minimumScore === "ALL" || match.score >= Number(minimumScore)) &&
      (eligibility === "ALL" || match.eligibility === eligibility)
    ),
    [matches, selectedRole, minimumScore, eligibility]
  );

  const queueMatches = useMemo(() => {
  return {
    STRONG: filteredMatches.filter(
      (match) => match.classification === "AUTO_APPLY_CANDIDATE",
    ),
    EXPLORE: filteredMatches.filter(
      (match) => match.classification === "REVIEW_REQUIRED",
    ),
    EXCLUDED: filteredMatches.filter(
      (match) => match.classification === "NOT_RECOMMENDED",
    ),
  };
}, [filteredMatches]);

const visibleMatches = queueMatches[activeQueue];
  const aboveThreshold = filteredMatches.filter((match) => match.meetsThreshold).length;
  const averageScore = filteredMatches.length
    ? Math.round(filteredMatches.reduce((sum, match) => sum + match.score, 0) / filteredMatches.length)
    : 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F6F8FC] text-slate-900">
      <div className="pointer-events-none absolute -top-36 right-[-90px] h-[380px] w-[380px] rounded-full bg-indigo-200/25 blur-3xl" />
      <div className="pointer-events-none absolute left-[-160px] top-[460px] h-[330px] w-[330px] rounded-full bg-violet-200/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-[11px] font-bold tracking-[0.14em] text-indigo-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" />
              CAREERPILOT <span className="text-slate-300">/</span> DISCOVERY
            </div>
            <h1 className="text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Find your next <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">opportunity.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Explore relevant roles, understand your fit, and choose what to pursue.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={loading || refreshing}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-md disabled:opacity-60 sm:self-center"
          >
            <span className={refreshing ? "animate-spin" : ""}><Icon name="refresh" size={17} /></span>
            {refreshing ? "Refreshing..." : "Refresh matches"}
          </button>
          <button
  type="button"
  onClick={() => void startMatching()}
  disabled={loading || matching}
  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
>
  <Icon
    name={matching ? "refresh" : "spark"}
    size={17}
  />
  {matching ? "Matching..." : "Run matching"}
</button>
        </header>
{(taskMessage || taskError) && (
  <section
    className={`mt-5 rounded-xl border p-4 text-sm ${
      taskError
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-indigo-200 bg-indigo-50 text-indigo-800"
    }`}
    aria-live="polite"
  >
    <p className="font-semibold">
      {taskError ? "Matching error" : "Background matching"}
    </p>

    <p className="mt-1">
      {taskError || taskMessage}
    </p>

    {taskError && (
      <button
        type="button"
        onClick={() => void startMatching()}
        disabled={matching}
        className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold disabled:opacity-60"
      >
        Retry matching
      </button>
    )}
  </section>
)}
        <section className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Matching results" value={loading ? "—" : String(filteredMatches.length)} detail="For your current filters" icon="briefcase" accent="indigo" />
          <StatCard label="Meeting role threshold" value={loading ? "—" : String(aboveThreshold)} detail="Matches meeting their role's target score" icon="target" accent="emerald" />
          <StatCard label="Average estimated fit" value={loading ? "—" : `${averageScore}%`} detail="Heuristic estimate, not hiring probability" icon="chart" accent="violet" />
        </section>

        <section className="mt-6 rounded-2xl border border-white bg-white/90 p-4 shadow-sm shadow-slate-200/50 backdrop-blur sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Refine your search</h2>
              <p className="mt-1 text-xs text-slate-500">Filters only affect what you see.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedRole("ALL");
                setMinimumScore("ALL");
                setEligibility("ALL");
              }}
              className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
            >
              Reset filters
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FilterSelect label="Target role" value={selectedRole} onChange={setSelectedRole}>
              <option value="ALL">All active roles</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Minimum estimated fit" value={minimumScore} onChange={setMinimumScore}>
              <option value="ALL">Any score</option>
              <option value="40">40% and above</option>
              <option value="60">60% and above</option>
              <option value="70">70% and above</option>
              <option value="80">80% and above</option>
              <option value="90">90% and above</option>
            </FilterSelect>
            <FilterSelect label="Eligibility" value={eligibility} onChange={setEligibility}>
              <option value="ALL">All eligibility states</option>
              <option value="ELIGIBLE">Eligible</option>
              <option value="UNCERTAIN">Needs verification</option>
              <option value="INELIGIBLE">Potential mismatch</option>
            </FilterSelect>
          </div>
        </section>

        <div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-5 grid gap-3 md:grid-cols-3">
  {(
    [
      {
        id: "STRONG",
        title: "Strong Matches",
        description: "High-fit opportunities",
      },
      {
        id: "EXPLORE",
        title: "Explore Jobs",
        description: "Opportunities to review",
      },
      {
        id: "EXCLUDED",
        title: "Not Recommended",
        description: "Lower-fit opportunities",
      },
    ] as const
  ).map((queue) => (
    <button
      key={queue.id}
      type="button"
      onClick={() => setActiveQueue(queue.id)}
      aria-pressed={activeQueue === queue.id}
      className={`rounded-2xl border p-4 text-left transition ${
        activeQueue === queue.id
          ? "border-indigo-300 bg-indigo-50 shadow-sm ring-2 ring-indigo-100"
          : "border-slate-200 bg-white hover:border-indigo-200"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-slate-900">{queue.title}</span>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-indigo-700">
          {queueMatches[queue.id].length}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {queue.description}
      </p>
    </button>
  ))}
</div>
            <h2 className="text-xl font-bold tracking-tight">Your opportunities</h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading ? "Loading results..." : `${filteredMatches.length} result${filteredMatches.length === 1 ? "" : "s"} found`}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm">
            <Icon name="spark" size={14} /> ESTIMATED FIT · V1
          </span>
        </div>

        {error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <p className="font-semibold">Could not load matches</p>
            <p className="mt-1">{error}</p>
            <button onClick={() => void loadData()} className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold">Try again</button>
          </div>
        )}

        {loading && !error && (
          <div className="grid gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {!loading && !error && visibleMatches.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-600">
              <Icon name="briefcase" size={26} />
            </div>
            <h3 className="mt-4 text-lg font-bold">No matches found</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {filteredMatches.length === 0
                ? "Adjust your filters or import more jobs and run the matching engine."
                : "No jobs in this queue match your current filters. Try another queue."}
            </p>
            <button
              onClick={() => {
                setSelectedRole("ALL");
                setMinimumScore("ALL");
                setEligibility("ALL");
              }}
              className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Clear filters
            </button>
          </div>
        )}

        {!loading && !error && visibleMatches.length > 0 && (
          <div className="grid gap-4">
            {visibleMatches.map((match) => {
              const isExpanded = expanded === match.id;
              const threshold = match.role.minFitScore;
              const statusStyle = {
                ELIGIBLE: "border-emerald-200 bg-emerald-50 text-emerald-700",
                INELIGIBLE: "border-rose-200 bg-rose-50 text-rose-700",
                UNCERTAIN: "border-amber-200 bg-amber-50 text-amber-800",
              }[match.eligibility];

              return (
                <article key={match.id} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition duration-300 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-950/[0.04]">
                  <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-200 opacity-0 transition group-hover:opacity-100" />
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/20">
                        {match.job.company.trim().charAt(0).toUpperCase() || "J"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {match.role.name}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${match.meetsThreshold ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                            {match.meetsThreshold ? "Meets threshold" : `Below ${threshold}% threshold`}
                          </span>
                        </div>

                        <h3 className="mt-3 break-words text-lg font-bold tracking-tight text-slate-900 transition group-hover:text-indigo-700 sm:text-xl">
                          {match.job.title}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-slate-600">{match.job.company}</p>

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5"><Icon name="pin" size={14} />{match.job.location || "Location unspecified"}</span>
                          <span className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${match.job.remote ? "bg-emerald-500" : "bg-slate-400"}`} />{match.job.remote ? "Remote" : "On-site / unspecified"}</span>
                          <span>{employmentText(match.job.employmentType)}</span>
                        </div>

                        <p className="mt-3 text-sm font-medium text-slate-700">
                          {salaryText(match.job.minSalaryAnnual, match.job.maxSalaryAnnual, match.job.salaryCurrency)}
                        </p>
                      </div>

                      <ScoreGauge score={match.score} threshold={threshold} />
                    </div>

                    <div className="mt-5 flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${statusStyle}`}>
                          {match.eligibility === "ELIGIBLE" ? "Eligible" : match.eligibility === "INELIGIBLE" ? "Potential mismatch" : "Needs verification"}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                          <Icon name="clock" size={13} /> Seen {formatDate(match.job.lastSeenAt)}
                        </span>
                        <span className="text-xs text-slate-400">via {match.job.source.name}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : match.id)}
                          aria-expanded={isExpanded}
                          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700"
                        >
                          {isExpanded ? "Hide details ↑" : "Match details ↓"}
                        </button>
                        <a
                          href={match.job.canonicalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md"
                        >
                          View listing <Icon name="arrow" size={15} />
                        </a>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
                        <div className="grid gap-3 md:grid-cols-2">
                          <SkillGroup title="Skills on your profile" skills={match.matchedSkills} kind="matched" empty="No configured role skills matched your profile." />
                          <SkillGroup title="Required skills missing from profile" skills={match.missingRequiredSkills} kind="missing" empty="No missing required skills were identified." />
                        </div>

                        <SkillGroup title="Skills mentioned in the listing" skills={match.reasons?.jobSkillsFound ?? []} kind="neutral" empty="No configured role skills were found in the job text." />

                        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                          <h4 className="text-sm font-bold text-slate-800">Score breakdown</h4>
                          <ul className="mt-3 space-y-2.5">
                            {(match.reasons?.items ?? []).map((reason, index) => (
                              <li key={`${match.id}-reason-${index}`} className="flex gap-2.5 text-sm leading-6 text-slate-600">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-4">
                          <div className="mt-0.5 text-amber-700"><Icon name="spark" size={18} /></div>
                          <p className="text-xs leading-5 text-amber-900">
                            This is a heuristic fit estimate based on available profile and listing data—not a hiring probability. Verify qualifications and requirements with the employer before applying.
                          </p>
                        </div>

                        <p className="text-[11px] text-slate-400">
                          Evaluated {match.evaluatedAt && !Number.isNaN(new Date(match.evaluatedAt).getTime())
                            ? new Date(match.evaluatedAt).toLocaleString("en-IN")
                            : "Date unavailable"} · Scoring version {match.scoringVersion}
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-slate-200/80 py-5 text-xs text-slate-400 sm:flex-row">
          <span>CareerPilot · Your job search, organized.</span>
          <span>You review and approve every application.</span>
        </footer>
      </div>
    </main>
  );
}



