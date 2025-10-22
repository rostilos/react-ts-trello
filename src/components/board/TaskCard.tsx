import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Card as CardType, UserLite } from "@/types/board";
import { MessageCircle, User, Users, Check } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";
import { useBoardData } from "@/hooks/useBoardData";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface TaskCardProps {
  card: CardType;
  onClick: () => void;
}

const priorityConfig = {
  low: {
    label: "Low",
    className: "bg-priority-low-bg text-priority-low border-priority-low"
  },
  normal: {
    label: "Normal", 
    className: "bg-priority-normal-bg text-priority-normal border-priority-normal"
  },
  high: {
    label: "High",
    className: "bg-priority-high-bg text-priority-high border-priority-high"
  }
};

export const TaskCard = ({ card, onClick }: TaskCardProps) => {
  const navigate = useNavigate();
  const { listUsers, assignUser, unassignUser } = useBoardData();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingUsers(true);
      try {
        const u = await listUsers();
        if (mounted) setUsers(u);
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [listUsers]);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const assignedIds = useMemo(() => new Set((card.assignees ?? []).map(a => a.id)), [card.assignees]);

  // Refresh users when the picker opens for the first time to ensure we have data
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!open) return;
      // if already loaded once, do not re-fetch every open
      if (users.length > 0) return;
      setLoadingUsers(true);
      try {
        const u = await listUsers();
        if (mounted) setUsers(u);
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    // dnd-kit provides an isSorting/isDraggingOver in other hooks but not here;
    // we'll rely on isDragging and our own click handling
  } = useSortable({
    id: card.id,
    data: { type: "card", cardId: card.id, sectionId: card.sectionId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = (e: React.MouseEvent) => {
    // If a drag is occurring, ignore clicks to prevent accidental navigation
    if (isDragging) return;
    // If the picker is open, treat click as UI interaction, not navigation
    if (open) return;
    e.stopPropagation();
    // Resolve current projectId from URL if we are on a project page; fall back to "default"
    const m = window.location.pathname.match(/^\/project\/([^\/]+)/);
    const projectId = m?.[1] || "default";
    navigate(`/project/${projectId}/card/${card.id}`);
  };


  return (
    <Card
      ref={setNodeRef}
      style={style}
      // Attach sortable attributes to the root to register it in the DnD system,
      // but DO NOT attach drag listeners to the whole card to avoid interpreting clicks as drags.
      {...attributes}
      onClick={handleClick}
      className={`
        bg-gradient-card shadow-card hover:shadow-card-hover 
        transition-all duration-300 cursor-pointer p-4 group relative
        ${isDragging ? "opacity-50 rotate-3 scale-95" : "hover:scale-[1.02]"}
      `}
    >
      <div className="space-y-3">
        {/* Small drag handle to start dragging explicitly */}
        <div
          {...listeners}
          className="absolute right-2 top-2 h-4 w-4 cursor-grab active:cursor-grabbing opacity-40 hover:opacity-80"
          title="Drag"
          onClick={(e) => e.stopPropagation()}
        >
          {/* simple handle dots */}
          <div className="grid grid-cols-2 gap-0.5">
            <span className="block h-1 w-1 bg-foreground/50 rounded-sm" />
            <span className="block h-1 w-1 bg-foreground/50 rounded-sm" />
            <span className="block h-1 w-1 bg-foreground/50 rounded-sm" />
            <span className="block h-1 w-1 bg-foreground/50 rounded-sm" />
          </div>
        </div>
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-card-foreground leading-tight flex-1">
            {card.title}
          </h4>
          <Badge 
            variant="outline" 
            className={`text-xs font-medium ${priorityConfig[card.priority].className}`}
          >
            {priorityConfig[card.priority].label}
          </Badge>
        </div>

        {card.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {card.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              {(card.assignees ?? []).slice(0, 3).map((u: UserLite) => (
                <div
                  key={u.id}
                  className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted text-[10px] font-medium border border-border"
                  title={u.name}
                >
                  {u.name?.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              ))}
              {(!card.assignees || card.assignees.length === 0) && (
                <div className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{card.executor || "Unassigned"}</span>
                </div>
              )}
              {card.assignees && card.assignees.length > 3 && (
                <div className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted text-[10px] font-medium border border-border">
                  +{card.assignees.length - 3}
                </div>
              )}
            </div>

            {/* Inline custom searchable picker */}
            <div className="relative" ref={pickerRef} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="inline-flex items-center gap-1 h-6 px-2 rounded-sm border bg-background hover:bg-muted"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
                disabled={!!busy}
                title="Assign / Unassign users"
              >
                <Users className="h-3.5 w-3.5" />
                <span className="text-[11px]">{busy ? "Working..." : "Assign"}</span>
              </button>

              {open && (
                <div
                  className="absolute z-20 mt-1 w-56 rounded-md border bg-popover shadow-md"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                  <div className="p-2 border-b">
                    <input
                      className="w-full h-8 px-2 text-sm rounded-md border bg-background"
                      placeholder="Search user..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-52 overflow-auto p-1">
                    {loadingUsers && (
                      <div className="px-2 py-2 text-xs text-muted-foreground">Loading users...</div>
                    )}
                    {(users ?? [])
                      .filter((u) => {
                        const q = query.trim().toLowerCase();
                        if (!q) return true;
                        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                      })
                      .map((u) => {
                        const isAssigned = assignedIds.has(u.id);
                        return (
                          <button
                            key={u.id}
                            className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted ${isAssigned ? "text-foreground" : "text-muted-foreground"}`}
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              try {
                                setBusy(u.id);
                                if (isAssigned) {
                                  await unassignUser(card.id, u.id);
                                  toast({ title: "User unassigned" });
                                } else {
                                  await assignUser(card.id, u.id);
                                  toast({ title: "User assigned" });
                                }
                              } catch (err) {
                                console.error(err);
                                toast({ title: "Assignment failed", description: "Please try again.", variant: "destructive" });
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted text-[10px] font-medium border border-border">
                              {u.name?.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                            <span className="flex-1 truncate">
                              {u.name}
                              <span className="text-xs text-muted-foreground"> — {u.email}</span>
                            </span>
                            {isAssigned && <Check className="h-3.5 w-3.5" />}
                          </button>
                        );
                      })}
                    {!loadingUsers && users.length === 0 && (
                      <div className="px-2 py-2 text-xs text-muted-foreground">No users</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {card.comments.length > 0 && (
            <div className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              <span>{card.comments.length}</span>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {card.createdAt.toLocaleDateString()}
        </div>
      </div>
    </Card>
  );
};
