import type { AcademicPeriod, TimetableSlot } from "@/types/academic";
import { ACADEMIC_DAYS, textColorForBg } from "@/types/academic";

interface AcademicWeeklyGridProps {
  periods: AcademicPeriod[];
  slots: TimetableSlot[];
}

/**
 * Reusable period×day timetable grid.
 * Breaks span full width. Lesson cells are colored by subject.
 */
export function AcademicWeeklyGrid({ periods, slots }: AcademicWeeklyGridProps) {
  // Build lookup map: "day-period" → slot
  const slotMap = new Map<string, TimetableSlot>();
  slots.forEach(s => slotMap.set(`${s.day_of_week}-${s.period_number}`, s));

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-3 py-3 w-28 font-medium text-muted-foreground text-xs">Period</th>
            {ACADEMIC_DAYS.map(day => (
              <th key={day} className="text-center px-2 py-3 font-medium text-xs min-w-[120px]">{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map(period => (
            <tr key={period.id} className={`border-b last:border-0 ${period.is_break ? "bg-muted/30" : ""}`}>
              <td className="px-3 py-2 align-top">
                <div className="font-medium text-xs leading-tight">{period.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {period.start_time.slice(0, 5)}–{period.end_time.slice(0, 5)}
                </div>
              </td>
              {period.is_break ? (
                <td colSpan={5} className="text-center text-xs text-muted-foreground py-3">
                  {period.label}
                </td>
              ) : (
                ACADEMIC_DAYS.map(day => {
                  const slot = slotMap.get(`${day}-${period.period_number}`);
                  const subj = slot?.academic_subjects;
                  return (
                    <td key={day} className="px-2 py-2">
                      {slot && subj ? (
                        <div
                          className="rounded px-2 py-2 h-full"
                          style={{ backgroundColor: subj.color, color: textColorForBg(subj.color) }}
                        >
                          <div className="font-semibold text-xs leading-tight truncate">{subj.name}</div>
                          {subj.code && (
                            <div className="text-xs opacity-75 font-mono">{subj.code}</div>
                          )}
                          {slot.teacher_profile?.full_name && (
                            <div className="text-xs opacity-80 truncate mt-0.5">
                              {slot.teacher_profile.full_name}
                            </div>
                          )}
                          {slot.room && (
                            <div className="text-xs opacity-70 truncate">{slot.room}</div>
                          )}
                          {slot.is_elective && (
                            <div className="text-xs opacity-70 italic">Elective</div>
                          )}
                        </div>
                      ) : (
                        <div className="h-full min-h-[3rem] flex items-center justify-center">
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        </div>
                      )}
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
