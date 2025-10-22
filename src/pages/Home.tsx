import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-board flex items-center justify-center p-6">
      <div className="max-w-xl w-full text-center space-y-6">
        <h1 className="text-4xl font-extrabold tracking-tight">Task Flow</h1>
        <p className="text-muted-foreground">
          Lightweight Trello-like board. Choose a board or create a new one.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/boards">
            <Button className="bg-gradient-primary hover:opacity-90">Browse Boards</Button>
          </Link>
          <Link to="/project/default">
            <Button variant="outline">Open Default Board</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
