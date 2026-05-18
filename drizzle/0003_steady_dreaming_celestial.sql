CREATE TABLE "staff_member_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_member_id" uuid NOT NULL,
	"group_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_member_groups" ADD CONSTRAINT "staff_member_groups_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_member_groups" ADD CONSTRAINT "staff_member_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_member_groups_staff_member_id_idx" ON "staff_member_groups" USING btree ("staff_member_id");--> statement-breakpoint
CREATE INDEX "staff_member_groups_group_id_idx" ON "staff_member_groups" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_member_groups_staff_member_id_group_id_idx" ON "staff_member_groups" USING btree ("staff_member_id","group_id");