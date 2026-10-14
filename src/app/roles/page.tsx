
"use client";

import { useCallback, useEffect, useState } from "react";

type Skill = {
  id: string;
  name: string;
  requirementType: string;
};

type Role = {
  id: string;
  name: string;
  alternativeTitles: string[];
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  locations: string[];
  remotePreference: "ANY" | "REMOTE_ONLY" | "ONSITE_OR_HYBRID";
  minExperienceMonths: number | null;
  maxExperienceMonths: number | null;
  minSalaryAnnual: number | null;
  maxSalaryAnnual: number | null;
  minFitScore: number;
  skills: Skill[];
  createdAt: string;
};

type RoleForm = {
  name: string;
  alternativeTitles: string;
  locations: string;
  remotePreference: Role["remotePreference"];
  minExperienceMonths: string;
  maxExperienceMonths: string;
  minSalaryAnnual: string;
  maxSalaryAnnual: string;
  minFitScore: number;
  skills: string;
};

const initialForm: RoleForm = {
  name: "",
  alternativeTitles: "",
  locations: "India\nRemote",
  remotePreference: "ANY",
  minExperienceMonths: "",
  maxExperienceMonths: "",
  minSalaryAnnual: "",
  maxSalaryAnnual: "",
  minFitScore: 60,
  skills: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";

const labelClass =
  "mb-2 block text-sm font-medium text-slate-700";

function lines(value: string): string[] {
  return [...new Set(
    value.split("\n").map((item) => item.trim()).filter(Boolean)
  )];
}

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function RoleEditor({
  initial,
  saving,
  onClose,
  onSave,
}: {
  initial: RoleForm;
  saving: boolean;
  onClose: () => void;
  onSave: (form: RoleForm) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [formError, setFormError] = useState("");

  function update<K extends keyof RoleForm>(
    key: K,
    value: RoleForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!form.name.trim()) {
      setFormError("Enter a role name.");
      return;
    }

    if (
      form.minExperienceMonths !== "" &&
      form.maxExperienceMonths !== "" &&
      Number(form.minExperienceMonths) > Number(form.maxExperienceMonths)
    ) {
      setFormError("Minimum experience cannot exceed maximum experience.");
      return;
    }

    if (
      form.minSalaryAnnual !== "" &&
      form.maxSalaryAnnual !== "" &&
      Number(form.minSalaryAnnual) > Number(form.maxSalaryAnnual)
    ) {
      setFormError("Minimum salary cannot exceed maximum salary.");
      return;
    }

    await onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={submit}
        className="my-4 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Role configuration
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {initial.name ? "Edit target role" : "Add target role"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Adjust your search criteria at any time.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        {formError && (
          <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {formError}
          </p>
        )}

        <div className="space-y-5">
          <div>
            <label className={labelClass}>Role name *</label>
            <input
              required
              autoFocus
              className={inputClass}
              placeholder="e.g. Backend SDE"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Alternative job titles</label>
            <textarea
              rows={2}
              className={inputClass}
              placeholder={"Backend Engineer\nSoftware Engineer"}
              value={form.alternativeTitles}
              onChange={(e) => update("alternativeTitles", e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Required skills</label>
            <textarea
              rows={3}
              className={inputClass}
              placeholder={"Java\nSQL\nREST APIs"}
              value={form.skills}
              onChange={(e) => update("skills", e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              One skill per line. These are currently saved as required skills.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Preferred locations</label>
              <textarea
                rows={2}
                className={inputClass}
                placeholder={"India\nRemote"}
                value={form.locations}
                onChange={(e) => update("locations", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Work arrangement</label>
              <select
                className={inputClass}
                value={form.remotePreference}
                onChange={(e) =>
                  update("remotePreference", e.target.value as RoleForm["remotePreference"])
                }
              >
                <option value="ANY">Any arrangement</option>
                <option value="REMOTE_ONLY">Remote only</option>
                <option value="ONSITE_OR_HYBRID">On-site or hybrid</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Minimum experience (months)</label>
              <input
                type="number"
                min="0"
                className={inputClass}
                placeholder="No minimum"
                value={form.minExperienceMonths}
                onChange={(e) => update("minExperienceMonths", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Maximum experience (months)</label>
              <input
                type="number"
                min="0"
                className={inputClass}
                placeholder="No maximum"
                value={form.maxExperienceMonths}
                onChange={(e) => update("maxExperienceMonths", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Minimum salary (₹/year)</label>
              <input
                type="number"
                min="0"
                className={inputClass}
                placeholder="No minimum"
                value={form.minSalaryAnnual}
                onChange={(e) => update("minSalaryAnnual", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Maximum salary (₹/year)</label>
              <input
                type="number"
                min="0"
                className={inputClass}
                placeholder="No maximum"
                value={form.maxSalaryAnnual}
                onChange={(e) => update("maxSalaryAnnual", e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label className={labelClass}>Minimum fit score</label>
              <span className="rounded-lg bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700">
                {form.minFitScore}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              className="w-full accent-indigo-600"
              value={form.minFitScore}
              onChange={(e) => update("minFitScore", Number(e.target.value))}
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>0 — Broad matches</span>
              <span>100 — Strict matches</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save role"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [filter, setFilter] = useState("ALL");

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/roles", { cache: "no-store" });
setError("");
const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load roles.");
      }

      setRoles(data.roles ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load roles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const visibleRoles = roles.filter((role) =>
    filter === "ALL" ? true : role.status === filter
  );

  function openCreate() {
    setEditingRole(null);
    setEditorOpen(true);
    setNotice("");
  }

  function openEdit(role: Role) {
    setEditingRole(role);
    setEditorOpen(true);
    setNotice("");
  }

  function makeForm(role: Role | null): RoleForm {
    if (!role) return initialForm;

    return {
      name: role.name,
      alternativeTitles: role.alternativeTitles.join("\n"),
      locations: role.locations.join("\n"),
      remotePreference: role.remotePreference,
      minExperienceMonths: role.minExperienceMonths?.toString() ?? "",
      maxExperienceMonths: role.maxExperienceMonths?.toString() ?? "",
      minSalaryAnnual: role.minSalaryAnnual?.toString() ?? "",
      maxSalaryAnnual: role.maxSalaryAnnual?.toString() ?? "",
      minFitScore: role.minFitScore,
      skills: role.skills.map((skill) => skill.name).join("\n"),
    };
  }

  async function saveRole(form: RoleForm) {
    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      name: form.name.trim(),
      alternativeTitles: lines(form.alternativeTitles),
      locations: lines(form.locations),
      remotePreference: form.remotePreference,
      minExperienceMonths: toNumber(form.minExperienceMonths),
      maxExperienceMonths: toNumber(form.maxExperienceMonths),
      minSalaryAnnual: toNumber(form.minSalaryAnnual),
      maxSalaryAnnual: toNumber(form.maxSalaryAnnual),
      minFitScore: form.minFitScore,
      skills: lines(form.skills),
    };

    try {
      const response = await fetch(
        editingRole ? `/api/roles/${editingRole.id}` : "/api/roles",
        {
          method: editingRole ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save role.");
      }

      setEditorOpen(false);
      setNotice(editingRole ? "Role updated successfully." : "Role created successfully.");
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save role.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(role: Role, status: "ACTIVE" | "PAUSED" | "ARCHIVED") {
    const action = status === "ARCHIVED" ? "archive" : status === "PAUSED" ? "pause" : "activate";

    if (
      status === "ARCHIVED" &&
      !window.confirm(`Archive "${role.name}"? Its history will be preserved.`)
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = status === "ARCHIVED"
        ? await fetch(`/api/roles/${role.id}`, { method: "DELETE" })
        : await fetch(`/api/roles/${role.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `Unable to ${action} role.`);
      }

      setNotice(`Role ${action}d successfully.`);
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${action} role.`);
    }
  }

  const activeCount = roles.filter((role) => role.status === "ACTIVE").length;
  const pausedCount = roles.filter((role) => role.status === "PAUSED").length;
  const archivedCount = roles.filter((role) => role.status === "ARCHIVED").length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-6 lg:flex">
          <a href="/profile" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white">
              C
            </div>
            <div>
              <p className="font-bold tracking-tight">CareerPilot</p>
              <p className="text-xs text-slate-500">Personal AI agent</p>
            </div>
          </a>

          <p className="mb-3 mt-10 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Workspace
          </p>
          <a href="/profile" className="rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-slate-50">
            ◉ Candidate profile
          </a>
          <a href="/roles" className="mt-2 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
            ◎ Target roles
          </a>
          <div className="mt-2 rounded-xl px-4 py-3 text-sm text-slate-400">
            ⌕ Job discovery <span className="float-right text-[10px]">SOON</span>
          </div>
          <div className="mt-1 rounded-xl px-4 py-3 text-sm text-slate-400">
            ▤ Applications <span className="float-right text-[10px]">SOON</span>
          </div>
          <div className="mt-1 rounded-xl px-4 py-3 text-sm text-slate-400">
            ▧ Resume studio <span className="float-right text-[10px]">SOON</span>
          </div>

          <div className="mt-auto rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-sm font-semibold">Search with intention</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Keep your target roles focused and tune their matching criteria as you learn.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white">
            <div className="flex min-h-[72px] items-center justify-between gap-4 px-5 sm:px-8">
              <div>
                <p className="text-xs text-slate-500">Workspace / Target roles</p>
                <h1 className="mt-1 text-lg font-bold tracking-tight">Target roles</h1>
              </div>
              <button
                onClick={openCreate}
                className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/15 hover:bg-indigo-700 sm:px-5"
              >
                + <span className="hidden sm:inline">Add target role</span>
                <span className="sm:hidden">Add role</span>
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-6xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
            <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200">
                Role management
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Define what you&apos;re looking for.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100 sm:text-base">
                Create flexible role profiles, specify relevant skills, and decide how closely a job should match before it enters your review queue.
              </p>
              <div className="mt-7 grid grid-cols-3 gap-3">
                {[
                  { label: "Active", count: activeCount, color: "text-emerald-300" },
                  { label: "Paused", count: pausedCount, color: "text-amber-300" },
                  { label: "Archived", count: archivedCount, color: "text-slate-300" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/15 bg-white/10 p-4">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
                    <p className="mt-1 text-xs text-indigo-100">{item.label} roles</p>
                  </div>
                ))}
              </div>
            </div>

            {notice && (
              <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                ✓ {notice}
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Your role profiles</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {roles.length} role{roles.length === 1 ? "" : "s"} configured
                </p>
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="ALL">All roles</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
                Loading your target roles…
              </div>
            ) : visibleRoles.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-700">
                  ◎
                </div>
                <h3 className="mt-5 text-lg font-bold">No roles in this view</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Add a target role or choose another status filter to see your existing role profiles.
                </p>
                <button
                  onClick={openCreate}
                  className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Create your first role
                </button>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {visibleRoles.map((role) => (
                  <article key={role.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-bold text-indigo-700">
                          {role.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="break-words text-lg font-bold">{role.name}</h4>
                          <p className="mt-1 text-xs text-slate-500">
                            {role.alternativeTitles.length
                              ? role.alternativeTitles.join(" · ")
                              : "No alternative titles"}
                          </p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        role.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700"
                          : role.status === "PAUSED"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {role.status}
                      </span>
                    </div>

                    <div className="mt-6 flex items-end justify-between gap-4 rounded-2xl bg-slate-50 p-4">
                      <div>
                        <p className="text-xs font-medium text-slate-500">Minimum fit score</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{role.minFitScore}%</p>
                      </div>
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${role.minFitScore}%` }} />
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Skills · {role.skills.length}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {role.skills.slice(0, 8).map((skill) => (
                          <span key={skill.id} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
                            {skill.name}
                          </span>
                        ))}
                        {role.skills.length > 8 && (
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-500">
                            +{role.skills.length - 8} more
                          </span>
                        )}
                        {role.skills.length === 0 && (
                          <span className="text-xs text-slate-400">No skills configured</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-slate-100 p-3">
                        <p className="text-xs text-slate-400">Location</p>
                        <p className="mt-1 font-medium text-slate-700">
                          {role.locations.join(", ") || "Any location"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-100 p-3">
                        <p className="text-xs text-slate-400">Experience (months)</p>
                        <p className="mt-1 font-medium text-slate-700">
                          {role.minExperienceMonths ?? 0}
                          {" – "}
                          {role.maxExperienceMonths ?? "Any"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                      <button onClick={() => openEdit(role)} className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Edit role
                      </button>
                      {role.status === "ACTIVE" ? (
                        <button onClick={() => void changeStatus(role, "PAUSED")} className="rounded-xl border border-amber-200 px-3.5 py-2.5 text-xs font-semibold text-amber-700 hover:bg-amber-50">
                          Pause
                        </button>
                      ) : role.status === "PAUSED" ? (
                        <button onClick={() => void changeStatus(role, "ACTIVE")} className="rounded-xl border border-emerald-200 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                          Activate
                        </button>
                      ) : (
                        <button onClick={() => void changeStatus(role, "ACTIVE")} className="rounded-xl border border-emerald-200 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                          Reactivate
                        </button>
                      )}
                      {role.status !== "ARCHIVED" && (
                        <button onClick={() => void changeStatus(role, "ARCHIVED")} className="ml-auto rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700">
                          Archive
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            <footer className="pb-6 text-center text-xs text-slate-400">
              CareerPilot · Your criteria, your decisions.
            </footer>
          </div>
        </div>
      </div>

      {editorOpen && (
        <RoleEditor
          key={editingRole?.id ?? "new"}
          initial={makeForm(editingRole)}
          saving={saving}
          onClose={() => setEditorOpen(false)}
          onSave={saveRole}
        />
      )}
    </main>
  );
}
