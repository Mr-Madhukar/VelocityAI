CREATE TABLE "implementation_prompt" (
	"id" text PRIMARY KEY NOT NULL,
	"feature_id" text NOT NULL,
	"prd_id" text NOT NULL,
	"tech_stack" text NOT NULL,
	"combined_prompt" text NOT NULL,
	"task_prompts" text DEFAULT '{}' NOT NULL,
	"prd_version" integer NOT NULL,
	"task_fingerprint" text DEFAULT '[]' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "tech_stack" text;--> statement-breakpoint
ALTER TABLE "implementation_prompt" ADD CONSTRAINT "implementation_prompt_feature_id_feature_request_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."feature_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implementation_prompt" ADD CONSTRAINT "implementation_prompt_prd_id_prd_id_fk" FOREIGN KEY ("prd_id") REFERENCES "public"."prd"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implementation_prompt" ADD CONSTRAINT "implementation_prompt_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "implementation_prompt_feature_stack_unique" ON "implementation_prompt" USING btree ("feature_id","tech_stack");