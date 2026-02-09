import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, Zap, Target } from "lucide-react";
import { BrowserQRCodeReader } from "@zxing/library";
import { SCAN_MODE, QR_SCAN_COOLDOWN_MS, ATTENDANCE_STATUS } from "@/lib/constants";
import type { ScanMode } from "@/lib/constants";

interface Student {
  student_id: string;
  student_name: string;
  student_email: string;
}

interface ScanResult {
  studentId: string;
  studentName: string;
  time: string;
}

interface QRScannerProps {
  students: Student[];
  attendance: Map<string, { student_id: string; status: string; scanned_at?: string }>;
  onStudentScanned: (studentId: string, scannedAt: string) => void;
}

const validateQRData = (data: unknown): { valid: boolean; studentId?: string; error?: string } => {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: "Invalid QR code format" };
  }
  const qrData = data as Record<string, unknown>;
  if (typeof qrData.studentId !== 'string') {
    return { valid: false, error: "Missing or invalid student ID" };
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(qrData.studentId)) {
    return { valid: false, error: "Invalid student ID format" };
  }
  return { valid: true, studentId: qrData.studentId };
};

const QRScanner = ({ students, attendance, onStudentScanned }: QRScannerProps) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserQRCodeReader | null>(null);
  const lastScanRef = useRef<number>(0);
  const [scanning, setScanning] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>(SCAN_MODE.CONTINUOUS);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);

  const scannedCount = Array.from(attendance.values()).filter(
    r => r.status === ATTENDANCE_STATUS.PRESENT || r.status === ATTENDANCE_STATUS.LATE
  ).length;

  useEffect(() => {
    codeReader.current = new BrowserQRCodeReader();
    return () => {
      stopScanning();
      if (codeReader.current) {
        codeReader.current.reset();
        codeReader.current = null;
      }
    };
  }, []);

  const startScanning = async () => {
    try {
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        beginDecode();
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      let errorMessage = "Unable to access camera";
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") errorMessage = "Camera permission denied. Please allow camera access in your browser settings.";
        else if (error.name === "NotFoundError") errorMessage = "No camera found. Please connect a camera and try again.";
        else if (error.name === "NotReadableError") errorMessage = "Camera is already in use by another application.";
      }
      toast({ variant: "destructive", title: "Camera Error", description: errorMessage });
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (codeReader.current) {
      codeReader.current.reset();
    }
    setScanning(false);
  };

  const beginDecode = async () => {
    if (!codeReader.current || !videoRef.current) return;
    try {
      await codeReader.current.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (!result) return;
        const now = Date.now();
        if (now - lastScanRef.current < QR_SCAN_COOLDOWN_MS) return;
        lastScanRef.current = now;

        try {
          const rawData = JSON.parse(result.getText());
          const validation = validateQRData(rawData);
          if (!validation.valid || !validation.studentId) {
            toast({ variant: "destructive", title: "Invalid QR Code", description: validation.error || "Could not read QR code data." });
            return;
          }

          const studentId = validation.studentId;
          const student = students.find(s => s.student_id === studentId);

          if (!student) {
            toast({ variant: "destructive", title: "Not Enrolled", description: "This student is not enrolled in this activity." });
            return;
          }

          const existing = attendance.get(studentId);
          if (existing && existing.status !== ATTENDANCE_STATUS.ABSENT) {
            toast({ title: "Already Marked", description: `${student.student_name} is already marked as ${existing.status}` });
            return;
          }

          const scannedAt = new Date().toISOString();
          onStudentScanned(studentId, scannedAt);

          setRecentScans(prev => [
            { studentId, studentName: student.student_name, time: new Date(scannedAt).toLocaleTimeString() },
            ...prev.slice(0, 19),
          ]);

          toast({ title: "✓ Scanned", description: `${student.student_name} at ${new Date(scannedAt).toLocaleTimeString()}` });

          if (scanMode === SCAN_MODE.SINGLE) {
            stopScanning();
          }
        } catch {
          toast({ variant: "destructive", title: "Invalid QR Code", description: "Could not read QR code data." });
        }
      });
    } catch (error) {
      console.error("Error scanning QR code:", error);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>QR Code Scanner</CardTitle>
          <div className="flex gap-2">
            <Badge
              variant={scanMode === SCAN_MODE.CONTINUOUS ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setScanMode(SCAN_MODE.CONTINUOUS)}
            >
              <Zap className="w-3 h-3 mr-1" />
              Continuous
            </Badge>
            <Badge
              variant={scanMode === SCAN_MODE.SINGLE ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setScanMode(SCAN_MODE.SINGLE)}
            >
              <Target className="w-3 h-3 mr-1" />
              Single
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!scanning ? (
          <Button onClick={startScanning} className="w-full">
            <Camera className="w-4 h-4 mr-2" />
            {scanMode === SCAN_MODE.CONTINUOUS ? "Start Continuous Scan" : "Start Scanning"}
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black" />
              {scanMode === SCAN_MODE.CONTINUOUS && (
                <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                  {scannedCount}/{students.length} scanned
                </div>
              )}
            </div>
            <Button onClick={stopScanning} variant="outline" className="w-full">
              Stop Scanning
            </Button>
          </div>
        )}

        {recentScans.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Recent Scans</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {recentScans.map((scan, i) => (
                <div key={`${scan.studentId}-${i}`} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <span>✓ {scan.studentName}</span>
                  <span className="text-muted-foreground">{scan.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QRScanner;
