CREATE TYPE "public"."day_of_week" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('pedagog', 'assistant', 'substitute');--> statement-breakpoint
CREATE TABLE "staff_member_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"start_availability_time" time NOT NULL,
	"end_availability_time" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role" "staff_role" NOT NULL,
	"max_hours_per_week" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_member_availability" ADD CONSTRAINT "staff_member_availability_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_member_availability_staff_member_id_idx" ON "staff_member_availability" USING btree ("staff_member_id");--> statement-breakpoint
CREATE INDEX "staff_member_availability_day_of_week_idx" ON "staff_member_availability" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "staff_members_role_idx" ON "staff_members" USING btree ("role");