CREATE TYPE "public"."shift_schedule_plan_status" AS ENUM('active', 'archived');--> statement-breakpoint
ALTER TABLE "shift_schedule_plans" ADD COLUMN "week_start" date;--> statement-breakpoint
ALTER TABLE "shift_schedule_plans" ADD COLUMN "status" "shift_schedule_plan_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
UPDATE "shift_schedule_plans"
SET "week_start" = date_trunc('week', "created_at" AT TIME ZONE 'UTC')::date;--> statement-breakpoint
ALTER TABLE "shift_schedule_plans" ALTER COLUMN "week_start" SET NOT NULL;--> statement-breakpoint
WITH ranked_plans AS (
	SELECT "id", row_number() OVER (
		PARTITION BY "group_id", "week_start"
		ORDER BY "created_at" DESC, "id" DESC
	) AS plan_rank
	FROM "shift_schedule_plans"
)
UPDATE "shift_schedule_plans"
SET "status" = 'archived'
FROM ranked_plans
WHERE "shift_schedule_plans"."id" = ranked_plans."id"
	AND ranked_plans.plan_rank > 1;--> statement-breakpoint
CREATE INDEX "shift_schedule_plans_week_start_status_idx" ON "shift_schedule_plans" USING btree ("week_start","status");
