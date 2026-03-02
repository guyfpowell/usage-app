-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "insertedCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "isRolledBack" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadBatchRecord" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "recordId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "previousState" JSONB,

    CONSTRAINT "UploadBatchRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UploadBatchRecord" ADD CONSTRAINT "UploadBatchRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "UploadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
