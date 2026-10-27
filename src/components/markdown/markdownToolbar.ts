import { t as __tr } from "../../lib/i18n";
import {
  BoldIcon, CodeIcon, Heading1Icon, Heading2Icon, ItalicIcon, LinkIcon, ListIcon, ListNumbersIcon, LockIcon, PhotoIcon, QuoteIcon, StrikethroughIcon, TableIcon
} from "../../lib/icons";
import type { IconProps } from "../../lib/icons";
export type ToolbarAction = {
  icon: React.ComponentType<IconProps>;
  title: string;
  action: (textarea: HTMLTextAreaElement, value: string) => { text: string; selStart: number; selEnd: number };
  separator?: never;
} | { separator: true };

export function wrapSelection(
  textarea: HTMLTextAreaElement,
  value: string,
  before: string,
  after: string,
  placeholder: string
): { text: string; selStart: number; selEnd: number } {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end);
  const content = selected || placeholder;
  const newText = value.slice(0, start) + before + content + after + value.slice(end);
  const selStart = start + before.length;
  const selEnd = selStart + content.length;
  return { text: newText, selStart, selEnd };
}

export function prefixLine(
  textarea: HTMLTextAreaElement,
  value: string,
  prefix: string
): { text: string; selStart: number; selEnd: number } {
  const start = textarea.selectionStart;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  // Toggle: remove prefix if already present
  if (value.slice(lineStart, lineStart + prefix.length) === prefix) {
    const newText = value.slice(0, lineStart) + value.slice(lineStart + prefix.length);
    const cursor = Math.max(lineStart, start - prefix.length);
    return { text: newText, selStart: cursor, selEnd: cursor };
  }
  const newText = value.slice(0, lineStart) + prefix + value.slice(lineStart);
  const cursor = start + prefix.length;
  return { text: newText, selStart: cursor, selEnd: cursor };
}

export const TABLE_TEMPLATE = `| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
| Cell | Cell | Cell |`;

export const toolbarActions: ToolbarAction[] = [
  {
    icon: BoldIcon,
    title: __tr("Bold"),
    action: (ta, v) => wrapSelection(ta, v, "**", "**", "bold text"),
  },
  {
    icon: ItalicIcon,
    title: __tr("Italic"),
    action: (ta, v) => wrapSelection(ta, v, "_", "_", "italic text"),
  },
  {
    icon: StrikethroughIcon,
    title: __tr("Strikethrough"),
    action: (ta, v) => wrapSelection(ta, v, "~~", "~~", "strikethrough"),
  },
  { separator: true },
  {
    icon: Heading1Icon,
    title: __tr("Heading 1"),
    action: (ta, v) => prefixLine(ta, v, "# "),
  },
  {
    icon: Heading2Icon,
    title: __tr("Heading 2"),
    action: (ta, v) => prefixLine(ta, v, "## "),
  },
  { separator: true },
  {
    icon: LinkIcon,
    title: __tr("Link"),
    action: (ta, v) => {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = v.slice(start, end);
      const label = selected || "link text";
      const insert = `[${label}](url)`;
      const newText = v.slice(0, start) + insert + v.slice(end);
      const urlStart = start + label.length + 3;
      return { text: newText, selStart: urlStart, selEnd: urlStart + 3 };
    },
  },
  {
    icon: PhotoIcon,
    title: __tr("Image"),
    action: (ta, v) => {
      const start = ta.selectionStart;
      const insert = "![alt text](image-url)";
      const newText = v.slice(0, start) + insert + v.slice(ta.selectionEnd);
      return { text: newText, selStart: start + 12, selEnd: start + 21 };
    },
  },
  { separator: true },
  {
    icon: CodeIcon,
    title: __tr("Code"),
    action: (ta, v) => {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = v.slice(start, end);
      if (selected.includes("\n")) {
        return wrapSelection(ta, v, "```\n", "\n```", "code");
      }
      return wrapSelection(ta, v, "`", "`", "code");
    },
  },
  {
    icon: ListIcon,
    title: __tr("Bullet List"),
    action: (ta, v) => prefixLine(ta, v, "- "),
  },
  {
    icon: ListNumbersIcon,
    title: __tr("Numbered List"),
    action: (ta, v) => prefixLine(ta, v, "1. "),
  },
  {
    icon: TableIcon,
    title: __tr("Table"),
    action: (ta, v) => {
      const start = ta.selectionStart;
      const needsNewline = start > 0 && v[start - 1] !== "\n" ? "\n" : "";
      const insert = needsNewline + TABLE_TEMPLATE + "\n";
      const newText = v.slice(0, start) + insert + v.slice(ta.selectionEnd);
      return { text: newText, selStart: start + insert.length, selEnd: start + insert.length };
    },
  },
  { separator: true },
  {
    icon: LockIcon,
    title: __tr("Secret (!!secret!!, encrypted when saved)"),
    action: (ta, v) => wrapSelection(ta, v, "!!", "!!", "secret"),
  },
  {
    icon: QuoteIcon,
    title: __tr("Blockquote"),
    action: (ta, v) => prefixLine(ta, v, "> "),
  },
];
