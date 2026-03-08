import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera } from "lucide-react";
import { BrowserQRCodeReader } from "@zxing/library";

interface MealQRScannerProps {
  onScan: (studentId: string) => void;
  isActive: boolean;
}

const MealQRScanner = ({ onScan, isActive }: MealQRScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    const reader = new BrowserQRCodeReader();
    readerRef.current = reader;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (!result) return;
        const text = result.getText().trim();
        const now = Date.now();
        
        // Debounce: 1.5s cooldown per unique code
        if (text === lastScanRef.current && now - lastScanTimeRef.current < 1500) return;

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(text)) {
          lastScanRef.current = text;
          lastScanTimeRef.current = now;
          onScan(text);
        }
      })
      .then(() => setCameraReady(true))
      .catch((err) => console.error("Camera error:", err));

    return () => {
      reader.reset();
      readerRef.current = null;
      setCameraReady(false);
    };
  }, [isActive, onScan]);

  if (!isActive) return null;

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-square max-w-sm mx-auto">
        <video ref={videoRef} className="w-full h-full object-cover" />
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Camera className="h-8 w-8 animate-pulse text-muted-foreground" />
          </div>
        )}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Point camera at student QR code
      </p>
    </div>
  );
};

export default MealQRScanner;
