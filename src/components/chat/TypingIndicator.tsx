interface TypingIndicatorProps {
  name: string;
}

/**
 * iMessage-style three-dot "… is typing" bubble.
 */
export const TypingIndicator = ({ name }: TypingIndicatorProps) => (
  <div className="flex items-end gap-2 px-2 py-1">
    <div className="chat-typing" aria-label={`${name} is typing`}>
      <span /><span /><span />
    </div>
    <span className="text-[11px] text-muted-foreground">{name}</span>
  </div>
);
