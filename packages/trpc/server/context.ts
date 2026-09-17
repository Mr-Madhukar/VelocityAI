import { db, type Database } from "@repo/database";
import type { PrdDocumentData } from "@repo/services/shipflow/prd-document";

import type { OrgEvent, PublishOrgEvent } from "./events";

export type AuthSession = {
  session: {
    id: string;
    userId: string;
    activeOrganizationId?: string | null;
  };
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
} | null;

export type ClarifyInput = {
  title: string;
  description: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export type ClarifyResult = {
  reply: string;
  isDone: boolean;
};

export type PrdContent = {
  problemStatement: string;
  goals: string[];
  nonGoals: string[];
  userStories: string[];
  acceptanceCriteria: string[];
  edgeCases: string[];
  successMetrics: string[];
  technicalRequirements: string[];
  dependencies: string[];
  risks: string[];
  estimatedTotalHours: number | null;
};

export type EditPrdResult = PrdContent & { rawMarkdown: string };

export type GenerateImplPromptsInput = {
  feature: { title: string; description: string };
  prd: {
    problemStatement: string;
    goals: string[];
    nonGoals: string[];
    userStories: string[];
    acceptanceCriteria: string[];
    edgeCases: string[];
    technicalRequirements: string[];
    dependencies: string[];
    risks: string[];
  };
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    priority: string;
    estimatedHours: number | null;
  }>;
  techStack: string;
};

export type GenerateImplPromptsResult = {
  combinedPrompt: string;
};

export type GenerateQuickPromptInput = {
  message: string;
  techStack?: string | null;
};

export type GenerateQuickPromptResult = {
  prompt: string;
};

export type AssistantChatMessage = { role: "user" | "assistant"; content: string };

export type AssistantChatInput = {
  // The org/product context block the router assembled from the DB.
  context: string;
  // Full conversation so far, ending with the latest user message.
  messages: AssistantChatMessage[];
};

export type AssistantChatResult = { reply: string };

export type SendInviteInput = {
  to: string;
  inviterName: string;
  orgName: string;
  role: string;
  invitationId: string;
  expiresAt: Date;
};

export type SendPrdShareInput = {
  to: string;
  recipientName: string | null;
  sharedByName: string;
  featureId: string;
  message?: string;
  // Full PRD payload; the email renders the PDF attachment from this.
  document: PrdDocumentData;
};

export type SendVerificationCodeInput = {
  to: string;
  name: string | null;
  code: string;
  expiresInMinutes: number;
};

export type CreateContextOptions = {
  request?: Request;
  session?: AuthSession;
  emit?: (event: { name: string; data: Record<string, unknown> }) => Promise<unknown>;
  ai?: {
    clarify: (input: ClarifyInput) => Promise<ClarifyResult>;
    editPrd: (input: { currentPrd: PrdContent; editPrompt: string }) => Promise<EditPrdResult>;
    generateImplPrompts: (input: GenerateImplPromptsInput) => Promise<GenerateImplPromptsResult>;
    generateQuickPrompt: (input: GenerateQuickPromptInput) => Promise<GenerateQuickPromptResult>;
    assistantChat: (input: AssistantChatInput) => Promise<AssistantChatResult>;
  };
  sendInvite?: (input: SendInviteInput) => Promise<unknown>;
  sendPrdShare?: (input: SendPrdShareInput) => Promise<unknown>;
  sendVerificationCode?: (input: SendVerificationCodeInput) => Promise<unknown>;
  publish?: PublishOrgEvent;
};

export type ContextValue = {
  db: Database;
  request?: Request;
  session: AuthSession;
  emit: (event: { name: string; data: Record<string, unknown> }) => Promise<unknown>;
  ai: {
    clarify: (input: ClarifyInput) => Promise<ClarifyResult>;
    editPrd: (input: { currentPrd: PrdContent; editPrompt: string }) => Promise<EditPrdResult>;
    generateImplPrompts: (input: GenerateImplPromptsInput) => Promise<GenerateImplPromptsResult>;
    generateQuickPrompt: (input: GenerateQuickPromptInput) => Promise<GenerateQuickPromptResult>;
    assistantChat: (input: AssistantChatInput) => Promise<AssistantChatResult>;
  };
  sendInvite: (input: SendInviteInput) => Promise<unknown>;
  sendPrdShare: (input: SendPrdShareInput) => Promise<unknown>;
  sendVerificationCode: (input: SendVerificationCodeInput) => Promise<unknown>;
  publish: PublishOrgEvent;
};

const noopEmit = async () => {};
const noopClarify = async (): Promise<ClarifyResult> => ({
  reply: "Can you describe the target users and the success metric for this feature?",
  isDone: false,
});
const noopEditPrd = async ({ currentPrd }: { currentPrd: PrdContent }): Promise<EditPrdResult> => ({
  ...currentPrd,
  estimatedTotalHours: currentPrd.estimatedTotalHours ?? null,
  rawMarkdown: "",
});
const noopGenerateImplPrompts = async (): Promise<GenerateImplPromptsResult> => ({
  combinedPrompt: "",
});
const noopGenerateQuickPrompt = async (): Promise<GenerateQuickPromptResult> => ({
  prompt: "",
});
const noopAssistantChat = async (): Promise<AssistantChatResult> => ({
  reply: "The assistant is not available in this environment.",
});
const noopSendInvite = async () => {};
const noopSendPrdShare = async () => {};
const noopSendVerificationCode = async () => {};
const noopPublish: PublishOrgEvent = async () => {};

export async function createContext(
  options: CreateContextOptions = {},
): Promise<ContextValue> {
  return {
    db,
    request: options.request,
    session: options.session ?? null,
    emit: options.emit ?? noopEmit,
    ai:
      options.ai ?? {
        clarify: noopClarify,
        editPrd: noopEditPrd,
        generateImplPrompts: noopGenerateImplPrompts,
        generateQuickPrompt: noopGenerateQuickPrompt,
        assistantChat: noopAssistantChat,
      },
    sendInvite: options.sendInvite ?? noopSendInvite,
    sendPrdShare: options.sendPrdShare ?? noopSendPrdShare,
    sendVerificationCode: options.sendVerificationCode ?? noopSendVerificationCode,
    publish: options.publish ?? noopPublish,
  };
}

export type Context = ContextValue;
export type { OrgEvent };
