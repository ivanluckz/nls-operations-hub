import { Button } from "@/components/ui/button";
import { LogOut, Sparkles } from "lucide-react";

interface WelcomeHeaderProps {
  name: string;
  onLogout: () => void;
}

const WelcomeHeader = ({ name, onLogout }: WelcomeHeaderProps) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <header className="relative overflow-hidden border-b bg-gradient-to-r from-primary/5 via-background to-secondary/5">
      {/* Decorative elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="container relative mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                <span className="text-2xl font-bold text-primary-foreground">
                  {name?.charAt(0)?.toUpperCase() || "S"}
                </span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-success rounded-full border-2 border-background flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-success-foreground" />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">{getGreeting()}</p>
              <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={onLogout}
            className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default WelcomeHeader;
