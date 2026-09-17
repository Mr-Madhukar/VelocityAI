ALTER TABLE "prd" ADD COLUMN "technical_requirements" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "prd" ADD COLUMN "dependencies" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "prd" ADD COLUMN "risks" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "prd" ADD COLUMN "estimated_total_hours" integer;--> statement-breakpoint
ALTER TABLE "prd" ADD COLUMN "target_deadline" timestamp;