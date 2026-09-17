"use client";

import { Fragment, type ReactNode } from "react";

// A tiny, dependency-free Markdown renderer tuned for the assistant's replies.
// Handles headings, bold, inline code, fenced code blocks, ordered/unordered
// lists, links, horizontal rules, and paragraphs. Not a full CommonMark parser —
// just the subset the model actually produces.

type InlineMatch =
  | { type: "code"; content: string; nextIndex: number }
  | { type: "bold"; content: string; nextIndex: number }
  | { type: "link"; text: string; href: string; nextIndex: number };

function tryMatchInlineCode(
  text: string,
  idx: number,
): { content: string; nextIndex: number } | null {
  if (text[idx] !== "`") return null;
  const next = text.indexOf("`", idx + 1);
  if (next === -1) return null;
  return { content: text.slice(idx + 1, next), nextIndex: next + 1 };
}

function tryMatchBold(
  text: string,
  idx: number,
): { content: string; nextIndex: number } | null {
  if (text[idx] !== "*" || text[idx + 1] !== "*") return null;
  const next = text.indexOf("**", idx + 2);
  if (next === -1) return null;
  return { content: text.slice(idx + 2, next), nextIndex: next + 2 };
}

function tryMatchLink(
  text: string,
  idx: number,
): { text: string; href: string; nextIndex: number } | null {
  if (text[idx] !== "[") return null;
  const closeBracket = text.indexOf("]", idx + 1);
  if (closeBracket === -1 || text[closeBracket + 1] !== "(") return null;
  const closeParen = text.indexOf(")", closeBracket + 2);
  if (closeParen === -1) return null;
  return {
    text: text.slice(idx + 1, closeBracket),
    href: text.slice(closeBracket + 2, closeParen),
    nextIndex: closeParen + 1,
  };
}

function matchInlineToken(text: string, idx: number): InlineMatch | null {
  const code = tryMatchInlineCode(text, idx);
  if (code) return { type: "code", ...code };

  const bold = tryMatchBold(text, idx);
  if (bold) return { type: "bold", ...bold };

  const link = tryMatchLink(text, idx);
  if (link) return { type: "link", ...link };

  return null;
}

