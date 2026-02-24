-- Preserve existing balances by renaming the column in-place.
ALTER TABLE "WalletAccount"
RENAME COLUMN "currentBalancePhp" TO "currentBalanceAmount";
