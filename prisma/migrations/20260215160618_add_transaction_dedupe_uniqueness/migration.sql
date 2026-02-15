-- CreateIndex
CREATE UNIQUE INDEX "transaction_dedupe_fields_key" ON "Transaction"("accountId", "bookingDate", "amountNok", "normalizedMerchant", "paymentType");
