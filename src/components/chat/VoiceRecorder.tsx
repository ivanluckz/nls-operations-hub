import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Trash2, Send, Loader2, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onSend: (blob: Blob, durationMs: number) => Promise<void> | void;
  disabled?: boolean;
}

/**
 * Tap-to-record voice composer. Shows preview with play/discard/send before submitting.
 * Uses MediaRecorder (audio/webm;codecs=opus) when available.
 */
export function VoiceRecorder({ onSend, disabled }: Props) {
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "recording" | "preview" | "uploading">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const durationRef = useRef<number>(0);

  useEffect(() => () => {
    cleanupStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (tickRef.current) window.clearInterval(tickRef.current);
  }, [previewUrl]);

  const cleanupStream = () => {
    recRef.current?.stream.getTracks().forEach(t => t.stop());
    recRef.current = null;
  };

  const start = async () => {
    if (disabled || state !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        blobRef.current = blob;
        durationRef.current = Date.now() - startedAtRef.current;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setState("preview");
        cleanupStream();
        if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
      };
      recRef.current = rec;
      rec.start();
      startedAtRef.current = Date.now();
      setElapsed(0);
      tickRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      setState("recording");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Microphone blocked", description: err.message || "Allow mic access in your browser." });
    }
  };

  const stop = () => {
    if (state !== "recording") return;
    recRef.current?.stop();
  };

  const discard = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    durationRef.current = 0;
    setState("idle");
    setElapsed(0);
    setPlaying(false);
  };

  const send = async () => {
    if (!blobRef.current) return;
    setState("uploading");
    try {
      await onSend(blobRef.current, durationRef.current);
      discard();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Send failed", description: err.message });
      setState("preview");
    }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60); const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  if (state === "recording") {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-destructive/10 border border-destructive/30 animate-pulse">
        <span className="h-2 w-2 rounded-full bg-destructive" />
        <span className="text-xs font-medium text-destructive tabular-nums">{fmt(elapsed)}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={stop} title="Stop recording">
          <Square className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (state === "preview" || state === "uploading") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 border border-primary/30">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={togglePlay} title="Preview">
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <span className="text-xs font-medium tabular-nums text-primary">
          {fmt(Math.floor(durationRef.current / 1000))}
        </span>
        <audio ref={audioRef} src={previewUrl || undefined} onEnded={() => setPlaying(false)} />
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={discard} disabled={state === "uploading"} title="Discard">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" className="h-7 w-7" onClick={send} disabled={state === "uploading"} title="Send voice note">
          {state === "uploading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
    );
  }

  return (
    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg flex-shrink-0" onClick={start} disabled={disabled} title="Record voice note">
      <Mic className="h-4 w-4" />
    </Button>
  );
}
