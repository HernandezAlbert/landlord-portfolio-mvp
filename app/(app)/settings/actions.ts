"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  isAdminEmail,
  requireAdminSessionUser,
  requireSessionUser,
} from "@/lib/auth";
import {
  recalculateAllApplicants,
  recalculateAllApplicantsForUser,
} from "@/lib/applicant-recalculation";
import {
  DOCUMENT_STORAGE_KEYS,
  saveDocumentStorageSettings,
  type DocumentStorageKey,
} from "@/lib/document-storage";

function toNullableTrimmedString(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str ? str : null;
}

export async function saveUserSettingsAction(formData: FormData) {
  const sessionUser = await requireSessionUser();

  const digestEmailTo = toNullableTrimmedString(formData.get("digestEmailTo"));
  const emailFromName = toNullableTrimmedString(formData.get("emailFromName"));
  const replyToEmail = toNullableTrimmedString(formData.get("replyToEmail"));
  const timezone =
    toNullableTrimmedString(formData.get("timezone")) ?? "Europe/London";
  const digestEnabled = formData.get("digestEnabled") === "on";

  await prisma.userSettings.upsert({
    where: { userId: sessionUser.id },
    update: {
      digestEmailTo,
      emailFromName,
      replyToEmail,
      timezone,
      digestEnabled,
    },
    create: {
      userId: sessionUser.id,
      digestEmailTo: digestEmailTo ?? sessionUser.email,
      emailFromName,
      replyToEmail: replyToEmail ?? sessionUser.email,
      timezone,
      digestEnabled,
    },
  });

  redirect("/settings?saved=profile");
}

export async function recalculateMyApplicantsAction() {
  const sessionUser = await requireSessionUser();
  const results = await recalculateAllApplicantsForUser(sessionUser.id);
  redirect(`/settings?recalcMine=${results.length}`);
}

export async function recalculateAllApplicantsAdminAction() {
  const adminUser = await requireAdminSessionUser();
  const results = await recalculateAllApplicants();
  redirect(
    `/settings?recalcAll=${results.length}&admin=${encodeURIComponent(
      adminUser.email
    )}`
  );
}

export async function saveDocumentStorageSettingsAdminAction(formData: FormData) {
  await requireAdminSessionUser();

  const values: Partial<Record<DocumentStorageKey, string>> = {};
  for (const key of DOCUMENT_STORAGE_KEYS) {
    values[key] = String(formData.get(key) ?? "").trim();
  }

  await saveDocumentStorageSettings(values);
  redirect("/settings?saved=document-storage");
}

export async function ensureMissingUserSettingsAdminAction() {
  await requireAdminSessionUser();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      settings: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let createdCount = 0;

  for (const user of users) {
    if (user.settings) continue;

    await prisma.userSettings.create({
      data: {
        userId: user.id,
        digestEmailTo: user.email,
        replyToEmail: user.email,
      },
    });

    createdCount += 1;
  }

  redirect(`/settings?ensuredSettings=${createdCount}`);
}

export async function deleteUserAdminAction(formData: FormData) {
  const adminUser = await requireAdminSessionUser();
  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    redirect("/settings?adminError=Missing%20user%20id");
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      id: true,
      email: true,
    },
  });

  if (!targetUser) {
    redirect("/settings?adminError=User%20not%20found");
  }

  if (isAdminEmail(targetUser.email)) {
    redirect("/settings?adminError=Admin%20user%20cannot%20be%20deleted");
  }

  await prisma.user.delete({
    where: { id: targetUser.id },
  });

  redirect(
    `/settings?deletedUser=${encodeURIComponent(
      targetUser.email
    )}&admin=${encodeURIComponent(adminUser.email)}`
  );
}
