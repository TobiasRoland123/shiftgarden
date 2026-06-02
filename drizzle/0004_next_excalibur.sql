CREATE TABLE "shift_schedule_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"input_json" jsonb NOT NULL,
	"warnings" jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_schedule_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shift_schedule_plans" ADD CONSTRAINT "shift_schedule_plans_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_schedule_shifts" ADD CONSTRAINT "shift_schedule_shifts_plan_id_shift_schedule_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."shift_schedule_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_schedule_shifts" ADD CONSTRAINT "shift_schedule_shifts_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shift_schedule_plans_group_id_idx" ON "shift_schedule_plans" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "shift_schedule_plans_created_at_idx" ON "shift_schedule_plans" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "shift_schedule_shifts_plan_id_idx" ON "shift_schedule_shifts" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "shift_schedule_shifts_staff_member_id_idx" ON "shift_schedule_shifts" USING btree ("staff_member_id");--> statement-breakpoint
CREATE INDEX "shift_schedule_shifts_day_of_week_idx" ON "shift_schedule_shifts" USING btree ("day_of_week");