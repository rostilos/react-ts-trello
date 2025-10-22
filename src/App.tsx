import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  // Accept both legacy "token" and current "auth_token"
  const isAuthed =
    typeof window !== "undefined" &&
    (!!localStorage.getItem("auth_token") || !!localStorage.getItem("token"));

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    navigate("/login", { replace: true });
  };

  const linkClasses = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium ${location.pathname.startsWith(path) ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground"}`;

  return (
    <div className="w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">Task Flow</Link>
          <nav className="ml-4 flex items-center gap-1">
            <Link to="/boards" className={linkClasses("/boards")}>Boards</Link>
            <Link to="/customers" className={linkClasses("/customers")}>Customers</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {!isAuthed ? (
            <>
              <Link to="/login"><Button variant="outline" size="sm">Login</Button></Link>
              <Link to="/register"><Button size="sm" className="bg-gradient-primary hover:opacity-90">Register</Button></Link>
            </>
          ) : (
            <Button variant="destructive" size="sm" onClick={logout}>Log out</Button>
          )}
        </div>
      </div>
    </div>
  );
}

const App = ({ children }: { children?: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TopNav />
      <Toaster />
      <Sonner />
      {children}
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
