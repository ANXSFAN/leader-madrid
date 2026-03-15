-- AlterTable
ALTER TABLE "users" ADD COLUMN     "b2bAppliedAt" TIMESTAMP(3),
ADD COLUMN     "b2bRejectionReason" TEXT,
ADD COLUMN     "b2bReviewedAt" TIMESTAMP(3),
ADD COLUMN     "companyCity" TEXT,
ADD COLUMN     "companyStreet" TEXT,
ADD COLUMN     "companyZip" TEXT,
ADD COLUMN     "phoneCountryCode" TEXT,
ADD COLUMN     "registrationCountry" TEXT,
ADD COLUMN     "vatVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vatVerifiedAddress" TEXT,
ADD COLUMN     "vatVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "vatVerifiedName" TEXT;
