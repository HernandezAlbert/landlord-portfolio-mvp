"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type GuarantorFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  annualIncome: string;
  dateOfBirth: string;
  relationshipToApplicant: string;
  address1: string;
  address2: string;
  city: string;
  postcode: string;
  employmentStatus: string;
  employerName: string;
  jobTitle: string;
  notes: string;
  deedSigned: boolean;
};

type InitialData = Partial<GuarantorFormValues>;

function poundsToPence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export default function GuarantorForm({
  applicantId,
  guarantorId,
  initialData,
}: {
  applicantId?: string | null;
  guarantorId?: string;
  initialData?: InitialData;
}) {
  const router = useRouter();
  const isEdit = Boolean(guarantorId);

  const [form, setForm] = useState<GuarantorFormValues>({
    firstName: initialData?.firstName ?? "",
    lastName: initialData?.lastName ?? "",
    email: initialData?.email ?? "",
    phone: initialData?.phone ?? "",
    annualIncome: initialData?.annualIncome ?? "",
    dateOfBirth: initialData?.dateOfBirth ?? "",
    relationshipToApplicant: initialData?.relationshipToApplicant ?? "",
    address1: initialData?.address1 ?? "",
    address2: initialData?.address2 ?? "",
    city: initialData?.city ?? "",
    postcode: initialData?.postcode ?? "",
    employmentStatus: initialData?.employmentStatus ?? "",
    employerName: initialData?.employerName ?? "",
    jobTitle: initialData?.jobTitle ?? "",
    notes: initialData?.notes ?? "",
    deedSigned: initialData?.deedSigned ?? false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, type } = e.target;
    const value =
      type === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : e.target.value;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        isEdit ? `/api/guarantors/${guarantorId}` : "/api/guarantors",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            applicantId,
            annualIncomePence: poundsToPence(form.annualIncome),
            deedSignedAt: form.deedSigned ? new Date().toISOString() : null,
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to save guarantor");
      }

      const data = await res.json();

      if (applicantId) {
        router.push(`/applicants/${applicantId}`);
      } else {
        router.push(`/guarantors/${data.id ?? guarantorId}`);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save guarantor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-800">First name</span>
          <input
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            required
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-800">Last name</span>
          <input
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            required
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-800">Email</span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-800">Phone</span>
          <input
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-800">Date of birth</span>
          <input
            name="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-800">Relationship to applicant</span>
          <input
            name="relationshipToApplicant"
            value={form.relationshipToApplicant}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-800">Address line 1</span>
          <input
            name="address1"
            value={form.address1}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-800">Address line 2</span>
          <input
            name="address2"
            value={form.address2}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-800">City</span>
          <input
            name="city"
            value={form.city}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-800">Postcode</span>
          <input
            name="postcode"
            value={form.postcode}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-800">Employment status</span>
          <input
            name="employmentStatus"
            value={form.employmentStatus}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-800">Job title</span>
          <input
            name="jobTitle"
            value={form.jobTitle}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-800">Employer name</span>
          <input
            name="employerName"
            value={form.employerName}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-800">Annual income (£)</span>
          <input
            name="annualIncome"
            type="number"
            min="0"
            step="0.01"
            value={form.annualIncome}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm">
          <input
            name="deedSigned"
            type="checkbox"
            checked={form.deedSigned}
            onChange={handleChange}
          />
          <span>Guarantee deed signed</span>
        </label>

        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-800">Notes</span>
          <textarea
            name="notes"
            rows={4}
            value={form.notes}
            onChange={handleChange}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Saving..." : isEdit ? "Save guarantor" : "Create guarantor"}
      </button>
    </form>
  );
}