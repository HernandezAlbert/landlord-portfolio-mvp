-- CreateEnum
CREATE TYPE "ComplianceType" AS ENUM ('GAS', 'EICR', 'EPC');

-- CreateEnum
CREATE TYPE "NoticeType" AS ENUM ('SECTION_8', 'SECTION_21', 'RENT_INCREASE', 'OTHER');

-- CreateEnum
CREATE TYPE "NoticeMethod" AS ENUM ('EMAIL', 'POST', 'HAND_DELIVERED', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('CALL', 'EMAIL', 'SMS', 'VISIT', 'NOTE');

-- CreateEnum
CREATE TYPE "ApplicantStatus" AS ENUM ('APPLIED', 'REFERENCING', 'APPROVED', 'DECLINED', 'REJECTED', 'MORE_INFO_REQUESTED', 'WITHDRAWN', 'HOLDING_DEPOSIT_PENDING', 'RESERVED', 'HOLDING_DEPOSIT_EXPIRED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('REPAIRS', 'MAINTENANCE', 'INSURANCE', 'UTILITIES', 'MORTGAGE_INTEREST', 'SERVICE_CHARGE', 'MANAGEMENT', 'FEES', 'OTHER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "HoldingDepositStatus" AS ENUM ('PENDING', 'RECEIVED', 'REFUNDED', 'RETAINED', 'APPLIED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HoldingDepositAppliedTo" AS ENUM ('FIRST_RENT', 'TENANCY_DEPOSIT');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('ANNUAL', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'READY', 'EXPORTED');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "GuarantorAssessmentStatus" AS ENUM ('PENDING', 'PASSED', 'CONDITIONAL', 'FAILED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "GuaranteeScope" AS ENUM ('RENT_ONLY', 'RENT_AND_DAMAGE', 'ALL_TENANCY_OBLIGATIONS');

-- CreateEnum
CREATE TYPE "GuarantorDocumentType" AS ENUM ('ID', 'PROOF_OF_ADDRESS', 'INCOME_PROOF', 'BANK_STATEMENT', 'CREDIT_REPORT', 'SIGNED_GUARANTEE', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "digestEmailTo" TEXT,
    "emailFromName" TEXT,
    "replyToEmail" TEXT,
    "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address1" TEXT NOT NULL,
    "address2" TEXT,
    "city" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "notes" TEXT,
    "googleFormImportEnabled" BOOLEAN NOT NULL DEFAULT false,
    "googleSheetId" TEXT,
    "googleSheetTabName" TEXT,
    "googleLastImportedRow" INTEGER,
    "googleLastCheckedAt" TIMESTAMP(3),
    "googleLastImportedAt" TIMESTAMP(3),
    "googleSyncError" TEXT,
    "screeningPassMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "screeningGuarantorMinMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "advertisedRentMonthly" INTEGER,
    "propertyLicenseExpiresOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "rightToRentExpiresOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenancy" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "rentMonthly" INTEGER NOT NULL,
    "rentDueDay" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "autoGenerateRent" BOOLEAN NOT NULL DEFAULT true,
    "lastRentGeneratedOn" TIMESTAMP(3),
    "rentGenerateMonthsAhead" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "Tenancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenancyTenant" (
    "tenancyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenancyTenant_pkey" PRIMARY KEY ("tenancyId","tenantId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountDue" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "paidDate" TIMESTAMP(3),
    "method" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceItem" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "ComplianceType" NOT NULL,
    "lastDone" TIMESTAMP(3),
    "expiresOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ComplianceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "lastDate" TIMESTAMP(3),
    "nextDue" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "type" "NoticeType" NOT NULL,
    "dateServed" TIMESTAMP(3) NOT NULL,
    "method" "NoticeMethod" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT,
    "text" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentStorageSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentStorageSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyTimeUtc" TEXT NOT NULL DEFAULT '08:00',
    "weeklyDay" INTEGER NOT NULL DEFAULT 1,
    "weeklyTimeUtc" TEXT NOT NULL DEFAULT '08:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MortgageDetail" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "lender" TEXT,
    "mortgageNumber" TEXT,
    "productName" TEXT,
    "productType" TEXT,
    "interestRate" DOUBLE PRECISION,
    "monthlyPayment" INTEGER,
    "productStartDate" TIMESTAMP(3),
    "productEndDate" TIMESTAMP(3),
    "mortgageTermStart" TIMESTAMP(3),
    "mortgageTermEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MortgageDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsurancePolicy" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "provider" TEXT,
    "policyNumber" TEXT,
    "coverType" TEXT,
    "annualPremium" INTEGER,
    "monthlyPremium" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenancyId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "vendor" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "receiptPath" TEXT,
    "receiptStoragePath" TEXT,
    "receiptOriginalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT,
    "tenantId" TEXT,
    "type" "ContactType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "subject" TEXT,
    "notes" TEXT NOT NULL,
    "nextFollowUp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Applicant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "employmentStatus" TEXT,
    "hasPets" BOOLEAN NOT NULL DEFAULT false,
    "monthlyIncome" INTEGER,
    "notes" TEXT,
    "petDetails" TEXT,
    "propertyId" TEXT,
    "requestedMoveIn" TIMESTAMP(3),
    "savingsBufferMonths" INTEGER,
    "status" "ApplicantStatus" NOT NULL DEFAULT 'APPLIED',
    "importExternalKey" TEXT,
    "importRawPayload" JSONB,
    "importSource" TEXT,
    "importSubmittedAt" TIMESTAMP(3),
    "screeningReason" TEXT,
    "screeningStatus" TEXT,
    "screeningSummary" TEXT,
    "screeningScore" INTEGER,
    "canProvideGuarantor" BOOLEAN,
    "guarantorRequired" BOOLEAN NOT NULL DEFAULT false,
    "guarantorAvailable" BOOLEAN,
    "guarantorOutcome" "GuarantorAssessmentStatus",
    "guarantorNotes" TEXT,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferencingCheck" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "idProvided" BOOLEAN NOT NULL DEFAULT false,
    "rightToRentChecked" BOOLEAN NOT NULL DEFAULT false,
    "payslipsProvided" BOOLEAN NOT NULL DEFAULT false,
    "bankStatementsProvided" BOOLEAN NOT NULL DEFAULT false,
    "employmentReference" BOOLEAN NOT NULL DEFAULT false,
    "landlordReference" BOOLEAN NOT NULL DEFAULT false,
    "creditCheckPassed" BOOLEAN,
    "incomeVerified" BOOLEAN NOT NULL DEFAULT false,
    "guarantorRequired" BOOLEAN NOT NULL DEFAULT false,
    "guarantorProvided" BOOLEAN NOT NULL DEFAULT false,
    "petInsuranceProvided" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "decision" TEXT,
    "manualDecision" TEXT,
    "manualDecisionReason" TEXT,
    "risks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferencingCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "note" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "propertyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoGenerate" BOOLEAN NOT NULL DEFAULT true,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "daysBeforeDue" INTEGER NOT NULL DEFAULT 7,
    "reminderDays" TEXT NOT NULL DEFAULT '14,7,3,1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRun" (
    "id" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "propertyId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalisedAt" TIMESTAMP(3),

    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "reportRunId" TEXT NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "rowsJson" JSONB NOT NULL,
    "warningsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guarantor" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "annualIncomePence" INTEGER,
    "dateOfBirth" TIMESTAMP(3),
    "relationshipToApplicant" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "employmentStatus" TEXT,
    "employerName" TEXT,
    "jobTitle" TEXT,
    "notes" TEXT,
    "deedSigned" BOOLEAN NOT NULL DEFAULT false,
    "deedSignedAt" TIMESTAMP(3),
    "assessmentScore" INTEGER,
    "assessmentSummary" TEXT,
    "assessmentStatus" "GuarantorAssessmentStatus" NOT NULL DEFAULT 'PENDING',
    "archivedAt" TIMESTAMP(3),
    "applicantId" TEXT,

    CONSTRAINT "Guarantor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoldingDeposit" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "propertyId" TEXT,
    "amountRequestedPence" INTEGER NOT NULL,
    "amountReceivedPence" INTEGER,
    "weeklyRentSnapshotPence" INTEGER,
    "receivedAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "status" "HoldingDepositStatus" NOT NULL DEFAULT 'PENDING',
    "outcomeReason" TEXT,
    "refundedAt" TIMESTAMP(3),
    "retainedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "appliedTo" "HoldingDepositAppliedTo",
    "consentToApply" BOOLEAN NOT NULL DEFAULT false,
    "tenancySignedConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HoldingDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_usedAt_idx" ON "PasswordResetToken"("usedAt");

-- CreateIndex
CREATE INDEX "Property_userId_idx" ON "Property"("userId");

-- CreateIndex
CREATE INDEX "Property_deletedAt_idx" ON "Property"("deletedAt");

-- CreateIndex
CREATE INDEX "Property_googleFormImportEnabled_idx" ON "Property"("googleFormImportEnabled");

-- CreateIndex
CREATE INDEX "Property_propertyLicenseExpiresOn_idx" ON "Property"("propertyLicenseExpiresOn");

-- CreateIndex
CREATE INDEX "Tenant_userId_idx" ON "Tenant"("userId");

-- CreateIndex
CREATE INDEX "Tenant_deletedAt_idx" ON "Tenant"("deletedAt");

-- CreateIndex
CREATE INDEX "Tenant_rightToRentExpiresOn_idx" ON "Tenant"("rightToRentExpiresOn");

-- CreateIndex
CREATE INDEX "Tenancy_propertyId_idx" ON "Tenancy"("propertyId");

-- CreateIndex
CREATE INDEX "Tenancy_isActive_idx" ON "Tenancy"("isActive");

-- CreateIndex
CREATE INDEX "Tenancy_deletedAt_idx" ON "Tenancy"("deletedAt");

-- CreateIndex
CREATE INDEX "Payment_tenancyId_dueDate_idx" ON "Payment"("tenancyId", "dueDate");

-- CreateIndex
CREATE INDEX "Payment_paidDate_idx" ON "Payment"("paidDate");

-- CreateIndex
CREATE INDEX "Payment_deletedAt_idx" ON "Payment"("deletedAt");

-- CreateIndex
CREATE INDEX "ComplianceItem_expiresOn_idx" ON "ComplianceItem"("expiresOn");

-- CreateIndex
CREATE INDEX "ComplianceItem_deletedAt_idx" ON "ComplianceItem"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceItem_propertyId_type_key" ON "ComplianceItem"("propertyId", "type");

-- CreateIndex
CREATE INDEX "Inspection_nextDue_idx" ON "Inspection"("nextDue");

-- CreateIndex
CREATE INDEX "Inspection_deletedAt_idx" ON "Inspection"("deletedAt");

-- CreateIndex
CREATE INDEX "Notice_tenancyId_dateServed_idx" ON "Notice"("tenancyId", "dateServed");

-- CreateIndex
CREATE INDEX "Notice_deletedAt_idx" ON "Notice"("deletedAt");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentStorageSetting_key_key" ON "DocumentStorageSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "MortgageDetail_propertyId_key" ON "MortgageDetail"("propertyId");

-- CreateIndex
CREATE INDEX "MortgageDetail_productEndDate_idx" ON "MortgageDetail"("productEndDate");

-- CreateIndex
CREATE INDEX "MortgageDetail_deletedAt_idx" ON "MortgageDetail"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InsurancePolicy_propertyId_key" ON "InsurancePolicy"("propertyId");

-- CreateIndex
CREATE INDEX "InsurancePolicy_renewalDate_idx" ON "InsurancePolicy"("renewalDate");

-- CreateIndex
CREATE INDEX "InsurancePolicy_deletedAt_idx" ON "InsurancePolicy"("deletedAt");

-- CreateIndex
CREATE INDEX "Expense_propertyId_date_idx" ON "Expense"("propertyId", "date");

-- CreateIndex
CREATE INDEX "Expense_tenancyId_idx" ON "Expense"("tenancyId");

-- CreateIndex
CREATE INDEX "Expense_deletedAt_idx" ON "Expense"("deletedAt");

-- CreateIndex
CREATE INDEX "ContactLog_tenancyId_date_idx" ON "ContactLog"("tenancyId", "date");

-- CreateIndex
CREATE INDEX "ContactLog_tenantId_date_idx" ON "ContactLog"("tenantId", "date");

-- CreateIndex
CREATE INDEX "ContactLog_nextFollowUp_idx" ON "ContactLog"("nextFollowUp");

-- CreateIndex
CREATE INDEX "ContactLog_deletedAt_idx" ON "ContactLog"("deletedAt");

-- CreateIndex
CREATE INDEX "Applicant_userId_idx" ON "Applicant"("userId");

-- CreateIndex
CREATE INDEX "Applicant_propertyId_idx" ON "Applicant"("propertyId");

-- CreateIndex
CREATE INDEX "Applicant_status_idx" ON "Applicant"("status");

-- CreateIndex
CREATE INDEX "Applicant_deletedAt_idx" ON "Applicant"("deletedAt");

-- CreateIndex
CREATE INDEX "Applicant_screeningStatus_idx" ON "Applicant"("screeningStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_userId_importExternalKey_key" ON "Applicant"("userId", "importExternalKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReferencingCheck_applicantId_key" ON "ReferencingCheck"("applicantId");

-- CreateIndex
CREATE INDEX "ActionOverride_userId_idx" ON "ActionOverride"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionOverride_userId_key_key" ON "ActionOverride"("userId", "key");

-- CreateIndex
CREATE INDEX "Guarantor_applicantId_idx" ON "Guarantor"("applicantId");

-- CreateIndex
CREATE INDEX "Guarantor_archivedAt_idx" ON "Guarantor"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HoldingDeposit_applicantId_key" ON "HoldingDeposit"("applicantId");

-- CreateIndex
CREATE INDEX "HoldingDeposit_applicantId_status_idx" ON "HoldingDeposit"("applicantId", "status");

-- CreateIndex
CREATE INDEX "HoldingDeposit_propertyId_status_idx" ON "HoldingDeposit"("propertyId", "status");

-- CreateIndex
CREATE INDEX "HoldingDeposit_deadlineAt_idx" ON "HoldingDeposit"("deadlineAt");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyTenant" ADD CONSTRAINT "TenancyTenant_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyTenant" ADD CONSTRAINT "TenancyTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceItem" ADD CONSTRAINT "ComplianceItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MortgageDetail" ADD CONSTRAINT "MortgageDetail_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferencingCheck" ADD CONSTRAINT "ReferencingCheck_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionOverride" ADD CONSTRAINT "ActionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_reportRunId_fkey" FOREIGN KEY ("reportRunId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guarantor" ADD CONSTRAINT "Guarantor_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldingDeposit" ADD CONSTRAINT "HoldingDeposit_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldingDeposit" ADD CONSTRAINT "HoldingDeposit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
