const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const referencingDeleted = await prisma.referencingCheck.deleteMany({});
  const applicantsDeleted = await prisma.applicant.deleteMany({});

  console.log("Deleted referencing checks:", referencingDeleted.count);
  console.log("Deleted applicants:", applicantsDeleted.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });