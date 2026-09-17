CREATE TABLE "task_note" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_note" ADD CONSTRAINT "task_note_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_note" ADD CONSTRAINT "task_note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_note" ADD CONSTRAINT "task_note_parent_id_task_note_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."task_note"("id") ON DELETE cascade ON UPDATE no action;