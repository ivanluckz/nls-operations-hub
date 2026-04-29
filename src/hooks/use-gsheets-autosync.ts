import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Listens for realtime changes on workout_signups and allocations
 * and triggers the sync-google-sheets edge function. Debounced per-kind
 * so a burst of changes only produces one sync call.
 *
 * Mounted once at the admin layout level.
 */
export function useGoogleSheetsAutoSync(enabled: boolean) {
  const timers = useRef<{ workouts?: number; activities?: number }>({});

  useEffect(() => {
    if (!enabled) return;

    const trigger = (kind: "workouts" | "activities") => {
      window.clearTimeout(timers.current[kind]);
      timers.current[kind] = window.setTimeout(async () => {
        try {
          const { error } = await supabase.functions.invoke("sync-google-sheets", {
            body: { kind },
          });
          if (error) console.warn(`[gsheets] ${kind} sync failed`, error);
        } catch (e) {
          console.warn(`[gsheets] ${kind} sync error`, e);
        }
      }, 4000);
    };

    const ch = supabase
      .channel("gsheets-autosync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_signups" },
        () => trigger("workouts")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_teachers" },
        () => trigger("workouts")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workouts" },
        () => trigger("workouts")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "allocations" },
        () => trigger("activities")
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activities" },
        () => trigger("activities")
      )
      .subscribe();

    return () => {
      window.clearTimeout(timers.current.workouts);
      window.clearTimeout(timers.current.activities);
      supabase.removeChannel(ch);
    };
  }, [enabled]);
}
