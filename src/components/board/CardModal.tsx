import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card as CardType, Priority, Comment, UserLite } from "@/types/board";
import { Trash2, MessageCircle, Send, Users, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useBoardData } from "@/hooks/useBoardData";

interface CardModalProps {
  card: CardType | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (card: CardType) => void;
  onDelete: (cardId: string) => void;
  isNew?: boolean;
}

const priorityConfig = {
  low: {
    label: "Low Priority",
    className: "bg-priority-low-bg text-priority-low border-priority-low"
  },
  normal: {
    label: "Normal Priority", 
    className: "bg-priority-normal-bg text-priority-normal border-priority-normal"
  },
  high: {
    label: "High Priority",
    className: "bg-priority-high-bg text-priority-high border-priority-high"
  }
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4001/api";

export const CardModal = ({ card, isOpen, onClose, onSave, onDelete, isNew = false }: CardModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [executor, setExecutor] = useState("");
  const [newComment, setNewComment] = useState("");
  // Users picker state (assign existing users at creation/edit)
  const { listUsers } = useBoardData();
  const [allUsers, setAllUsers] = useState<UserLite[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [userPickerQuery, setUserPickerQuery] = useState("");
  const userPickerRef = useRef<HTMLDivElement | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setError(null);
      if (card) {
        setTitle(card.title);
        setDescription(card.description);
        setPriority(card.priority);
        setExecutor(card.executor);
        // Load comments from API to have server truth
        try {
          setLoadingComments(true);
          const res = await fetch(`${API_BASE}/projects/${window.location.pathname.match(/^\/project\/([^\/]+)/)?.[1] || "default"}/cards/${card.id}/comments`);
          if (res.ok) {
            const data = await res.json();
            // Map to Comment type with Date objects
            const mapped: Comment[] = (data || []).map((c: any) => ({
              id: c.id,
              text: c.text,
              createdAt: new Date(c.createdAt),
            }));
            setComments(mapped);
          } else {
            // fallback to card-provided comments
            setComments(card.comments || []);
          }
        } catch {
          setComments(card.comments || []);
        } finally {
          setLoadingComments(false);
        }
      } else {
        setTitle("");
        setDescription("");
        setPriority("normal");
        setExecutor("");
        setComments([]);
      }
      setNewComment("");
    };
    init();
  }, [card]);

  // Initial users fetch (once on first open)
  useEffect(() => {
    let mounted = true;
    if (!isOpen) return;
    if (allUsers.length > 0) return;
    (async () => {
      setUsersLoading(true);
      try {
        const u = await listUsers();
        if (mounted) setAllUsers(u);
      } finally {
        if (mounted) setUsersLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Close user picker on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!userPickerOpen) return;
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setUserPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [userPickerOpen]);

  const selectedUser = useMemo(
    () => allUsers.find(u => u.id === selectedUserId) || null,
    [allUsers, selectedUserId]
  );

  const handleSave = () => {
    if (!title.trim()) return;

    const savedCard: CardType = {
      id: card?.id || `card-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      priority,
      // Prefer selected existing user name; fallback to manual executor input
      executor: (selectedUser?.name || executor).trim(),
      comments,
      createdAt: card?.createdAt || new Date(),
      sectionId: card?.sectionId || "backlog",
      // Include assignees array when user was selected to align with board schema
      assignees: selectedUser ? [{ id: selectedUser.id, name: selectedUser.name, email: selectedUser.email }] as any : (card?.assignees ?? []),
    };

    onSave(savedCard);
    onClose();
  };

  const resolveProjectId = () => {
    // Extract projectId from URL /project/:projectId
    const m = window.location.pathname.match(/^\/project\/([^\/]+)/);
    return m ? m[1] : "default";
  };

  const getAuthToken = () => {
    return localStorage.getItem("auth_token") || localStorage.getItem("token") || "";
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !card) return;
    setPosting(true);
    setError(null);
    try {
      const projectId = resolveProjectId();
      const res = await fetch(`${API_BASE}/projects/${projectId}/cards/${card.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ text: newComment.trim() })
      });
      if (!res.ok) {
        const m = await res.json().catch(() => ({}));
        throw new Error(m?.message || "Failed to create comment");
      }
      const created = await res.json();
      const c: Comment = {
        id: created.id,
        text: created.text,
        createdAt: new Date(created.createdAt),
      };
      setComments((prev) => [...prev, c]);
      setNewComment("");
    } catch (e: any) {
      setError(e.message || "Failed to create comment");
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!card) return;
    setError(null);
    try {
      const projectId = resolveProjectId();
      const res = await fetch(`${API_BASE}/projects/${projectId}/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${getAuthToken()}`
        }
      });
      if (!res.ok) {
        const m = await res.json().catch(() => ({}));
        throw new Error(m?.message || "Failed to delete comment");
      }
      setComments((prev) => prev.filter(c => c.id !== commentId));
    } catch (e: any) {
      setError(e.message || "Failed to delete comment");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {isNew ? "Create New Card" : "Edit Card"}
            {!isNew && card && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDelete(card.id);
                  onClose();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter card title..."
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter card description..."
              className="w-full min-h-[100px]"
            />
          </div>

          <div className="">
            <div className="mb-6">
              <label className="text-sm font-medium mb-2 block">Priority</label>
              <Select value={priority} onValueChange={(value: Priority) => setPriority(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="normal">Normal Priority</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="relative" ref={userPickerRef}>
              <label className="text-sm font-medium mb-2 block">Assignee</label>
              <div className="">
                <button
                  type="button"
                  className="mb-4 inline-flex items-center gap-2 h-9 px-3 rounded-md border bg-background hover:bg-muted"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUserPickerOpen(o => !o); }}
                  title="Pick from existing users"
                >
                  <Users className="h-4 w-4" />
                  <span className="text-sm">{selectedUser ? selectedUser.name : "Pick user"}</span>
                </button>
                <Input
                  value={executor}
                  onChange={(e) => setExecutor(e.target.value)}
                  placeholder="Or type name/email..."
                />
              </div>

              {userPickerOpen && (
                <div
                  className="absolute z-20 mt-2 w-80 rounded-md border bg-popover shadow-md"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                  <div className="p-2 border-b">
                    <input
                      className="w-full h-9 px-2 text-sm rounded-md border bg-background"
                      placeholder="Search user..."
                      value={userPickerQuery}
                      onChange={(e) => setUserPickerQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-auto p-1">
                    {usersLoading && (
                      <div className="px-2 py-2 text-xs text-muted-foreground">Loading users...</div>
                    )}
                    {(allUsers ?? [])
                      .filter((u) => {
                        const q = userPickerQuery.trim().toLowerCase();
                        if (!q) return true;
                        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                      })
                      .map((u) => {
                        const isSelected = selectedUserId === u.id;
                        return (
                          <button
                            key={u.id}
                            className={`w-full text-left flex items-center gap-2 px-2 py-2 rounded hover:bg-muted ${isSelected ? "text-foreground" : "text-muted-foreground"}`}
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedUserId(u.id);
                              setExecutor(u.name); // mirror into text input for visibility
                              setUserPickerOpen(false);
                            }}
                          >
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[11px] font-medium border border-border">
                              {u.name?.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                            <span className="flex-1 truncate">
                              {u.name}
                              <span className="text-xs text-muted-foreground"> — {u.email}</span>
                            </span>
                            {isSelected && <Check className="h-4 w-4" />}
                          </button>
                        );
                      })}
                    {!usersLoading && allUsers.length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground">No users</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isNew && (
            <div className="space-y-2">
              {error && <p className="text-sm text-red-500">{error}</p>}
              {loadingComments && <p className="text-sm text-muted-foreground">Loading comments...</p>}
            </div>
          )}
          {!isNew && comments.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Comments ({comments.length})
              </h4>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-muted p-3 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-muted-foreground">
                        {comment.createdAt instanceof Date ? comment.createdAt.toLocaleString() : new Date(comment.createdAt).toLocaleString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteComment(comment.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm">{comment.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isNew && (
            <div>
              <label className="text-sm font-medium mb-2 block">Add Comment</label>
              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1"
                  rows={2}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || posting}
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!title.trim()}
              className="bg-gradient-primary hover:opacity-90"
            >
              {isNew ? "Create Card" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
