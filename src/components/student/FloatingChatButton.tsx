import { Button } from "@/components/ui/button";
import { MessageCircle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FloatingChatButton = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Pulse ring animation */}
      <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
      
      <Button
        onClick={() => navigate("/chatbot")}
        className="relative w-14 h-14 rounded-full shadow-lg shadow-primary/25 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all hover:scale-105 active:scale-95"
        size="icon"
      >
        <MessageCircle className="w-6 h-6" />
        
        {/* Sparkle indicator */}
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-secondary rounded-full flex items-center justify-center border-2 border-background">
          <Sparkles className="w-3 h-3 text-secondary-foreground" />
        </div>
      </Button>
    </div>
  );
};

export default FloatingChatButton;
