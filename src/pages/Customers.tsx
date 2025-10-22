import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";

type User = {
  id: string;
  name: string;
  email: string;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4001/api";

export default function Customers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/users`);
        const data = (await res.json()) as User[];
        setUsers(data);
      } catch (e) {
        console.error("Failed to load customers", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleLogout = () => {
    // If using JWT in localStorage, removing is sufficient for FE auth
    localStorage.removeItem("auth_token");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-board p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Customers</h1>
          <div className="flex items-center gap-3">
            <Link to="/boards">
              <Button variant="outline">Boards</Button>
            </Link>
            <Button variant="destructive" onClick={handleLogout}>Log out</Button>
          </div>
        </div>

        {loading ? (
          <Card className="p-6">Loading...</Card>
        ) : users.length === 0 ? (
          <Card className="p-6 text-muted-foreground">No customers.</Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((u) => (
              <Card key={u.id} className="p-4">
                <div className="font-semibold">{u.name}</div>
                <div className="text-muted-foreground text-sm">{u.email}</div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
