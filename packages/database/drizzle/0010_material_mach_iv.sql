ALTER TABLE "review_cycle" ALTER COLUMN "feature_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_request" ADD COLUMN "branch_name" text;--> statement-breakpoint
ALTER TABLE "review_cycle" ADD COLUMN "head_sha" text;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_request_org_branch_unique" ON "feature_request" USING btree ("organization_id","branch_name");