CREATE TYPE "public"."shift_schedule_generation_attempt_status" AS ENUM('validation_failed', 'accepted');--> statement-breakpoint
CREATE TABLE "shift_schedule_generation_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"status" "shift_schedule_generation_attempt_status" NOT NULL,
	"attempt_number" integer NOT NULL,
	"model" text NOT NULL,
	"input_json" jsonb NOT NULL,
	"output_json" jsonb NOT NULL,
	"validation_errors" jsonb NOT NULL,
	"accepted_plan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '30 days' NOT NULL,
	CONSTRAINT "shift_schedule_generation_attempts_attempt_number_check" CHECK ("shift_schedule_generation_attempts"."attempt_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "shift_schedule_generation_attempts" ADD CONSTRAINT "shift_schedule_generation_attempts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_schedule_generation_attempts" ADD CONSTRAINT "shift_schedule_generation_attempts_accepted_plan_id_shift_schedule_plans_id_fk" FOREIGN KEY ("accepted_plan_id") REFERENCES "public"."shift_schedule_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shift_schedule_generation_attempts_generation_attempt_idx" ON "shift_schedule_generation_attempts" USING btree ("generation_id","attempt_number");--> statement-breakpoint
CREATE INDEX "shift_schedule_generation_attempts_group_id_idx" ON "shift_schedule_generation_attempts" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "shift_schedule_generation_attempts_accepted_plan_id_idx" ON "shift_schedule_generation_attempts" USING btree ("accepted_plan_id");--> statement-breakpoint
CREATE INDEX "shift_schedule_generation_attempts_expires_at_idx" ON "shift_schedule_generation_attempts" USING btree ("expires_at");