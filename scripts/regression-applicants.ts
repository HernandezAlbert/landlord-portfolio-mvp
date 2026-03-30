import assert from "node:assert/strict";
import {
  coerceGoogleSheetCsvUrl,
  getIncomeBreakdownFromRawPayload,
  mapGoogleFormRows,
  screenImportedApplicant,
} from "../lib/google-form-import";
import {
  applicantLooksDuplicate,
  buildApplicantDuplicateKeys,
} from "../lib/applicant-import-utils";
import { formatMoney } from "../lib/applicants";

function run() {
  const csv = [
    '"Timestamp","Full Name","Email Address","Phone Number","Employment Status","Approx Annual Income","Additional Income","Can you provide a guarantor if required?","Notes"',
    '"2026-03-29 10:15:00","Alice Smith","alice@example.com","07123 456789","Employed","36000","12000","Yes","Quoted note, with comma"',
    '"2026-03-29 11:20:00","Bob Jones","bob@example.com","07999 111222","Self employed","24000","","No","No extra income"',
  ].join("\n");

  const rows = mapGoogleFormRows(csv);
  assert.equal(rows.length, 2, "CSV parser should return two applicant rows");
  assert.equal(rows[0].fullName, "Alice Smith");
  assert.equal(rows[0].monthlyIncome, 400000, "Annual plus additional income should convert to monthly pence");
  assert.equal(rows[0].canProvideGuarantor, true);
  assert.equal(rows[0].notes, "Quoted note, with comma");

  const income = getIncomeBreakdownFromRawPayload(rows[0].rawPayload);
  assert.equal(income.baseMonthlyPence, 300000);
  assert.equal(income.additionalMonthlyPence, 100000);
  assert.equal(formatMoney(income.totalMonthlyPence), "£4,000.00");

  const pass = screenImportedApplicant(rows[0], 120000, {
    passMultiplier: 3,
    guarantorMinMultiplier: 2,
  });
  assert.equal(pass.screeningStatus, "ACCEPT");
  assert.equal(pass.decision, "REVIEW", "Pass should still remain in review until referencing is completed");

  const guarantor = screenImportedApplicant(
    {
      ...rows[1],
      canProvideGuarantor: true,
      monthlyIncome: 170000,
    },
    80000,
    {
      passMultiplier: 3,
      guarantorMinMultiplier: 2,
    },
  );
  assert.equal(guarantor.screeningStatus, "ACCEPT_WITH_GUARANTOR");
  assert.match(guarantor.screeningReason, /acceptable with a guarantor/i);

  const review = screenImportedApplicant(
    {
      ...rows[1],
      canProvideGuarantor: false,
      monthlyIncome: 152000,
    },
    80000,
    {
      passMultiplier: 3,
      guarantorMinMultiplier: 2,
    },
  );
  assert.equal(review.screeningStatus, "REVIEW");

  const decline = screenImportedApplicant(
    {
      ...rows[1],
      canProvideGuarantor: false,
      monthlyIncome: 90000,
    },
    80000,
    {
      passMultiplier: 3,
      guarantorMinMultiplier: 2,
    },
  );
  assert.equal(decline.screeningStatus, "DECLINE");

  const duplicate = applicantLooksDuplicate(
    [
      {
        importExternalKey: null,
        email: "alice@example.com",
        phone: "07123 456789",
        fullName: "Alice Smith",
        importSubmittedAt: new Date("2026-03-29T10:15:00Z"),
      },
    ],
    rows[0],
  );
  assert.ok(duplicate, "Duplicate detection should match on email + name");

  const keys = buildApplicantDuplicateKeys({
    importExternalKey: "abc123",
    email: "alice@example.com",
    phone: "07123 456789",
    fullName: "Alice Smith",
    importSubmittedAt: new Date("2026-03-29T10:15:00Z"),
  });
  assert.ok(keys.includes("external:abc123"));
  assert.ok(keys.some((key) => key.startsWith("email-name:")));
  assert.ok(keys.some((key) => key.startsWith("phone-name:")));

  const csvUrl = coerceGoogleSheetCsvUrl("https://docs.google.com/spreadsheets/d/TEST_ID/edit?gid=12345");
  assert.equal(csvUrl, "https://docs.google.com/spreadsheets/d/TEST_ID/export?format=csv&gid=12345");

  console.log("Applicant regression checks passed.");
}

run();
