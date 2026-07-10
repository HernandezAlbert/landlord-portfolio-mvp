-- AlterTable
ALTER TABLE "ApplicantDocument" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ApplicantDocument" ADD COLUMN "tenancyId" TEXT;

-- CreateIndex
CREATE INDEX "ApplicantDocument_tenantId_idx" ON "ApplicantDocument"("tenantId");

-- CreateIndex
CREATE INDEX "ApplicantDocument_tenancyId_idx" ON "ApplicantDocument"("tenancyId");

-- AddForeignKey
ALTER TABLE "ApplicantDocument" ADD CONSTRAINT "ApplicantDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantDocument" ADD CONSTRAINT "ApplicantDocument_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
