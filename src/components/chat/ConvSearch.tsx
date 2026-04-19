import { Search } from "lucide-react";

interface ConvSearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/**
 * Pill-style search input for filtering conversations / channels in DM and
 * activity-channel sidebars.
 */
export const ConvSearch = ({ value, onChange, placeholder = "Search…" }: ConvSearchProps) => (
  <div className="chat-search">
    <Search className="chat-search-icon h-3.5 w-3.5" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  </div>
);
