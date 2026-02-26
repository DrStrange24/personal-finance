-- Sprint 2: Entity Scope Refactor (WS2)
-- Ordered migration:
-- 1) add nullable entityId columns
-- 2) ensure default entity exists per user when missing
-- 3) backfill entityId values
-- 4) fail fast on nulls/orphans/duplicates
-- 5) enforce NOT NULL + FKs + indexes + active-only uniqueness

ALTER TABLE "CreditAccount"
    ADD COLUMN IF NOT EXISTS "entityId" TEXT;

ALTER TABLE "Investment"
    ADD COLUMN IF NOT EXISTS "entityId" TEXT;

-- Ensure every user has at least one active entity for fallback backfill.
INSERT INTO "FinanceEntity" ("id", "userId", "name", "type", "isArchived", "createdAt", "updatedAt")
SELECT
    CONCAT('fe_s2_personal_', md5(u."id" || ':' || NOW()::text || ':' || random()::text)) AS "id",
    u."id" AS "userId",
    'Personal' AS "name",
    'PERSONAL'::"EntityType" AS "type",
    false AS "isArchived",
    NOW() AS "createdAt",
    NOW() AS "updatedAt"
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1
    FROM "FinanceEntity" fe
    WHERE fe."userId" = u."id"
      AND fe."isArchived" = false
);

WITH preferred_entity AS (
    SELECT
        u."id" AS "userId",
        COALESCE(
            (
                SELECT fe."id"
                FROM "FinanceEntity" fe
                WHERE fe."userId" = u."id"
                  AND fe."isArchived" = false
                  AND fe."name" = 'Personal'
                  AND fe."type" = 'PERSONAL'::"EntityType"
                ORDER BY fe."createdAt" ASC
                LIMIT 1
            ),
            (
                SELECT fe."id"
                FROM "FinanceEntity" fe
                WHERE fe."userId" = u."id"
                  AND fe."isArchived" = false
                ORDER BY fe."createdAt" ASC
                LIMIT 1
            )
        ) AS "entityId"
    FROM "User" u
)
UPDATE "CreditAccount" ca
SET "entityId" = pe."entityId"
FROM preferred_entity pe
WHERE ca."entityId" IS NULL
  AND ca."userId" = pe."userId";

WITH preferred_entity AS (
    SELECT
        u."id" AS "userId",
        COALESCE(
            (
                SELECT fe."id"
                FROM "FinanceEntity" fe
                WHERE fe."userId" = u."id"
                  AND fe."isArchived" = false
                  AND fe."name" = 'Personal'
                  AND fe."type" = 'PERSONAL'::"EntityType"
                ORDER BY fe."createdAt" ASC
                LIMIT 1
            ),
            (
                SELECT fe."id"
                FROM "FinanceEntity" fe
                WHERE fe."userId" = u."id"
                  AND fe."isArchived" = false
                ORDER BY fe."createdAt" ASC
                LIMIT 1
            )
        ) AS "entityId"
    FROM "User" u
)
UPDATE "Investment" i
SET "entityId" = pe."entityId"
FROM preferred_entity pe
WHERE i."entityId" IS NULL
  AND i."userId" = pe."userId";

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "CreditAccount" WHERE "entityId" IS NULL) THEN
        RAISE EXCEPTION 'Sprint 2 backfill failed: CreditAccount has NULL entityId rows.';
    END IF;

    IF EXISTS (SELECT 1 FROM "Investment" WHERE "entityId" IS NULL) THEN
        RAISE EXCEPTION 'Sprint 2 backfill failed: Investment has NULL entityId rows.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "CreditAccount" ca
        LEFT JOIN "FinanceEntity" fe ON fe."id" = ca."entityId"
        WHERE fe."id" IS NULL OR fe."userId" <> ca."userId"
    ) THEN
        RAISE EXCEPTION 'Sprint 2 backfill failed: CreditAccount has orphaned or cross-user entity references.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "Investment" i
        LEFT JOIN "FinanceEntity" fe ON fe."id" = i."entityId"
        WHERE fe."id" IS NULL OR fe."userId" <> i."userId"
    ) THEN
        RAISE EXCEPTION 'Sprint 2 backfill failed: Investment has orphaned or cross-user entity references.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "CreditAccount"
        WHERE "isArchived" = false
        GROUP BY "userId", "entityId", "name"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Sprint 2 duplicate guard failed: active CreditAccount duplicates exist within (userId, entityId, name).';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "Investment"
        WHERE "isArchived" = false
        GROUP BY "userId", "entityId", "name"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Sprint 2 duplicate guard failed: active Investment duplicates exist within (userId, entityId, name).';
    END IF;
END
$$;

ALTER TABLE "CreditAccount"
    ALTER COLUMN "entityId" SET NOT NULL;

ALTER TABLE "Investment"
    ALTER COLUMN "entityId" SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'CreditAccount_entityId_fkey'
    ) THEN
        ALTER TABLE "CreditAccount"
            ADD CONSTRAINT "CreditAccount_entityId_fkey"
            FOREIGN KEY ("entityId")
            REFERENCES "FinanceEntity"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Investment_entityId_fkey'
    ) THEN
        ALTER TABLE "Investment"
            ADD CONSTRAINT "Investment_entityId_fkey"
            FOREIGN KEY ("entityId")
            REFERENCES "FinanceEntity"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "CreditAccount_entityId_idx"
    ON "CreditAccount"("entityId");

CREATE INDEX IF NOT EXISTS "CreditAccount_entityId_isArchived_name_idx"
    ON "CreditAccount"("entityId", "isArchived", "name");

CREATE INDEX IF NOT EXISTS "CreditAccount_userId_entityId_isArchived_name_idx"
    ON "CreditAccount"("userId", "entityId", "isArchived", "name");

CREATE INDEX IF NOT EXISTS "Investment_entityId_idx"
    ON "Investment"("entityId");

CREATE INDEX IF NOT EXISTS "Investment_entityId_isArchived_name_idx"
    ON "Investment"("entityId", "isArchived", "name");

CREATE INDEX IF NOT EXISTS "Investment_userId_entityId_isArchived_name_idx"
    ON "Investment"("userId", "entityId", "isArchived", "name");

CREATE INDEX IF NOT EXISTS "Investment_entityId_createdAt_idx"
    ON "Investment"("entityId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CreditAccount_userId_entityId_name_active_key"
    ON "CreditAccount"("userId", "entityId", "name")
    WHERE "isArchived" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "Investment_userId_entityId_name_active_key"
    ON "Investment"("userId", "entityId", "name")
    WHERE "isArchived" = false;
