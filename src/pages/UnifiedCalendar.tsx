import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, CalendarDays, GraduationCap, Activity, Clock, MapPin, User } from "lucide-react";
import { isLightColor, DAY_LABELS } from "@/lib/academic-utils";
import { cn } from "@/lib/utils";

interface Period {
  id: number;
  label: string;
  start_time: string;
  end_time: string;
  is_break: boolean;
  sort_order: number;
}

interface Subject {
  id: string;
  name: string;
  code: string | null;
  color: string;
}

interface Slot {
  id: string;
  subject_id: string;
  teacher_id: string | null;
  day_of_week: number;
  period_number: number;
  room: string | null;
}

interface CocurricularActivity {
  title: string;
  category: string;
  teacher_in_charge: string;
  schedule: string;
}

interface Allocation {
  activity_id: string;
  day_of_week: string;
  slot_number: number;
  preference_rank: number;
  activities: CocurricularActivity | null;
}

interface CalendarEvent {
  type: "academic" | "cocurricular";
  title: string;
  subtitle: string;
  startTime: string;
  endTime: string;
  color: string;
  room?: string | null;
  dayIndex: number; // 1-5 Mon-Fri
  sortOrder: number;
}

const CO_CURRICULAR_TIMES: Record<string, { start: string; end: string }> = {
  default: { start: "16:30", end: "18:25" },
  wed_slot1: { start: "16:30", end: "17:25" },
  wed_slot2: { start: "17:30", end: "20:25" },
};

const DAY_NAME_TO_INDEX: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5,
};

