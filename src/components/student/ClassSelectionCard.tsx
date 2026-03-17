import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Check } from "lucide-react";

const STUDENT_CLASSES = [
  "7A", "7B", "7C", "7D", "7E",
  "8A", "8B", "8C", "8D", "8E", "8F",
] as const;

const ClassSelectionCard = () => {
  const { toast } = useToast();
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClass();
  }, []);

  const fetchClass = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("student_class" as any)
        .eq("id", user.id)
        .single();
      setSelectedClass((profile as any)?.student_class || null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (cls: string) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ student_class: cls } as any)
        .eq("id", user.id);
      if (error) throw error;
      setSelectedClass(cls);
      toast({ title: "Class Selected! 🎓", description: `You're in ${cls}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="border-2 hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Your Class</CardTitle>
        </div>
        <CardDescription>
          {selectedClass ? `You're in ${selectedClass}` : "Choose your class to get started"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Grade 7</p>
          <div className="grid grid-cols-5 gap-2">
            {STUDENT_CLASSES.filter(c => c.startsWith("7")).map((cls) => {
              const isSelected = cls === selectedClass;
              return (
                <button
                  key={cls}
                  disabled={saving}
                  onClick={() => handleSelect(cls)}
                  className={`relative flex items-center justify-center rounded-xl border-2 p-3 transition-all hover:scale-105 font-bold text-sm ${
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
                  {cls}
                </button>
              );
            })}
          </div>
          <p className="text-xs font-medium text-muted-foreground pt-1">Grade 8</p>
          <div className="grid grid-cols-6 gap-2">
            {STUDENT_CLASSES.filter(c => c.startsWith("8")).map((cls) => {
              const isSelected = cls === selectedClass;
              return (
                <button
                  key={cls}
                  disabled={saving}
                  onClick={() => handleSelect(cls)}
                  className={`relative flex items-center justify-center rounded-xl border-2 p-3 transition-all hover:scale-105 font-bold text-sm ${
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
                  {cls}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClassSelectionCard;
