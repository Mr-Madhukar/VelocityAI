ALTER TABLE "github_installation" ALTER COLUMN "installation_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "pull_request" ALTER COLUMN "installation_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "pull_request" ALTER COLUMN "github_pr_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "repository" ALTER COLUMN "installation_id" SET DATA TYPE bigint;