import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const StudentQRCode = () => {
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

  if (!studentId) {
    return null;
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>My Attendance QR Code</CardTitle>
        <CardDescription>Show this to your teacher for attendance</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="p-4 bg-white rounded-lg shadow-sm">
          <QRCodeSVG 
            value={JSON.stringify({ studentId, studentName })}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          {studentName}
        </p>
      </CardContent>
    </Card>
  );
};
