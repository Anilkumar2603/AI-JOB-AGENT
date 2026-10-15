
"use client";

import { useEffect, useMemo, useState } from "react";
import ResumeManager from "@/components/resume-manager";
type Profile = {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  experience: string[];
  projects: string[];
  education: string[];
  preferences: {
    targetRoles?: string[];
    locations?: string[];
    remotePreference?: string;
    minSalaryAnnual?: number | null;
    [key: string]: unknown;
  };
};

const emptyProfile: Profile = {
  fullName: "",
  email: "",
  phone: "",
  location: "India",
  summary: "",
  skills: [],
  experience: [],
  projects: [],
  education: [],
  preferences: {
    targetRoles: [
      "Backend SDE",
      "Guidewire Developer",
      "Full-stack Developer",
      "Java Developer",
      "AI/ML Engineer",
    ],
    locations: ["India"],
    remotePreference: "ANY",
    minSalaryAnnual: null,
  },
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";

const labelClass =
  "mb-2 block text-sm font-medium text-slate-700";

function linesToArray(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToLines(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) =>
      typeof item === "string" ? item : JSON.stringify(item)
    )
    .join("\n");
}

function Section({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
          {number}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [skillsText, setSkillsText] = useState("");
  const [experienceText, setExperienceText] = useState("");
  const [projectsText, setProjectsText] = useState("");
  const [educationText, setEducationText] = useState("");
  const [rolesText, setRolesText] = useState(
    emptyProfile.preferences.targetRoles?.join("\n") ?? ""
  );
  const [locationsText, setLocationsText] = useState("India");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
  try {
    console.log("Profile loading started");

    const response = await fetch("/api/profile", {
      cache: "no-store",
    });

    console.log("Profile response status:", response.status);

    const data = await response.json();
    console.log("Profile response data:", data);

    if (cancelled) return;

    if (data.profile) {
          const saved = data.profile as Profile;

          setProfile({
  ...emptyProfile,
  ...saved,
  fullName: saved.fullName ?? "",
  email: saved.email ?? "",
  phone: saved.phone ?? "",
  location: saved.location ?? "",
  summary: saved.summary ?? "",
  preferences: {
    ...emptyProfile.preferences,
    ...(saved.preferences ?? {}),
  },
});

          setSkillsText(arrayToLines(saved.skills));
          setExperienceText(arrayToLines(saved.experience));
          setProjectsText(arrayToLines(saved.projects));
          setEducationText(arrayToLines(saved.education));
          setRolesText(
            arrayToLines(
              saved.preferences?.targetRoles ??
                emptyProfile.preferences.targetRoles
            )
          );
          setLocationsText(
            arrayToLines(
              saved.preferences?.locations ?? ["India"]
            )
          );
        }
  } catch (err) {
    console.error("Profile loading failed:", err);
  } finally {
    console.log("Profile loading finished; cancelled:", cancelled);

    if (!cancelled) setLoading(false);
  }
}

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const completion = useMemo(() => {
    const checks = [
      Boolean(profile.fullName.trim()),
      Boolean(profile.email.trim()),
      Boolean(profile.location.trim()),
      Boolean(profile.summary.trim()),
      linesToArray(skillsText).length > 0,
      linesToArray(experienceText).length > 0,
      linesToArray(projectsText).length > 0,
      linesToArray(educationText).length > 0,
      linesToArray(rolesText).length > 0,
      linesToArray(locationsText).length > 0,
    ];

    return Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    );
  }, [
    profile,
    skillsText,
    experienceText,
    projectsText,
    educationText,
    rolesText,
    locationsText,
  ]);

  function updateField(
    field: "fullName" | "email" | "phone" | "location" | "summary",
    value: string
  ) {
    setProfile((current) => ({ ...current, [field]: value }));
    setMessage("");
    setError("");
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const payload: Profile = {
      ...profile,
      fullName: profile.fullName.trim(),
      email: profile.email.trim().toLowerCase(),
      skills: linesToArray(skillsText),
      experience: linesToArray(experienceText),
      projects: linesToArray(projectsText),
      education: linesToArray(educationText),
      preferences: {
        ...profile.preferences,
        targetRoles: linesToArray(rolesText),
        locations: linesToArray(locationsText),
      },
    };

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save profile.");
      }

      setProfile({
  ...emptyProfile,
  ...data.profile,
  fullName: data.profile.fullName ?? "",
  email: data.profile.email ?? "",
  phone: data.profile.phone ?? "",
  location: data.profile.location ?? "",
  summary: data.profile.summary ?? "",
  preferences: {
    ...emptyProfile.preferences,
    ...(data.profile.preferences ?? {}),
  },
});

      setSkillsText(arrayToLines(data.profile.skills));
      setExperienceText(arrayToLines(data.profile.experience));
      setProjectsText(arrayToLines(data.profile.projects));
      setEducationText(arrayToLines(data.profile.education));
      setRolesText(
        arrayToLines(data.profile.preferences?.targetRoles)
      );
      setLocationsText(
        arrayToLines(data.profile.preferences?.locations)
      );

      setMessage("Your profile has been saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-6 lg:flex">
          <a href="/profile" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-600/20">
              J
            </div>
            <div>
              <p className="font-bold tracking-tight">CareerPilot</p>
              <p className="text-xs text-slate-500">Personal AI agent</p>
            </div>
          </a>

          <div className="mt-10">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Workspace
            </p>
            <a
              href="/profile"
              className="flex items-center gap-3 rounded-xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700"
            >
              <span>◉</span> Candidate profile
            </a>
            <div className="mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400">
              <span>⌕</span> Job discovery
              <span className="ml-auto text-[10px]">SOON</span>
            </div>
            <div className="mt-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400">
              <span>▤</span> Applications
              <span className="ml-auto text-[10px]">SOON</span>
            </div>
            <div className="mt-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400">
              <span>▧</span> Resume studio
              <span className="ml-auto text-[10px]">SOON</span>
            </div>
          </div>

          <div className="mt-auto rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-700">
              ✦
            </div>
            <p className="text-sm font-semibold">Build your profile</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              A detailed, accurate profile helps the agent match jobs and
              tailor your resume.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
            <div className="flex h-[72px] items-center justify-between gap-4 px-5 sm:px-8">
              <div>
                <p className="text-xs text-slate-500">
                  Workspace / Candidate profile
                </p>
                <h1 className="mt-1 text-lg font-bold tracking-tight">
                  Your professional profile
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold">
                    {profile.fullName || "Your account"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Profile settings
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                  {(profile.fullName.trim()[0] || "Y").toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-5xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-6 text-white shadow-xl sm:p-9">
              <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -right-1 -top-12 h-44 w-44 rounded-full border border-white/10" />

              <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Candidate workspace
                  </div>
                  <h2 className="mt-5 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
                    Your next opportunity starts here.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
                    Create one trusted professional profile for smarter job
                    matching and tailored resume drafts.
                  </p>
                </div>

                <div className="flex items-center gap-5 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                  <div
                    className="relative flex h-24 w-24 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(#a5b4fc ${completion * 3.6}deg, rgba(255,255,255,.15) 0deg)`,
                    }}
                  >
                    <div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-indigo-950">
                      <span className="text-2xl font-bold">{completion}%</span>
                      <span className="text-[10px] text-indigo-200">complete</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold">Profile strength</p>
                    <p className="mt-1 max-w-32 text-xs leading-5 text-indigo-100">
                      {completion === 100
                        ? "All profile sections are filled."
                        : "Complete more sections to prepare for matching."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {message && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                ✓ {message}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
                Loading your saved profile…
              </div>
            ) : (
              <form onSubmit={saveProfile} className="space-y-6">
                <Section
                  number="01"
                  title="Personal information"
                  description="Keep your contact information and professional introduction accurate."
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Full name *</label>
                      <input
                        required
                        autoComplete="name"
                        className={inputClass}
                        placeholder="Your full name"
                        value={profile.fullName}
                        onChange={(e) => updateField("fullName", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Email address *</label>
                      <input
                        required
                        type="email"
                        autoComplete="email"
                        className={inputClass}
                        placeholder="you@example.com"
                        value={profile.email}
                        onChange={(e) => updateField("email", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Phone number</label>
                      <input
                        type="tel"
                        autoComplete="tel"
                        className={inputClass}
                        placeholder="+91 …"
                        value={profile.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Current location</label>
                      <input
                        className={inputClass}
                        placeholder="City, state, country"
                        value={profile.location}
                        onChange={(e) => updateField("location", e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Professional summary</label>
                      <textarea
                        rows={4}
                        className={inputClass}
                        placeholder="Summarize your background, strengths, and the work you want to do."
                        value={profile.summary}
                        onChange={(e) => updateField("summary", e.target.value)}
                      />
                      <p className="mt-2 text-xs text-slate-400">
                        Use real, verifiable details. The AI must not invent
                        qualifications or experience.
                      </p>
                    </div>
                  </div>
                </Section>

                <Section
                  number="02"
                  title="Technical skills"
                  description="Add languages, frameworks, databases, tools, and other relevant skills."
                >
                  <label className={labelClass}>
                    Skills <span className="font-normal text-slate-400">(one per line)</span>
                  </label>
                  <textarea
                    rows={5}
                    className={inputClass}
                    placeholder={"Java\nTypeScript\nSQL\nReact.js\nPostgreSQL"}
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {linesToArray(skillsText).slice(0, 12).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </Section>

                <Section
                  number="03"
                  title="Experience & education"
                  description="Add your real work history, internships, academic details, and certifications."
                >
                  <div className="space-y-5">
                    <div>
                      <label className={labelClass}>
                        Work experience <span className="font-normal text-slate-400">(one entry per line)</span>
                      </label>
                      <textarea
                        rows={4}
                        className={inputClass}
                        placeholder={"Software Engineer — Company — dates\nKey responsibilities and achievements"}
                        value={experienceText}
                        onChange={(e) => setExperienceText(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Education & certifications <span className="font-normal text-slate-400">(one entry per line)</span>
                      </label>
                      <textarea
                        rows={3}
                        className={inputClass}
                        placeholder={"Degree — University — graduation year\nCertification — issuing organization"}
                        value={educationText}
                        onChange={(e) => setEducationText(e.target.value)}
                      />
                    </div>
                  </div>
                </Section>

                <Section
                  number="04"
                  title="Projects"
                  description="Showcase projects with the technologies used and what you actually built."
                >
                  <label className={labelClass}>
                    Projects <span className="font-normal text-slate-400">(one project entry per line)</span>
                  </label>
                  <textarea
                    rows={5}
                    className={inputClass}
                    placeholder={"Streaming platform — Next.js, Prisma, PostgreSQL — describe your contribution\nTelegram file-link bot — TypeScript — describe your contribution"}
                    value={projectsText}
                    onChange={(e) => setProjectsText(e.target.value)}
                  />
                </Section>

                <Section
                  number="05"
                  title="Job preferences"
                  description="Tell the agent which opportunities to search for. You can change these at any time."
                >
                  <div className="space-y-5">
                    <div>
                      <label className={labelClass}>
                        Target job titles <span className="font-normal text-slate-400">(one per line)</span>
                      </label>
                      <textarea
                        rows={4}
                        className={inputClass}
                        placeholder={"Backend SDE\nGuidewire Developer\nFull-stack Developer\nJava Developer\nAI/ML Engineer"}
                        value={rolesText}
                        onChange={(e) => setRolesText(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>
                          Preferred locations <span className="font-normal text-slate-400">(one per line)</span>
                        </label>
                        <textarea
                          rows={3}
                          className={inputClass}
                          placeholder={"India\nRemote"}
                          value={locationsText}
                          onChange={(e) => setLocationsText(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Work arrangement</label>
                        <select
                          className={inputClass}
                          value={profile.preferences.remotePreference ?? "ANY"}
                          onChange={(e) =>
                            setProfile((current) => ({
                              ...current,
                              preferences: {
                                ...current.preferences,
                                remotePreference: e.target.value,
                              },
                            }))
                          }
                        >
                          <option value="ANY">Any arrangement</option>
                          <option value="REMOTE_ONLY">Remote only</option>
                          <option value="ONSITE_OR_HYBRID">On-site or hybrid</option>
                        </select>

                        <label className={`${labelClass} mt-5`}>
                          Minimum annual salary (INR)
                        </label>
                        <input
                          type="number"
                          min="0"
                          className={inputClass}
                          placeholder="Leave blank for no minimum"
                          value={profile.preferences.minSalaryAnnual ?? ""}
                          onChange={(e) =>
                            setProfile((current) => ({
                              ...current,
                              preferences: {
                                ...current.preferences,
                                minSalaryAnnual:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              },
                            }))
                          }
                        />
                        <p className="mt-2 text-xs text-slate-400">
                          Optional. Leave empty if salary is flexible.
                        </p>
                      </div>
                    </div>
                  </div>
                </Section>

                <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="text-sm">
                    <p className="font-semibold text-slate-800">
                      Keep your profile up to date
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Your changes are saved to your database when you submit.
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving profile…" : "Save profile"}
                    {!saving && <span aria-hidden="true">→</span>}
                  </button>
                </div>
              </form>
            )}
            {!loading && <ResumeManager />}
            <footer className="pb-6 text-center text-xs text-slate-400">
              CareerPilot · Your profile, your facts, your decisions.
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