const UnifiedCalendar = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [teachers, setTeachers] = useState<Record<string, string>>({});
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [hasDev, setHasDev] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check dev badge
        const { data: devBadge } = await (supabase as any)
          .from("user_badges").select("id").eq("user_id", user.id).eq("badge_name", "Dev").maybeSingle();
        setHasDev(!!devBadge);

        // Fetch academic data
        const [pRes, sRes] = await Promise.all([
          (supabase as any).from("academic_periods").select("*").order("sort_order"),
          (supabase as any).from("academic_subjects").select("*"),
        ]);
        setPeriods(pRes.data || []);
        setSubjects(sRes.data || []);

        // Get student's academic slots
        const { data: membership } = await (supabase as any)
          .from("class_group_members").select("class_group_id").eq("student_id", user.id);
        const groupIds = membership?.map((m: any) => m.class_group_id) || [];

        let allSlots: Slot[] = [];
        if (groupIds.length) {
          const { data: classSlots } = await (supabase as any)
            .from("timetable_slots").select("*").in("class_group_id", groupIds).eq("is_elective", false);
          allSlots = classSlots || [];
        }
        const { data: enrollments } = await (supabase as any)
          .from("timetable_enrollments").select("slot_id").eq("student_id", user.id);
        if (enrollments?.length) {
          const { data: electiveSlots } = await (supabase as any)
            .from("timetable_slots").select("*").in("id", enrollments.map((e: any) => e.slot_id));
          allSlots = [...allSlots, ...(electiveSlots || [])];
        }
        setSlots(allSlots);

        // Teacher names
        const teacherIds = [...new Set(allSlots.map(sl => sl.teacher_id).filter(Boolean))] as string[];
        if (teacherIds.length) {
          const { data: tProfiles } = await supabase.from("profiles").select("id, full_name").in("id", teacherIds);
          const map: Record<string, string> = {};
          (tProfiles || []).forEach(t => { map[t.id] = t.full_name; });
          setTeachers(map);
        }

        // Co-curricular allocations
        const { data: allocData } = await supabase
          .from("allocations").select("*, activities(*)").eq("student_id", user.id);
        setAllocations((allocData as Allocation[] || []).filter(a => a.activities != null));
      } catch (error) {
        console.error("Error loading unified calendar:", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load calendar data" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Build unified events list
  const events = useMemo(() => {
    const result: CalendarEvent[] = [];

    // Academic slots → events
    for (const slot of slots) {
      const period = periods.find(p => p.sort_order === slot.period_number);
      const subject = subjects.find(s => s.id === slot.subject_id);
      if (!period || !subject || period.is_break) continue;

      result.push({
        type: "academic",
        title: subject.name,
        subtitle: slot.teacher_id ? (teachers[slot.teacher_id] || "") : "",
        startTime: period.start_time?.slice(0, 5) || "",
        endTime: period.end_time?.slice(0, 5) || "",
        color: subject.color || "#6366f1",
        room: slot.room,
        dayIndex: slot.day_of_week,
        sortOrder: period.sort_order,
      });
    }

    // Co-curricular allocations → events
    for (const alloc of allocations) {
      if (!alloc.activities) continue;
      const dayIdx = DAY_NAME_TO_INDEX[alloc.day_of_week];
      if (!dayIdx) continue;

      const isWed = alloc.day_of_week === "Wednesday";
      const times = isWed
        ? (alloc.slot_number === 2 ? CO_CURRICULAR_TIMES.wed_slot2 : CO_CURRICULAR_TIMES.wed_slot1)
        : CO_CURRICULAR_TIMES.default;

      result.push({
        type: "cocurricular",
        title: alloc.activities.title,
        subtitle: alloc.activities.teacher_in_charge,
        startTime: times.start,
        endTime: times.end,
        color: "hsl(215, 75%, 45%)",
        dayIndex: dayIdx,
        sortOrder: 100 + alloc.slot_number, // after academic
      });
    }

    return result;
  }, [slots, periods, subjects, teachers, allocations]);

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    for (let d = 1; d <= 5; d++) {
      map[d] = events.filter(e => e.dayIndex === d).sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  }, [events]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-gradient-to-r from-primary/8 via-background to-secondary/8">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/student")} className="hover:bg-primary/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                <CalendarDays className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Unified Calendar</h1>
                <p className="text-xs text-muted-foreground">Academic + Co-curricular</p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-3 mt-4">
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur rounded-xl px-3 py-1.5 border shadow-sm">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Academic</span>
            </div>
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur rounded-xl px-3 py-1.5 border shadow-sm">
              <Activity className="w-4 h-4 text-secondary" />
              <span className="text-xs font-medium">Co-curricular</span>
            </div>
            <div className="flex items-center gap-2 bg-card/80 backdrop-blur rounded-xl px-3 py-1.5 border shadow-sm">
              <span className="text-xs text-muted-foreground">{events.length} events/week</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {events.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <CalendarDays className="w-14 h-14 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium">No events to display</p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasDev ? "Your academic and co-curricular schedules will appear here." : "Your co-curricular activities will appear here once allocated."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop grid */}
            <div className="hidden md:grid grid-cols-5 gap-3">
              {DAY_LABELS.map((day, i) => {
                const dayIdx = i + 1;
                const dayEvents = eventsByDay[dayIdx] || [];
                return (
                  <div key={day} className="space-y-2">
                    <div className="text-center">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day}</p>
                      <p className="text-[10px] text-muted-foreground">{dayEvents.length} events</p>
                    </div>
                    <div className="space-y-1.5">
                      {dayEvents.map((evt, j) => (
                        <EventCard key={j} event={evt} compact />
                      ))}
                      {dayEvents.length === 0 && (
                        <div className="border border-dashed rounded-lg p-4 text-center">
                          <p className="text-[10px] text-muted-foreground">Free day</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile list */}
            <div className="md:hidden space-y-4">
              {DAY_LABELS.map((day, i) => {
                const dayIdx = i + 1;
                const dayEvents = eventsByDay[dayIdx] || [];
                if (dayEvents.length === 0) return null;
                return (
                  <div key={day}>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold">{day}</h3>
                      <Badge variant="outline" className="text-[10px]">{dayEvents.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {dayEvents.map((evt, j) => (
                        <EventCard key={j} event={evt} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

const EventCard = ({ event, compact }: { event: CalendarEvent; compact?: boolean }) => {
  const isAcademic = event.type === "academic";
  const bgStyle = isAcademic
    ? { backgroundColor: event.color + "15", borderLeftColor: event.color }
    : {};

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 transition-all hover:shadow-md",
        isAcademic ? "border-l-[3px]" : "border-l-[3px] border-l-secondary bg-secondary/5"
      )}
      style={bgStyle}
    >
      <div className="flex items-start gap-2">
        {!compact && (
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
            isAcademic ? "bg-primary/10" : "bg-secondary/10"
          )}>
            {isAcademic
              ? <GraduationCap className="w-3.5 h-3.5 text-primary" />
              : <Activity className="w-3.5 h-3.5 text-secondary" />
            }
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold truncate", compact ? "text-[11px]" : "text-sm")}>
            {event.title}
          </p>
          <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5", compact ? "text-[9px]" : "text-xs")}>
            <span className="text-muted-foreground flex items-center gap-0.5">
              <Clock className={cn(compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
              {event.startTime}–{event.endTime}
            </span>
            {event.subtitle && (
              <span className="text-muted-foreground flex items-center gap-0.5 truncate">
                <User className={cn(compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
                {event.subtitle}
              </span>
            )}
            {event.room && (
              <span className="text-muted-foreground flex items-center gap-0.5">
                <MapPin className={cn(compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
                {event.room}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedCalendar;
