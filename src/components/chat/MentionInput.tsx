import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

export interface MentionMember {
  id: string;
  name: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  members: MentionMember[];
  placeholder?: string;
  className?: string;
  maxLength?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Receives the FINAL message text + array of mentioned user IDs */
  onMentionedIdsChange?: (ids: string[]) => void;
}

/**
 * Token format inside content: @[Full Name](user-uuid)
 * Renderer parses these tokens to highlight pills; raw text is what's stored.
 */
export function MentionInput({
  value, onChange, members, placeholder, className, maxLength,
  onKeyDown, onMentionedIdsChange,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<{ start: number; end: number } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Detect '@<query>' before the caret
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const upTo = value.slice(0, caret);
    const m = upTo.match(/(?:^|\s)@([\w.\-]{0,40})$/);
    if (m) {
      const start = caret - m[1].length - 1; // position of '@'
      setAnchor({ start, end: caret });
      setQuery(m[1].toLowerCase());
      setOpen(true);
      setActiveIdx(0);
    } else {
      setOpen(false);
      setAnchor(null);
    }
  }, [value]);

  // Extract mentioned IDs from current value & notify parent
  useEffect(() => {
    if (!onMentionedIdsChange) return;
    const ids = Array.from(value.matchAll(/@\[[^\]]+\]\(([0-9a-f-]{8,})\)/g)).map(m => m[1]);
    onMentionedIdsChange(Array.from(new Set(ids)));
  }, [value, onMentionedIdsChange]);

  const filtered = open
    ? members
        .filter(m => m.name.toLowerCase().includes(query))
        .slice(0, 6)
    : [];

  const insert = (member: MentionMember) => {
    if (!anchor) return;
    const before = value.slice(0, anchor.start);
    const after = value.slice(anchor.end);
    const token = `@[${member.name}](${member.id}) `;
    const next = before + token + after;
    onChange(next);
    setOpen(false);
    setAnchor(null);
    requestAnimationFrame(() => {
      const ta = ref.current;
      if (ta) {
        const pos = (before + token).length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      }
    });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && filtered.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => (i + 1) % filtered.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insert(filtered[activeIdx]); return; }
      if (e.key === "Escape")    { e.preventDefault(); setOpen(false); return; }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative w-full">
      {open && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-64 max-w-[90vw] rounded-xl border bg-popover text-popover-foreground shadow-lg overflow-hidden z-50">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
            Mention someone
          </div>
          {filtered.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insert(m); }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                i === activeIdx ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              }`}
            >
              <span className="font-medium">@{m.name}</span>
            </button>
          ))}
        </div>
      )}
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className={className}
        maxLength={maxLength}
      />
    </div>
  );
}

/** Render mention tokens as inline pills inside a message body. */
export function renderMentions(text: string, currentUserId?: string) {
  const regex = /@\[([^\]]+)\]\(([0-9a-f-]{8,})\)/g;
  const out: (string | JSX.Element)[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const isMe = currentUserId && m[2] === currentUserId;
    out.push(
      <span
        key={`mention-${key++}`}
        className={`inline-flex items-baseline rounded-md px-1 font-medium ${
          isMe
            ? "bg-amber-400/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/50"
            : "bg-primary/15 text-primary"
        }`}
      >
        @{m[1]}
      </span>
    );
    last = regex.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
