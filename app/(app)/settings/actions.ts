"use server";

import { redirect } from "next/navigation";
import { recalculateAllApplicants } from "@/lib/applicant-recalculation";

export async function recalculateAllApplicantsAction() {
  const results = await recalculateAllApplicants();
  redirect(`/settings?recalc=${results.length}`);
}