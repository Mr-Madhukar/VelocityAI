import { Resend } from "resend";

import { prdDocumentFilename, type PrdDocumentData } from "@repo/services/shipflow/prd-document";
import { renderPrdPdf } from "./prd-pdf";

const FROM = process.env.RESEND_FROM_EMAIL ?? "VelocityAI <invites@VelocityAI.in>";
const APP_URL = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://my-ai-code-reviewer.onrender.com";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export type SendInviteEmailInput = {
  to: string;
  inviterName: string;
  orgName: string;
  role: string;
  invitationId: string;
  expiresAt: Date;
};

export async function sendInviteEmail(input: SendInviteEmailInput) {
  const acceptUrl = `${APP_URL}/invite?token=${input.invitationId}`;
  const expiryDate = input.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <title>You're invited to ${input.orgName} on VelocityAI</title>
</head>
<body style="margin:0;padding:0;background:#0a0c10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0c10;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="width:560px;max-width:100%;background:#14171d;border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;box-shadow:0 1px 0 rgba(255,255,255,0.04) inset;">

          <!-- Accent bar -->
          <tr><td style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#f97316,#fb923c);">&nbsp;</td></tr>

          <!-- Header -->
          <tr>
            <td style="padding:28px 40px 22px;border-bottom:1px solid rgba(255,255,255,0.07);">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <img src="${APP_URL}/icons/VelocityAI-icon-transparent-512.png" alt="VelocityAI" width="28" height="28" style="display:block;width:28px;height:28px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:19px;font-weight:700;color:#fb923c;letter-spacing:-0.4px;">VelocityAI</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 8px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#fb923c;">You're invited</p>
              <p style="margin:0 0 4px;font-size:26px;font-weight:700;color:#f8fafc;letter-spacing:-0.4px;">Join ${input.orgName}</p>

              <p style="margin:22px 0 0;font-size:15px;line-height:25px;color:#a8b0bd;">
                <strong style="color:#e8ecf2;">${input.inviterName}</strong> invited you to collaborate on
                <strong style="color:#e8ecf2;">${input.orgName}</strong> as a
                <span style="display:inline-block;padding:2px 9px;margin:0 1px;border:1px solid rgba(249,115,22,0.3);background:rgba(249,115,22,0.12);border-radius:999px;font-size:13px;font-weight:600;color:#fdba74;">${input.role}</span>.
              </p>
              <p style="margin:14px 0 0;font-size:15px;line-height:25px;color:#a8b0bd;">
                VelocityAI turns feature ideas into reviewed, approved, shipped software — connecting requests, PRDs, tasks, and GitHub PRs in one workflow.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:28px 40px 8px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="border-radius:8px;background:#f97316;">
                    <a href="${acceptUrl}" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:700;color:#1a1205;text-decoration:none;border-radius:8px;">
                      Accept invitation &nbsp;&rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td style="padding:18px 40px 28px;">
              <p style="margin:0 0 8px;font-size:13px;color:#6b7480;">Or paste this link into your browser:</p>
              <p style="margin:0;font-size:12px;color:#8a93a0;word-break:break-all;background:rgba(255,255,255,0.035);padding:11px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.07);">
                ${acceptUrl}
              </p>
            </td>
          </tr>

          <!-- Expiry -->
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0;font-size:13px;line-height:20px;color:#6b7480;">
                This invitation expires on <strong style="color:#a8b0bd;">${expiryDate}</strong>.
                If you weren't expecting it, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 40px;border-top:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.02);">
              <p style="margin:0;font-size:12px;color:#5b636e;">
                VelocityAI · Product delivery cockpit · <a href="${APP_URL}" style="color:#fb923c;text-decoration:none;">VelocityAI.in</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return getResend().emails.send({
    from: FROM,
    to: input.to,
    subject: `${input.inviterName} invited you to ${input.orgName} on VelocityAI`,
    html,
  });
}

export type SendVerificationCodeEmailInput = {
  to: string;
  name: string | null;
  code: string;
  expiresInMinutes: number;
};

