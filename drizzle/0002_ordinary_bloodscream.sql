CREATE TABLE "group_staff_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"min_pedagogs" integer NOT NULL,
	"min_staff" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_staff_rules" ADD CONSTRAINT "group_staff_rules_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_staff_rules_group_id_idx" ON "group_staff_rules" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_staff_rules_day_of_week_idx" ON "group_staff_rules" USING btree ("day_of_week");