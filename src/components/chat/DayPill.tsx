interface DayPillProps {
  label: string;
}

/**
 * Frosted "Today / Yesterday / Tuesday, Jan 14" pill used as a day separator
 * in chat streams. Replaces line+text dividers.
 */
export const DayPill = ({ label }: DayPillProps) => (
  <div className="chat-day-pill-wrap">
    <span className="chat-day-pill">{label}</span>
  </div>
);
