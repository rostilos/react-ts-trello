import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Project = { id: string; title: string };

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4001/api";

const Boards = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/projects`);
      const data = (await res.json()) as Project[];
      setProjects(data);
    } catch (e) {
      console.error("Failed to load projects", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createBoard = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() })
      });
      if (!res.ok) throw new Error("Failed to create project");
      const proj = (await res.json()) as Project;
      navigate(`/project/${proj.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-board p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Boards</h1>
        </div>

        <Card className="p-4 flex items-center gap-3">
          <Input
            placeholder="New board title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createBoard()}
          />
          <Button onClick={createBoard} disabled={creating || !newTitle.trim()} className="bg-gradient-primary hover:opacity-90">
            Create
          </Button>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <Card className="p-6">Loading...</Card>
          ) : projects.length === 0 ? (
            <Card className="p-6 text-muted-foreground">No boards yet. Create one above.</Card>
          ) : (
            projects.map((p) => (
              <Link key={p.id} to={`/project/${p.id}`}>
                <Card className="p-6 hover:shadow-card-hover transition-shadow">
                  <div className="font-semibold text-lg">{p.title}</div>
                  <div className="text-muted-foreground text-sm mt-1">ID: {p.id}</div>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Boards;
