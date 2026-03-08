import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, UserCog, Shield, Users, BookOpen, ClipboardCheck,
  AlertTriangle, UserCheck, Sparkles, MessageSquare, Award, Zap,
  UtensilsCrossed, CalendarDays, Search, User, Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const pages = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, keywords: "home overview stats" },
  { title: "User Management", url: "/admin/user-management", icon: UserCog, keywords: "users roles bulk import" },
  { title: "Manage Activities", url: "/admin/co-curricular/activities", icon: Shield, keywords: "create edit activity" },
  { title: "Manual Allocation", url: "/admin/co-curricular/manual-allocations", icon: Users, keywords: "assign students manual" },
  { title: "Auto Allocation", url: "/admin/co-curricular/allocations", icon: Shield, keywords: "auto allocate preferences" },
  { title: "View Allocations", url: "/admin/co-curricular/view-allocations", icon: Users, keywords: "see assignments" },
  { title: "Activity Roster", url: "/admin/co-curricular/activity-roster", icon: BookOpen, keywords: "roster enrolled" },
  { title: "Weekly Timetable", url: "/admin/co-curricular/timetable", icon: CalendarDays, keywords: "schedule week" },
  { title: "Attendance", url: "/admin/co-curricular/attendance", icon: ClipboardCheck, keywords: "take mark" },
  { title: "Attendance Reports", url: "/admin/co-curricular/attendance-reports", icon: AlertTriangle, keywords: "absent late excused" },
  { title: "Pre-Excuse Students", url: "/admin/co-curricular/pre-excuse", icon: UserCheck, keywords: "excuse future" },
  { title: "AI Weekly Summary", url: "/admin/co-curricular/weekly-summary", icon: Sparkles, keywords: "ai report trends" },
  { title: "All Chats", url: "/admin/co-curricular/messages", icon: MessageSquare, keywords: "messages channels" },
  { title: "Badge Requests", url: "/admin/co-curricular/badge-requests", icon: Award, keywords: "badges approve" },
  { title: "Admin AI", url: "/admin/admin-ai", icon: Zap, keywords: "ai bot requests process" },
  { title: "Meal Reports", url: "/admin/meal-reports", icon: UtensilsCrossed, keywords: "meal food kitchen" },
  { title: "Direct Messages", url: "/admin/dms", icon: MessageSquare, keywords: "dm chat" },
];

interface SearchResult {
  id: string;
  type: "user" | "activity";
  title: string;
  subtitle: string;
  url: string;
  role?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const [{ data: profiles }, { data: activities }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(8),
        supabase
          .from("activities")
          .select("id, title, category, teacher_in_charge")
          .or(`title.ilike.%${query}%,teacher_in_charge.ilike.%${query}%,category.ilike.%${query}%`)
          .limit(8),
      ]);

      const results: SearchResult[] = [];

      profiles?.forEach((p) => {
        results.push({
          id: p.id,
          type: "user",
          title: p.full_name,
          subtitle: p.email,
          url: `/admin/user-management?editUser=${p.id}`,
        });
      });

      activities?.forEach((a) => {
        results.push({
          id: a.id,
          type: "activity",
          title: a.title,
          subtitle: `${a.category} · ${a.teacher_in_charge}`,
          url: `/admin/co-curricular/activities?editActivity=${a.id}`,
        });
      });

      setSearchResults(results);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSelect = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search...</span>
        <kbd className="hidden md:inline-flex pointer-events-none h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search users, activities, pages..."
          onValueChange={handleSearch}
        />
        <CommandList>
          <CommandEmpty>
            {searching ? "Searching..." : "No results found."}
          </CommandEmpty>

          {/* Pages */}
          <CommandGroup heading="Pages">
            {pages.map((page) => (
              <CommandItem
                key={page.url}
                value={`${page.title} ${page.keywords}`}
                onSelect={() => handleSelect(page.url)}
              >
                <page.icon className="mr-2 h-4 w-4" />
                <span>{page.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {/* Dynamic Results */}
          {searchResults.length > 0 && (
            <>
              <CommandSeparator />
              {searchResults.some((r) => r.type === "user") && (
                <CommandGroup heading="Users">
                  {searchResults
                    .filter((r) => r.type === "user")
                    .map((r) => (
                      <CommandItem
                        key={r.id}
                        value={`${r.title} ${r.subtitle}`}
                        onSelect={() => handleSelect(r.url)}
                      >
                        <User className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{r.title}</span>
                          <span className="text-xs text-muted-foreground">{r.subtitle}</span>
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}
              {searchResults.some((r) => r.type === "activity") && (
                <CommandGroup heading="Activities">
                  {searchResults
                    .filter((r) => r.type === "activity")
                    .map((r) => (
                      <CommandItem
                        key={r.id}
                        value={`${r.title} ${r.subtitle}`}
                        onSelect={() => handleSelect(r.url)}
                      >
                        <Activity className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{r.title}</span>
                          <span className="text-xs text-muted-foreground">{r.subtitle}</span>
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
