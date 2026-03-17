import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HOUSE_IMAGES } from "@/lib/constants";

interface HouseInfo {
  name: string;
  color: string;
}

const HouseBadge = () => {
  const [house, setHouse] = useState<HouseInfo | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("house_id")
        .eq("id", user.id)
        .single();

      if (!(profile as any)?.house_id) return;

      const { data: houseData } = await (supabase as any)
        .from("houses")
        .select("name, color")
        .eq("id", (profile as any).house_id)
        .single();

      if (houseData) setHouse(houseData);
    };
    fetch();
  }, []);

  if (!house) return null;

  const img = HOUSE_IMAGES[house.name];

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
      style={{ borderColor: `${house.color}40`, backgroundColor: `${house.color}12` }}
    >
      {img && (
        <img
          src={img}
          alt={house.name}
          className="w-6 h-6 rounded-full object-cover"
        />
      )}
      <span className="text-xs font-semibold" style={{ color: house.color }}>
        {house.name}
      </span>
    </div>
  );
};

export default HouseBadge;
