"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GuarantorForm({
  applicantId,
}: {
  applicantId?: string;
}) {
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    annualIncome: "",
  });

  const [loading, setLoading] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/guarantors", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        applicantId,
        annualIncomePence: form.annualIncome
          ? Math.round(Number(form.annualIncome) * 100)
          : null,
      }),
    });

    if (res.ok) {
      const data = await res.json();

      if (applicantId) {
        router.push(`/applicants/${applicantId}`);
      } else {
        router.push(`/guarantors/${data.id}`);
      }
    } else {
      alert("Failed to create guarantor");
    }

    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <input
          name="firstName"
          placeholder="First name"
          value={form.firstName}
          onChange={handleChange}
          required
          className="border p-2 rounded"
        />

        <input
          name="lastName"
          placeholder="Last name"
          value={form.lastName}
          onChange={handleChange}
          required
          className="border p-2 rounded"
        />
      </div>

      <input
        name="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
        className="border p-2 rounded w-full"
      />

      <input
        name="phone"
        placeholder="Phone"
        value={form.phone}
        onChange={handleChange}
        className="border p-2 rounded w-full"
      />

      <input
        name="annualIncome"
        placeholder="Annual income (£)"
        value={form.annualIncome}
        onChange={handleChange}
        className="border p-2 rounded w-full"
      />

      <button
        type="submit"
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded"
      >
        {loading ? "Saving..." : "Save Guarantor"}
      </button>
    </form>
  );
}