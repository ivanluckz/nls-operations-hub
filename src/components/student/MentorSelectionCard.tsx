import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, Check } from "lucide-react";

interface Teacher {
  id: string;
  full_name: string;
}

const MentorSelectionCard = () => {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current mentor_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("mentor_id" as any)
        .eq("id", user.id)
        .single();

      setSelectedMentorId((profile as any)?.mentor_id || null);

      // Get all teachers (and moderators who could be mentors)
      const { data: teacherRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["teacher", "moderator"] as any[]);

      if (teacherRoles && teacherRoles.length > 0) {
        const { data: teacherProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", teacherRoles.map(r => r.user_id))
          .order("full_name");

        setTeachers(teacherProfiles || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (teacherId: string) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ mentor_id: teacherId } as any)
        .eq("id", user.id);
      if (error) throw error;
      setSelectedMentorId(teacherId);
      const teacher = teachers.find(t => t.id === teacherId);
      toast({ title: "Mentor Selected! 🧑‍🏫", description: `Your mentor is ${teacher?.full_name}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const currentMentor = teachers.find(t => t.id === selectedMentorId);

  return (
    <Card className="border-2 hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Your Mentor</CardTitle>
        </div>
        <CardDescription>
          {currentMentor ? `Your mentor is ${currentMentor.full_name}` : "Choose your mentor teacher"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {teachers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No teachers available</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {teachers.map((teacher) => {
              const isSelected = teacher.id === selectedMentorId;
              return (
                <button
                  key={teacher.id}
                  disabled={saving}
                  onClick={() => handleSelect(teacher.id)}
                  className={`relative flex items-center gap-2 rounded-xl border-2 p-3 transition-all hover:scale-[1.02] text-left ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-muted hover:border-primary/40"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <span className="text-sm font-medium truncate">{teacher.full_name}</span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MentorSelectionCard;
