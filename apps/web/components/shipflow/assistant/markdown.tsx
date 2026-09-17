"use client";

import { Fragment, type ReactNode } from "react";

// A tiny, dependency-free Markdown renderer tuned for the assistant's replies.
// Handles headings, bold, inline code, fenced code blocks, ordered/unordered
// lists, links, horizontal rules, and paragraphs. Not a full CommonMark parser —
// just the subset the model actually produces.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on inline code, bold, and links while keeping delimiters.
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(<Fragment key={`${keyPrefix}-t${i}`}>{text.slice(last, match.index)}</Fragment>);
    }
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${i}`}
          className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (m) {
        nodes.push(
          <a
            key={`${keyPrefix}-l${i}`}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {m[1]}
          </a>,
        );
      }
    }
    last = regex.lastIndex;
    i++;
  }
  if (last < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}-tend`}>{text.slice(last)}</Fragment>);
  }
  return nodes;
}

type Block =
  | { type: "code"; lang: string; content: string }
  | { type: "heading"; level: number; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "hr" }
  | { type: "p"; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code block
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] ?? "";
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i]!)) {
        body.push(lines[i]!);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ type: "code", lang, content: body.join("\n") });
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2]!.trim() });
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Paragraph (consume until blank or a block starter)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !/^```/.test(lines[i]!) &&
      !/^(#{1,6})\s+/.test(lines[i]!) &&
      !/^\s*[-*]\s+/.test(lines[i]!) &&
      !/^\s*\d+\.\s+/.test(lines[i]!) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]!)
    ) {
      para.push(lines[i]!);
      i++;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }

  return blocks;
}

export function Markdown({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-foreground/90">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "code":
            return (
              <pre
                key={idx}
                className="overflow-x-auto rounded-lg border border-border bg-foreground/[0.04] p-3 font-mono text-[12px] leading-relaxed text-foreground/90"
              >
                <code>{block.content}</code>
              </pre>
            );
          case "heading": {
            const size =
              block.level <= 1
                ? "text-base font-semibold"
                : block.level === 2
                  ? "text-sm font-semibold"
                  : "text-sm font-medium";
            return (
              <p key={idx} className={`${size} text-foreground`}>
                {renderInline(block.text, `h${idx}`)}
              </p>
            );
          }
          case "ul":
            return (
              <ul key={idx} className="ml-1 space-y-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                    <span>{renderInline(item, `ul${idx}-${j}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={idx} className="ml-1 space-y-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="font-mono text-xs text-primary">{j + 1}.</span>
                    <span>{renderInline(item, `ol${idx}-${j}`)}</span>
                  </li>
                ))}
              </ol>
            );
          case "hr":
            return <hr key={idx} className="border-border" />;
          case "p":
            return (
              <p key={idx} className="whitespace-pre-wrap">
                {renderInline(block.text, `p${idx}`)}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
