import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calendar, User, MessageCircle, Edit3, Trash2, Users, Check } from "lucide-react";
import { useBoardData } from "@/hooks/useBoardData";
import { Card as CardType, UserLite } from "@/types/board";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardModal } from "@/components/board/CardModal";
import { toast } from "@/hooks/use-toast";

const priorityConfig = {
  low: {
    label: "Low Priority",
    className: "bg-priority-low-bg text-priority-low border-priority-low",
    description: "Non-urgent tasks that can be completed when time permits"
  },
  normal: {
    label: "Normal Priority", 
    className: "bg-priority-normal-bg text-priority-normal border-priority-normal",
    description: "Standard tasks with regular importance"
  },
  high: {
    label: "High Priority",
    className: "bg-priority-high-bg text-priority-high border-priority-high",
    description: "Urgent tasks that need immediate attention"
  }
};

const CardView = () => {
  const { cardId, projectId: projectIdFromParams } = useParams<{ cardId: string; projectId?: string }>();
  const navigate = useNavigate();
  const { board, updateCard, deleteCard, listUsers, assignUser, unassignUser } = useBoardData();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [comments, setComments] = useState<{ id: string; text: string; createdAt: Date; author?: { id: string; name: string; email: string } }[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [allUsers, setAllUsers] = useState<UserLite[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Inline assign/unassign picker state (same behavior as board card)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBusy, setPickerBusy] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // Find the card in all sections
  let foundCard: CardType | null = null;
  let sectionTitle = "";

  for (const section of board.sections) {
    const card = section.cards.find(c => c.id === cardId);
    if (card) {
      foundCard = card;
      sectionTitle = section.title;
      break;
    }
  }

  // Close picker on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!pickerOpen) return;
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [pickerOpen]);

  useEffect(() => {
    // load comments + users from API if card exists
    const load = async () => {
      if (!cardId) return;
      try {
        const base = import.meta.env.VITE_API_BASE ?? "http://localhost:4001/api";
        const projectId = window.location.pathname.match(/^\/project\/([^\/]+)/)?.[1] || "default";
        const [commentsRes, usersRes] = await Promise.allSettled([
          fetch(`${base}/projects/${projectId}/cards/${cardId}/comments`),
          listUsers().then((u) => ({ ok: true, json: () => u } as any)),
        ]);
        if (commentsRes.status === "fulfilled" && (commentsRes.value as Response).ok) {
          const data = await (commentsRes.value as Response).json();
          setComments(
            (data as { id: string; text: string; createdAt: string; author?: { id: string; name: string; email: string } }[]).map((c) => ({
              ...c,
              createdAt: new Date(c.createdAt),
            }))
          );
        }
        if (usersRes.status === "fulfilled") {
          const u = await (usersRes.value as any).json();
          setAllUsers(u as UserLite[]);
        }
      } catch (e) {
        console.error(e);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  // When opening picker, ensure users are loaded once
  useEffect(() => {
    (async () => {
      if (!pickerOpen) return;
      if (allUsers.length > 0) return;
      try {
        const u = await listUsers();
        setAllUsers(u);
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  const assignedIds = useMemo(() => new Set((foundCard?.assignees ?? []).map(a => a.id)), [foundCard?.assignees]);
  
  if (!foundCard) {
    return (
      <div className="min-h-screen bg-gradient-board flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Card Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The card you're looking for doesn't exist or has been deleted.
          </p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Board
          </Button>
        </Card>
      </div>
    );
  }

  const handleCardSave = (card: CardType) => {
    updateCard(card);
    toast({
      title: "Card updated",
      description: "Your changes have been saved",
    });
  };

  const handleCardDelete = (cardId: string) => {
    deleteCard(cardId);
    navigate("/");
    toast({
      title: "Card deleted",
      description: "Card has been removed from the board",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-board p-6">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-3">
          <Link to="/boards" className="hover:underline">Boards</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{projectIdFromParams || "default"}</span>
        </nav>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button 
            variant="outline" 
            onClick={() => navigate(`/project/${projectIdFromParams || "default"}`)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Board
          </Button>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              onClick={() => setEditModalOpen(true)}
              className="gap-2"
            >
              <Edit3 className="h-4 w-4" />
              Edit Card
            </Button>
            <Button 
              variant="destructive"
              onClick={() => handleCardDelete(foundCard!.id)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete Card
            </Button>
          </div>
        </div>

        {/* Main Card */}
        <Card className="bg-gradient-card shadow-card-hover p-8 animate-fade-in">
          {/* Title and Priority */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <h1 className="text-3xl font-bold text-card-foreground leading-tight flex-1">
              {foundCard.title}
            </h1>
            <Badge 
              className={`text-sm font-medium ${priorityConfig[foundCard.priority].className}`}
            >
              {priorityConfig[foundCard.priority].label}
            </Badge>
          </div>

          {/* Section and Meta Info */}
          <div className="flex items-center gap-6 mb-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span>Section: <span className="font-medium">{sectionTitle}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Created: {foundCard.createdAt.toLocaleDateString()}</span>
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Priority Description */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-medium mb-2">Priority Information</h3>
            <p className="text-sm text-muted-foreground">
              {priorityConfig[foundCard.priority].description}
            </p>
          </div>

          {/* Description */}
          {foundCard.description && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3 text-lg">Description</h3>
              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {foundCard.description}
                </p>
              </div>
            </div>
          )}

          {/* Assignees */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3 text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Assignees
            </h3>

            {/* Current assignees list */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {(foundCard.assignees ?? []).map((u) => (
                <div key={u.id} className="flex items-center gap-2">
                  <div
                    className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-muted text-xs font-medium border border-border"
                    title={u.name}
                  >
                    {u.name?.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!cardId) return;
                      setAssigning(true);
                      try {
                        await unassignUser(cardId, u.id);
                      } finally {
                        setAssigning(false);
                      }
                    }}
                  >
                    remove
                  </Button>
                </div>
              ))}
              {!foundCard.assignees?.length && (
                <Badge variant="outline" className="text-sm">
                  {foundCard.executor || "Unassigned"}
                </Badge>
              )}
            </div>

            {/* Inline custom searchable picker (same UX as board card) */}
            <div className="relative" ref={pickerRef}>
              <button
                type="button"
                className="inline-flex items-center gap-2 h-9 px-3 rounded-md border bg-background hover:bg-muted"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPickerOpen((o) => !o); }}
                disabled={!!pickerBusy}
                title="Assign / Unassign users"
              >
                <Users className="h-4 w-4" />
                <span className="text-sm">{pickerBusy ? "Working..." : "Assign / Unassign"}</span>
              </button>

              {pickerOpen && (
                <div
                  className="absolute z-20 mt-2 w-72 rounded-md border bg-popover shadow-md"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                  <div className="p-2 border-b">
                    <input
                      className="w-full h-9 px-2 text-sm rounded-md border bg-background"
                      placeholder="Search user..."
                      value={pickerQuery}
                      onChange={(e) => setPickerQuery(e.target.value)}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-auto p-1">
                    {(allUsers ?? [])
                      .filter((u) => {
                        const q = pickerQuery.trim().toLowerCase();
                        if (!q) return true;
                        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                      })
                      .map((u) => {
                        const isAssigned = assignedIds.has(u.id);
                        return (
                          <button
                            key={u.id}
                            className={`w-full text-left flex items-center gap-2 px-2 py-2 rounded hover:bg-muted ${isAssigned ? "text-foreground" : "text-muted-foreground"}`}
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!cardId) return;
                              try {
                                setPickerBusy(u.id);
                                if (isAssigned) {
                                  await unassignUser(cardId, u.id);
                                } else {
                                  await assignUser(cardId, u.id);
                                }
                              } finally {
                                setPickerBusy(null);
                              }
                            }}
                          >
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[11px] font-medium border border-border">
                              {u.name?.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                            <span className="flex-1 truncate">
                              {u.name}
                              <span className="text-xs text-muted-foreground"> — {u.email}</span>
                            </span>
                            {isAssigned && <Check className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    {allUsers.length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground">No users</div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Comments */}
          <div>
            <h3 className="font-semibold mb-4 text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Comments ({comments.length})
            </h3>
            
            {comments.length > 0 ? (
              <div className="space-y-4">
                {comments.map((comment) => {
                  const isAuthor = comment.author?.id && localStorage.getItem("userId") === comment.author.id;
                  const isEditing = editingId === comment.id;
                  return (
                    <Card key={comment.id} className="p-4 bg-muted/30">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {comment.author && (
                            <>
                              <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[11px] font-medium border border-border" title={comment.author.name}>
                                {comment.author.name.split(" ").map(p => p[0]).join("").slice(0,2).toUpperCase()}
                              </div>
                              <span className="text-xs text-muted-foreground">{comment.author.name}</span>
                            </>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {comment.createdAt.toLocaleString()}
                        </span>
                      </div>

                      {!isEditing ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{comment.text}</p>
                      ) : (
                        <div className="flex items-start gap-2">
                          <textarea
                            className="flex-1 rounded-md border px-3 py-2 text-sm bg-background"
                            rows={3}
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                          />
                          <div className="flex flex-col gap-2">
                            <Button
                              size="sm"
                              className="bg-gradient-primary hover:opacity-90"
                              onClick={async () => {
                                if (!editingText.trim()) return;
                                try {
                                  const projectId = window.location.pathname.match(/^\/project\/([^\/]+)/)?.[1] || "default";
                                  const res = await fetch(`${import.meta.env.VITE_API_BASE ?? "http://localhost:4001/api"}/projects/${projectId}/comments/${comment.id}`, {
                                    method: "PUT",
                                    headers: {
                                      "Content-Type": "application/json",
                                      Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
                                    },
                                    body: JSON.stringify({ text: editingText.trim() }),
                                  });
                                  if (res.ok) {
                                    const updated = await res.json();
                                    setComments((prev) =>
                                      prev.map((c) =>
                                        c.id === comment.id ? { ...c, text: updated.text } : c
                                      )
                                    );
                                    setEditingId(null);
                                    setEditingText("");
                                  }
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingId(null);
                                setEditingText("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {isAuthor && !isEditing && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditingText(comment.text);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                              try {
                                const projectId = window.location.pathname.match(/^\/project\/([^\/]+)/)?.[1] || "default";
                                const res = await fetch(`${import.meta.env.VITE_API_BASE ?? "http://localhost:4001/api"}/projects/${projectId}/comments/${comment.id}`, {
                                  method: "DELETE",
                                  headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
                                });
                                if (res.ok) {
                                  setComments((prev) => prev.filter((c) => c.id !== comment.id));
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No comments yet</p>
              </div>
            )}

            {/* Add comment */}
            <div className="mt-4 flex gap-2">
              <input
                className="flex-1 rounded-md border px-3 py-2 text-sm bg-background"
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newComment.trim()) {
                    try {
                      const projectId = window.location.pathname.match(/^\/project\/([^\/]+)/)?.[1] || "default";
                      const res = await fetch(`${import.meta.env.VITE_API_BASE ?? "http://localhost:4001/api"}/projects/${projectId}/cards/${cardId}/comments`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: newComment.trim() }),
                      });
                      if (res.ok) {
                        const c = await res.json();
                        setComments((prev) => [...prev, { ...c, createdAt: new Date(c.createdAt) }]);
                        setNewComment("");
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  }
                }}
              />
              <Button
                onClick={async () => {
                  if (!newComment.trim()) return;
                  try {
                    const projectId = window.location.pathname.match(/^\/project\/([^\/]+)/)?.[1] || "default";
                    const res = await fetch(`${import.meta.env.VITE_API_BASE ?? "http://localhost:4001/api"}/projects/${projectId}/cards/${cardId}/comments`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
                      },
                      body: JSON.stringify({ text: newComment.trim() }),
                    });
                    if (res.ok) {
                      const c = await res.json();
                      setComments((prev) => [...prev, { ...c, createdAt: new Date(c.createdAt) }]);
                      setNewComment("");
                      // save current user id for ownership checks
                      try {
                        const user = localStorage.getItem("user");
                        if (user) {
                          const parsed = JSON.parse(user) as { id?: string };
                          if (parsed?.id) localStorage.setItem("userId", parsed.id);
                        }
                      } catch {}
                    }
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="bg-gradient-primary hover:opacity-90"
              >
                Add
              </Button>
            </div>
          </div>
        </Card>

        <CardModal
          card={foundCard}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSave={handleCardSave}
          onDelete={handleCardDelete}
        />
      </div>
    </div>
  );
};

export default CardView;