// 6-digit email ownership check. Square-cornered layout by design — all edges
// are sharp (border-radius: 0) to match the product's document aesthetic.
export async function sendVerificationCodeEmail(input: SendVerificationCodeEmailInput) {
  const firstName = input.name?.trim().split(/\s+/)[0] ?? null;
  const digits = input.code
    .split("")
    .map(
      (d) =>
        `<td style="width:44px;height:56px;background:#0d0f14;border:1px solid rgba(249,115,22,0.35);text-align:center;vertical-align:middle;font-family:'SF Mono',Consolas,'Liberation Mono',Menlo,monospace;font-size:26px;font-weight:700;color:#fdba74;">${d}</td>
         <td style="width:8px;font-size:0;line-height:0;">&nbsp;</td>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <title>Your VelocityAI verification code</title>
</head>
<body style="margin:0;padding:0;background:#0a0c10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0c10;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="width:560px;max-width:100%;background:#14171d;border:1px solid rgba(255,255,255,0.08);overflow:hidden;box-shadow:0 1px 0 rgba(255,255,255,0.04) inset;">

          <!-- Accent bar -->
          <tr><td style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#f97316,#fb923c);">&nbsp;</td></tr>

          <!-- Header -->
          <tr>
            <td style="padding:28px 40px 22px;border-bottom:1px solid rgba(255,255,255,0.07);">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <img src="${APP_URL}/icons/VelocityAI-icon-transparent-512.png" alt="VelocityAI" width="28" height="28" style="display:block;width:28px;height:28px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:19px;font-weight:700;color:#fb923c;letter-spacing:-0.4px;">VelocityAI</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 10px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#fb923c;">Verify your email</p>
              <p style="margin:0;font-size:24px;font-weight:700;color:#f8fafc;letter-spacing:-0.4px;">Here's your 6-digit code</p>
              <p style="margin:18px 0 0;font-size:15px;line-height:25px;color:#a8b0bd;">
                ${firstName ? `Hi <strong style="color:#e8ecf2;">${firstName}</strong>, e` : "E"}nter this code in VelocityAI to confirm you own this email address. Once verified, teammates can send you PRDs and invitations.
              </p>
            </td>
          </tr>

          <!-- Code -->
          <tr>
            <td style="padding:26px 40px 6px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>${digits}</tr>
              </table>
            </td>
          </tr>

          <!-- Expiry -->
          <tr>
            <td style="padding:18px 40px 34px;">
              <p style="margin:0;font-size:13px;line-height:20px;color:#6b7480;">
                This code expires in <strong style="color:#a8b0bd;">${input.expiresInMinutes} minutes</strong> and can only be used once.
                If you didn't request it, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 40px;border-top:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.02);">
              <p style="margin:0;font-size:12px;color:#5b636e;">
                VelocityAI · Product delivery cockpit · <a href="${APP_URL}" style="color:#fb923c;text-decoration:none;">VelocityAI.in</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return getResend().emails.send({
    from: FROM,
    to: input.to,
    subject: `${input.code} is your VelocityAI verification code`,
    html,
  });
}

export type SendPrdShareEmailInput = {
  to: string;
  recipientName: string | null;
  sharedByName: string;
  featureId: string;
  message?: string;
  document: PrdDocumentData;
};

function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export async function sendPrdShareEmail(input: SendPrdShareEmailInput) {
  const doc = input.document;
  const featureUrl = `${APP_URL}/features/${input.featureId}?tab=prd&view=document`;
  const approved = Boolean(doc.approvedAt);
  const statusLabel = approved ? "Approved" : doc.status.replaceAll("_", " ");
  const orgName = doc.orgName ?? "your team";

  const pdf = await renderPrdPdf(doc);
  const filename = prdDocumentFilename(doc.featureTitle);

  const detailRow = (label: string, value: string) => `
    <tr>
      <td style="padding:9px 0;border-top:1px solid rgba(255,255,255,0.06);font-size:13px;color:#8a93a0;width:150px;vertical-align:top;">${label}</td>
      <td style="padding:9px 0;border-top:1px solid rgba(255,255,255,0.06);font-size:13px;color:#e8ecf2;font-weight:500;">${value}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <title>${input.sharedByName} shared a PRD with you</title>
</head>
<body style="margin:0;padding:0;background:#0a0c10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0c10;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="width:560px;max-width:100%;background:#14171d;border:1px solid rgba(255,255,255,0.08);overflow:hidden;box-shadow:0 1px 0 rgba(255,255,255,0.04) inset;">

          <!-- Accent bar -->
          <tr><td style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#f97316,#fb923c);">&nbsp;</td></tr>

          <!-- Header -->
          <tr>
            <td style="padding:28px 40px 22px;border-bottom:1px solid rgba(255,255,255,0.07);">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <img src="${APP_URL}/icons/VelocityAI-icon-transparent-512.png" alt="VelocityAI" width="28" height="28" style="display:block;width:28px;height:28px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:19px;font-weight:700;color:#fb923c;letter-spacing:-0.4px;">VelocityAI</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:34px 40px 6px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#fb923c;">Product Requirements Document</p>
              <p style="margin:0 0 4px;font-size:24px;font-weight:700;color:#f8fafc;letter-spacing:-0.4px;line-height:1.25;">${doc.featureTitle}</p>
              <p style="margin:16px 0 0;font-size:15px;line-height:25px;color:#a8b0bd;">
                <strong style="color:#e8ecf2;">${input.sharedByName}</strong> shared this PRD with you from
                <strong style="color:#e8ecf2;">${orgName}</strong>. View it live in VelocityAI, or read the PDF attached below.
              </p>
              ${
                input.message
                  ? `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:18px 0 0;width:100%;">
                       <tr><td style="padding:14px 16px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);font-size:14px;line-height:22px;color:#c7ccd6;font-style:italic;">“${input.message}”</td></tr>
                     </table>`
                  : ""
              }
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:26px 40px 6px;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#f97316;">
                    <a href="${featureUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#1a1205;text-decoration:none;">
                      View PRD in VelocityAI &nbsp;&rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-size:13px;color:#6b7480;">
                📎 The full document is attached as <strong style="color:#a8b0bd;">${filename}</strong>.
              </p>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:22px 40px 8px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6b7480;">Project details</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${detailRow("Status", `<span style="display:inline-block;padding:2px 10px;font-size:12px;font-weight:600;color:#fdba74;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);">${statusLabel}</span>`)}
                ${detailRow("Version", `v${doc.version}`)}
                ${detailRow("Priority", doc.priority)}
                ${detailRow("Created by", doc.createdByName ?? "Unknown")}
                ${detailRow("Created on", fmtDate(doc.createdAt))}
                ${detailRow("Estimated effort", doc.estimatedTotalHours ? `~${doc.estimatedTotalHours} hours` : "—")}
                ${detailRow("Target deadline", fmtDate(doc.targetDeadline))}
                ${approved ? detailRow("Approved on", fmtDate(doc.approvedAt)) : ""}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.02);">
              <p style="margin:0;font-size:12px;color:#5b636e;">
                VelocityAI · Product delivery cockpit · <a href="${APP_URL}" style="color:#fb923c;text-decoration:none;">VelocityAI.in</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return getResend().emails.send({
    from: FROM,
    to: input.to,
    subject: `${input.sharedByName} shared the "${doc.featureTitle}" PRD with you`,
    html,
    attachments: [{ filename, content: pdf }],
  });
}
