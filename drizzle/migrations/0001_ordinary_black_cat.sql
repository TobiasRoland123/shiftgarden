CREATE TYPE "public"."absence_type" AS ENUM('sick', 'vacation', 'other');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('pædagog', 'medhjælper', 'vikar');--> statement-breakpoint
CREATE TYPE "public"."shift_source" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TABLE "absences" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"date" date NOT NULL,
	"type" "absence_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"open_time" time NOT NULL,
	"close_time" time NOT NULL,
	"expected_children" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"params" jsonb,
	"score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"group_id" text NOT NULL,
	"date" date NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"source" "shift_source" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role" "role" NOT NULL,
	"weekly_contract_hours" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "staff_availability" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staffing_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"min_staff" integer NOT NULL,
	"min_pedagoger" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_availability" ADD CONSTRAINT "staff_availability_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staffing_rules" ADD CONSTRAINT "staffing_rules_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_availability_staff_id_idx" ON "staff_availability" USING btree ("staff_id");