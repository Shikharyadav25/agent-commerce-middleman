-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "razorpayKeyId" TEXT NOT NULL,
    "sellingPolicy" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "stock" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "pairsWith" TEXT[],
    "tags" TEXT[],

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MandateTemplate" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "maxPerTransaction" INTEGER NOT NULL,
    "dailyCap" INTEGER NOT NULL,
    "autoApproveThreshold" INTEGER NOT NULL,
    "allowedCategories" TEXT[],

    CONSTRAINT "MandateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mandate" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "signedPayload" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxPerTransaction" INTEGER NOT NULL,
    "dailyCap" INTEGER NOT NULL,
    "autoApproveThreshold" INTEGER NOT NULL,
    "allowedCategories" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "total" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogRow" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "transactionId" TEXT,
    "step" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "ruleId" TEXT,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingApproval" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedBy" TEXT,
    "decision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_merchantId_sku_key" ON "Product"("merchantId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_apiKeyHash_key" ON "Agent"("apiKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_correlationId_key" ON "Transaction"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_quoteId_key" ON "Transaction"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingApproval_transactionId_key" ON "PendingApproval"("transactionId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandateTemplate" ADD CONSTRAINT "MandateTemplate_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogRow" ADD CONSTRAINT "AuditLogRow_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingApproval" ADD CONSTRAINT "PendingApproval_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
