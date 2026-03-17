import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Home, Check } from "lucide-react";
import { HOUSE_IMAGES } from "@/lib/constants";

interface House {
  id: string;
  name: string;
  color: string;
}

const HouseSelectionCard = () => {
  const { toast } = useToast();
  const [houses, setHouses] = useState<House[]>([]);
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: housesData }, { data: profile }] = await Promise.all([
        (supabase as any).from("houses").select("id, name, color").order("name"),
        supabase.from("profiles").select("house_id").eq("id", user.id).single(),
      ]);

      setHouses(housesData || []);
      setSelectedHouseId((profile as any)?.house_id || null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (houseId: string) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ house_id: houseId } as any)
        .eq("id", user.id);

      if (error) throw error;

      setSelectedHouseId(houseId);
      const house = houses.find(h => h.id === houseId);
      toast({ title: "House Selected! 🏠", description: `You've joined ${house?.name}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const currentHouse = houses.find(h => h.id === selectedHouseId);

  return (
    <Card className="border-2 hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Your House</CardTitle>
        </div>
        <CardDescription>
          {currentHouse ? `You're in ${currentHouse.name}` : "Choose your house to get started"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {houses.map((house) => {
            const isSelected = house.id === selectedHouseId;
            return (
              <button
                key={house.id}
                disabled={saving}
                onClick={() => handleSelect(house.id)}
                className={`relative flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all hover:scale-105 ${
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
                {HOUSE_IMAGES[house.name] ? (
                  <img
                    src={HOUSE_IMAGES[house.name]}
                    alt={house.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <span className="text-2xl">🏠</span>
                )}
                <span className="text-xs font-semibold" style={{ color: house.color }}>
                  {house.name}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default HouseSelectionCard;
