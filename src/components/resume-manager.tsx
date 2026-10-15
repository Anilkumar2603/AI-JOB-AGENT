"use client";

import { useCallback, useEffect, useState } from "react";

type UploadedResume = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string;
  status: "READY" | "FAILED";
  errorMessage?: string | null;
  createdAt: string;
};

function formatSize(bytes: number) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function ResumeManager() {
  const [resumes, setResumes] = useState<UploadedResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadResumes = useCallback(async () => {
    try {
      const response = await fetch("/api/resumes", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load resumes.");
      }

      setResumes(data.resumes ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load resumes.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResumes();
  }, [loadResumes]);

  async function uploadResume(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const form = event.currentTarget;
    const input = form.elements.namedItem("file");

    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) {
      setError("Choose a PDF resume first.");
      return;
    }

    const file = input.files[0];

    if (file.size > 8 * 1024 * 1024) {
      setError("The PDF must be 8 MB or smaller.");
      return;
    }

    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/resumes", {
        method: "POST",
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Resume upload failed.");
      }

      setMessage("Resume uploaded and text extracted successfully.");
      form.reset();
      await loadResumes();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Resume upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function deleteResume(id: string) {
    if (!window.confirm("Delete this uploaded resume permanently?")) {
      return;
    }

    setError("");
    setMessage("");
    setDeletingId(id);

    try {
      const response = await fetch(`/api/resumes/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Resume deletion failed.");
      }

      setResumes((current) => current.filter((item) => item.id !== id));
      setMessage("Resume deleted.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Resume deletion failed.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
          <span aria-hidden="true">▤</span>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Master resume
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Upload your original PDF. CareerPilot will extract its text
            so you can use it as the basis for job-specific resume drafts.
          </p>
        </div>
      </div>

      <form onSubmit={uploadResume} className="space-y-4">
        <label
          htmlFor="resume-file"
          className="block text-sm font-medium text-slate-700"
        >
          Resume PDF
        </label>

        <input
          id="resume-file"
          name="file"
          type="file"
          accept=".pdf,application/pdf"
          required
          disabled={uploading}
          className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:font-semibold file:text-indigo-700"
        />

        <p className="text-xs text-slate-400">
          PDF only · Maximum 8 MB · Text-based PDFs only for now
        </p>

        <button
          type="submit"
          disabled={uploading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? "Uploading and extracting…" : "Upload resume"}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}

      <div className="mt-7 border-t border-slate-100 pt-5">
        <h3 className="font-semibold text-slate-900">
          Uploaded resumes
        </h3>

        {loading ? (
          <p className="mt-3 text-sm text-slate-500">
            Loading resumes…
          </p>
        ) : resumes.length === 0 ? (
          <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No resume uploaded yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {resumes.map((resume) => (
              <article
                key={resume.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-slate-900">
                      {resume.originalName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatSize(resume.sizeBytes)} ·{" "}
                      {new Date(resume.createdAt).toLocaleDateString()}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                      {resume.status === "READY"
                        ? "Text extracted"
                        : "Processing failed"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void deleteResume(resume.id)}
                    disabled={deletingId === resume.id}
                    className="self-start rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {deletingId === resume.id ? "Deleting…" : "Delete"}
                  </button>
                </div>

                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-indigo-700">
                    Preview extracted text
                  </summary>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                    {resume.extractedText}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}