function renderInlineNode(match: InlineMatch, key: string): ReactNode {
  if (match.type === "code") {
    return (
      <code
        key={key}
        className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em] text-foreground"
      >
        {match.content}
      </code>
    );
  }
  if (match.type === "bold") {
    return (
      <strong key={key} className="font-semibold text-foreground">
        {match.content}
      </strong>
    );
  }
  return (
    <a
      key={key}
      href={match.href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {match.text}
    </a>
  );
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let idx = 0;

  while (idx < text.length) {
    const token = matchInlineToken(text, idx);
    if (!token) {
      idx++;
      continue;
    }

    if (idx > last) {
      nodes.push(
        <Fragment key={`${keyPrefix}-t${i}`}>
          {text.slice(last, idx)}
        </Fragment>,
      );
      i++;
    }

    nodes.push(renderInlineNode(token, `${keyPrefix}-m${i}`));
    i++;
    idx = token.nextIndex;
    last = idx;
  }

  if (last < text.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-tend`}>
        {text.slice(last)}
      </Fragment>,
    );
  }

  return nodes;
}

type ListItem = { id: string; text: string; num: number };

type Block =
  | { id: string; type: "code"; lang: string; content: string }
  | { id: string; type: "heading"; level: number; text: string }
  | { id: string; type: "ul"; items: ListItem[] }
  | { id: string; type: "ol"; items: ListItem[] }
  | { id: string; type: "hr" }
  | { id: string; type: "p"; text: string };

function parseFencedCode(
  lines: string[],
  start: number,
): { block: Block; nextIndex: number } | null {
  const line = lines[start]!;
  const fence = /^```(\w*)\s*$/.exec(line);
  if (!fence) return null;
  const lang = fence[1] ?? "";
  const body: string[] = [];
  let i = start + 1;
  while (i < lines.length && !lines[i]!.startsWith("```")) {
    body.push(lines[i]!);
    i++;
  }
  return {
    block: { id: `code-${start}`, type: "code", lang, content: body.join("\n") },
    nextIndex: i < lines.length ? i + 1 : i,
  };
}

function isHorizontalRule(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function parseHeading(line: string): { level: number; text: string } | null {
  if (!line.startsWith("#")) return null;
  let level = 0;
  while (level < line.length && line[level] === "#") {
    level++;
  }
  if (level > 6 || line[level] !== " ") return null;
  const text = line.slice(level).trim();
  if (!text) return null;
  return { level, text };
}

function parseHeadingBlock(line: string, index: number): Block | null {
  const heading = parseHeading(line);
  if (!heading) return null;
  return {
    id: `heading-${index}`,
    type: "heading",
    level: heading.level,
    text: heading.text,
  };
}

const UL_REGEX = /^\s*[-*]\s+/;
const OL_REGEX = /^\s*\d+\.\s+/;

function parseListBlock(
  lines: string[],
  start: number,
): { block: Block; nextIndex: number } | null {
  const line = lines[start]!;
  const isUl = UL_REGEX.test(line);
  const isOl = !isUl && OL_REGEX.test(line);
  if (!isUl && !isOl) return null;

  const items: ListItem[] = [];
  let i = start;
  let count = 1;
  const regex = isUl ? UL_REGEX : OL_REGEX;
  while (i < lines.length && regex.test(lines[i]!)) {
    items.push({
      id: `${isUl ? "ul" : "ol"}-${start}-${count}`,
      text: lines[i]!.replace(regex, ""),
      num: count,
    });
    count++;
    i++;
  }

  return {
    block: {
      id: `${isUl ? "ul" : "ol"}-${start}`,
      type: isUl ? "ul" : "ol",
      items,
    },
    nextIndex: i,
  };
}

function isBlockStarter(line: string): boolean {
  if (line.trim() === "") return true;
  if (line.startsWith("```")) return true;
  if (line.startsWith("#")) return true;
  if (UL_REGEX.test(line)) return true;
  if (OL_REGEX.test(line)) return true;
  return isHorizontalRule(line);
}

function parseParagraph(
  lines: string[],
  start: number,
): { block: Block; nextIndex: number } {
  const para: string[] = [];
  let i = start;
  while (i < lines.length && !isBlockStarter(lines[i]!)) {
    para.push(lines[i]!);
    i++;
  }
  return {
    block: { id: `p-${start}`, type: "p", text: para.join(" ") },
    nextIndex: i,
  };
}

function parseBlocks(md: string): Block[] {
  const lines = md.replaceAll("\r\n", "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === "") {
      i++;
      continue;
    }

    const code = parseFencedCode(lines, i);
    if (code) {
      blocks.push(code.block);
      i = code.nextIndex;
      continue;
    }

    if (isHorizontalRule(line)) {
      blocks.push({ id: `hr-${i}`, type: "hr" });
      i++;
      continue;
    }

    const heading = parseHeadingBlock(line, i);
    if (heading) {
      blocks.push(heading);
      i++;
      continue;
    }

    const list = parseListBlock(lines, i);
    if (list) {
      blocks.push(list.block);
      i = list.nextIndex;
      continue;
    }

    const p = parseParagraph(lines, i);
    blocks.push(p.block);
    i = p.nextIndex;
  }

  return blocks;
}

function getHeadingClass(level: number): string {
  if (level <= 1) return "text-base font-semibold";
  if (level === 2) return "text-sm font-semibold";
  return "text-sm font-medium";
}

function MarkdownBlock({ block }: Readonly<{ block: Block }>) {
  switch (block.type) {
    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg border border-border bg-foreground/4 p-3 font-mono text-[12px] leading-relaxed text-foreground/90">
          <code>{block.content}</code>
        </pre>
      );
    case "heading":
      return (
        <p className={`${getHeadingClass(block.level)} text-foreground`}>
          {renderInline(block.text, block.id)}
        </p>
      );
    case "ul":
      return (
        <ul className="ml-1 space-y-1">
          {block.items.map((item) => (
            <li key={item.id} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{renderInline(item.text, item.id)}</span>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="ml-1 space-y-1">
          {block.items.map((item) => (
            <li key={item.id} className="flex gap-2">
              <span className="font-mono text-xs text-primary">{item.num}.</span>
              <span>{renderInline(item.text, item.id)}</span>
            </li>
          ))}
        </ol>
      );
    case "hr":
      return <hr className="border-border" />;
    case "p":
      return (
        <p className="whitespace-pre-wrap">
          {renderInline(block.text, block.id)}
        </p>
      );
    default:
      return null;
  }
}

export function Markdown({ content }: Readonly<{ content: string }>) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-foreground/90">
      {blocks.map((block) => (
        <MarkdownBlock key={block.id} block={block} />
      ))}
    </div>
  );
}
