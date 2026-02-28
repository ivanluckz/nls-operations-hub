import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, ArrowLeft, FlaskConical } from "lucide-react";

const AcademicComingSoon = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center border-2 border-dashed border-primary/20">
        <CardHeader className="pb-4">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <GraduationCap className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Academic System</CardTitle>
          <CardDescription className="text-sm">
            Timetable, subjects, class groups & academic attendance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Badge variant="outline" className="text-sm px-4 py-2 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
            <FlaskConical className="w-4 h-4 mr-2" />
            In Testing — Request Access from Dev
          </Badge>
          <p className="text-sm text-muted-foreground">
            The Academic system is currently being tested internally.
            Contact the development team if you need early access.
          </p>
          <Button variant="outline" onClick={() => navigate(-1)} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcademicComingSoon;
