import { prisma } from "../lib/prisma";
import { recalculateAllApplicants } from "../lib/applicant-recalculation";

async function main() {
  const results = await recalculateAllApplicants();

  console.log(`Found ${results.length} applicants\n`);

  results.forEach((result, index) => {
    console.log(
      `${index + 1}/${results.length} -> ${result.fullName} -> ${result.effectiveDecision} | score=${result.referencing.score} | screening=${result.screeningData.screeningStatus ?? "n/a"}`,
    );
  });

  console.log("\nDone.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });