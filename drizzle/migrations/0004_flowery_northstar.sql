CREATE TYPE "public"."plan_run_status" AS ENUM('pending', 'valid', 'invalid', 'failed');--> statement-breakpoint
CREATE TABLE "planning_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"min_pedagogue_ratio" real NOT NULL,
	"min_staff_ratio" real NOT NULL,
	"break_minutes" integer NOT NULL,
	"break_threshold_hours" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_runs" RENAME COLUMN "params" TO "input_snapshot";--> statement-breakpoint
ALTER TABLE "absences" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "absences" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
UPDATE "absences" SET "starts_at" = "date"::timestamp with time zone, "ends_at" = ("date"::timestamp with time zone + interval '1 day');--> statement-breakpoint
ALTER TABLE "absences" ALTER COLUMN "starts_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "absences" ALTER COLUMN "ends_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_runs" ADD COLUMN "status" "plan_run_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_runs" ADD COLUMN "ai_output" jsonb;--> statement-breakpoint
ALTER TABLE "plan_runs" ADD COLUMN "validation_result" jsonb;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "absences" DROP COLUMN "date";--> statement-breakpoint
ALTER TABLE "plan_runs" DROP COLUMN "score";
