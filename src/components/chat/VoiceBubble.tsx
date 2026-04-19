import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

interface Props {
  url: string;
  durationMs?: number | null;
  isOwn?: boolean;
}

/** Lightweight canvas-rendered voice bubble — pseudo-waveform for vibe + real progress bar. */
export function VoiceBubble({ url, durationMs, isOwn }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [actualDuration, setActualDuration] = useState<number>(durationMs ? durationMs / 1000 : 0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      if (a.duration && isFinite(a.duration)) {
        setProgress(a.currentTime / a.duration);
        if (!actualDuration) setActualDuration(a.duration);
      }
    };
    const onEnd = () => { setPlaying(false); setProgress(0); };
    const onMeta = () => { if (a.duration && isFinite(a.duration)) setActualDuration(a.duration); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, [actualDuration]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };

  // Deterministic pseudo-waveform based on url hash (so each note looks unique but stable)
  const bars = Array.from({ length: 28 }).map((_, i) => {
    const seed = (url.charCodeAt(i % url.length) + i * 7) % 100;
    return 30 + (seed % 70); // 30%–99%
  });

  const fmt = (s: number) => {
    const total = Math.max(0, Math.floor(s));
    const m = Math.floor(total / 60); const r = total % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  const filledIdx = Math.floor(progress * bars.length);

  return (
    <div className={`inline-flex items-center gap-2 min-w-[200px] max-w-[280px] py-1 ${isOwn ? "" : ""}`}>
      <button
        onClick={toggle}
        className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition ${
          isOwn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-primary/15 hover:bg-primary/25 text-primary"
        }`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      <div className="flex-1 flex items-center gap-[2px] h-7">
        {bars.map((h, i) => (
          <span
            key={i}
            className={`w-[3px] rounded-full transition-colors ${
              i < filledIdx
                ? (isOwn ? "bg-white" : "bg-primary")
                : (isOwn ? "bg-white/40" : "bg-primary/30")
            }`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>

      <span className={`text-[11px] tabular-nums shrink-0 ${isOwn ? "text-white/80" : "text-muted-foreground"}`}>
        {fmt(playing ? (audioRef.current?.currentTime ?? 0) : actualDuration)}
      </span>

      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  );
}
