import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { QrCode, Fingerprint } from "lucide-react";

const QRCodeCard = () => {
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");

  useEffect(() => {
    const fetchStudentInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setStudentId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          setStudentName(profile.full_name);
        }
      }
    };
    
    fetchStudentInfo();
  }, []);

  if (!studentId) return null;

  return (
    <Card className="shadow-lg overflow-hidden">
      <div className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Fingerprint className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Attendance QR</h3>
            <p className="text-xs text-muted-foreground">Show to mark attendance</p>
          </div>
        </div>
        
        <CardContent className="p-0 flex flex-col items-center">
          <div className="relative group">
            {/* QR code container with glow effect */}
            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative p-4 bg-white rounded-2xl shadow-lg ring-1 ring-black/5">
              <QRCodeSVG 
                value={JSON.stringify({ studentId, studentName })}
                size={160}
                level="H"
                includeMargin={false}
                className="rounded-lg"
              />
            </div>
            
            {/* Corner accents */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br-lg" />
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-sm font-medium">{studentName}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
              <QrCode className="w-3 h-3" />
              Scan for attendance
            </p>
          </div>
        </CardContent>
      </div>
    </Card>
  );
};

export default QRCodeCard;
