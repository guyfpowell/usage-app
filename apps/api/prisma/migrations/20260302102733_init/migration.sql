-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" SERIAL NOT NULL,
    "traceId" TEXT,
    "userId" TEXT NOT NULL,
    "requestTime" TIMESTAMP(3) NOT NULL,
    "requestContent" TEXT NOT NULL,
    "responseContent" TEXT NOT NULL,
    "feedbackValue" TEXT,
    "rationale" TEXT,
    "toolRoute" TEXT NOT NULL,
    "ttftSeconds" DOUBLE PRECISION,
    "isInternal" BOOLEAN NOT NULL,
    "hasFeedback" BOOLEAN NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'To be classified',
    "groupText" TEXT,
    "ticketText" TEXT,
    "jiraIssueKey" TEXT,
    "jiraIssueUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalDomain" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,

    CONSTRAINT "InternalDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classification" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Classification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageRecord_toolRoute_idx" ON "UsageRecord"("toolRoute");

-- CreateIndex
CREATE INDEX "UsageRecord_isInternal_idx" ON "UsageRecord"("isInternal");

-- CreateIndex
CREATE INDEX "UsageRecord_hasFeedback_idx" ON "UsageRecord"("hasFeedback");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_userId_requestTime_key" ON "UsageRecord"("userId", "requestTime");

-- CreateIndex
CREATE UNIQUE INDEX "InternalDomain_domain_key" ON "InternalDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Classification_name_key" ON "Classification"("name");
