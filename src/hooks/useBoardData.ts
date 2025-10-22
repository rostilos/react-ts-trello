import React, { useState, useEffect } from "react";
import { Section, Card, Board, UserLite } from "@/types/board";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4001/api";

// Helper to attach Authorization header when a token exists
const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function reviveBoardDates(b: Board): Board {
  return {
    ...b,
    sections: b.sections.map((s) => ({
      ...s,
      cards: s.cards.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        comments: c.comments.map((cm) => ({
          ...cm,
          createdAt: new Date(cm.createdAt),
        })),
      })),
    })),
  };
}

/**
 * Project-aware board data hook.
 * Reads projectId from URL path /project/:projectId and calls project-scoped APIs.
 */
export const useBoardData = () => {
  const [board, setBoard] = useState<Board>({
    id: "main-board",
    title: "",
    sections: [
      { id: "backlog", title: "Backlog", cards: [], canDelete: false },
      { id: "todo", title: "To Do", cards: [], canDelete: true },
      { id: "review", title: "Review", cards: [], canDelete: true },
      { id: "done", title: "Done", cards: [], canDelete: true },
    ],
  });
  const [loaded, setLoaded] = useState(false);

  // Resolve projectId from URL path: expecting /project/:projectId
  const getProjectId = () => {
    const m = window.location.pathname.match(/^\/project\/([^\/]+)/);
    return m?.[1] || "default";
  };

  // Load from API on mount and when project changes
  useEffect(() => {
    const projectId = getProjectId();
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/board`);
        const data = (await res.json()) as Board;
        setBoard(reviveBoardDates(data));
      } catch (e) {
        console.error("Failed to load board from API:", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, [window.location.pathname]);

  // Sections
  const addSection = async (title: string) => {
    const projectId = getProjectId();
    const res = await fetch(`${API_BASE}/projects/${projectId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error("Failed to create section");
    const section = (await res.json()) as Section;
    setBoard((prev) => ({ ...prev, sections: [...prev.sections, section] }));
  };

  const deleteSection = async (sectionId: string) => {
    const projectId = getProjectId();
    const res = await fetch(`${API_BASE}/projects/${projectId}/sections/${sectionId}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error("Failed to delete section");
    // refetch board to reflect moved cards to backlog
    const b = await (await fetch(`${API_BASE}/projects/${projectId}/board`)).json();
    setBoard(reviveBoardDates(b));
  };

  const clearSection = async (sectionId: string) => {
    const projectId = getProjectId();
    const res = await fetch(`${API_BASE}/projects/${projectId}/sections/${sectionId}/clear`, {
      method: "POST",
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error("Failed to clear section");
    const b = await (await fetch(`${API_BASE}/projects/${projectId}/board`)).json();
    setBoard(reviveBoardDates(b));
  };

  const deleteAllSections = async () => {
    const projectId = getProjectId();
    const res = await fetch(`${API_BASE}/projects/${projectId}/sections/delete-all`, {
      method: "POST",
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error("Failed to delete all sections");
    const b = await (await fetch(`${API_BASE}/projects/${projectId}/board`)).json();
    setBoard(reviveBoardDates(b));
  };

  // Users (for assignees)
  // Important: stable reference to avoid triggering effects on each render
  const listUsers = async (): Promise<UserLite[]> => {
    const res = await fetch(`${API_BASE}/users`);
    if (!res.ok) throw new Error("Failed to list users");
    return res.json();
  };

  // Assignees
  const assignUser = async (cardId: string, userId: string) => {
    const projectId = getProjectId();
    const res = await fetch(`${API_BASE}/projects/${projectId}/cards/${cardId}/assignees`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error("Failed to assign user");
    const data = await res.json(); // { assignees: UserLite[] }
    setBoard((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        cards: s.cards.map((c) => (c.id === cardId ? { ...c, assignees: data.assignees } : c)),
      })),
    }));
  };

  const unassignUser = async (cardId: string, userId: string) => {
    const projectId = getProjectId();
    const res = await fetch(`${API_BASE}/projects/${projectId}/cards/${cardId}/assignees/${userId}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error("Failed to unassign user");
    const data = await res.json(); // { assignees: UserLite[] }
    setBoard((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        cards: s.cards.map((c) => (c.id === cardId ? { ...c, assignees: data.assignees } : c)),
      })),
    }));
  };

  // Cards
  const addCard = async (sectionId: string, card: Card) => {
    const projectId = getProjectId();
    const res = await fetch(`${API_BASE}/projects/${projectId}/sections/${sectionId}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        title: card.title,
        description: card.description,
        priority: card.priority,
        executor: card.executor,
      }),
    });
    if (!res.ok) throw new Error("Failed to add card");
    const created = await res.json();
    setBoard((prev) => {
      const sections = prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              cards: [
                ...s.cards,
                {
                  ...created,
                  createdAt: new Date(created.createdAt),
                  comments: [],
                },
              ],
            }
          : s
      );
      return { ...prev, sections };
    });
  };

  const updateCard = async (card: Card) => {
    const projectId = getProjectId();
    const res = await fetch(`${API_BASE}/projects/${projectId}/cards/${card.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        title: card.title,
        description: card.description,
        priority: card.priority,
        executor: card.executor,
        sectionId: card.sectionId,
      }),
    });
    if (!res.ok) throw new Error("Failed to update card");
    const updated = await res.json();
    setBoard((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        cards: s.cards.map((c) =>
          c.id === card.id
            ? {
                ...updated,
                createdAt: new Date(updated.createdAt ?? c.createdAt),
                comments:
                  updated.comments?.map((cm: any) => ({
                    ...cm,
                    createdAt: new Date(cm.createdAt),
                  })) ?? c.comments,
              }
            : c
        ),
      })),
    }));
  };

  const deleteCard = async (cardId: string) => {
    const projectId = getProjectId();
    const res = await fetch(`${API_BASE}/projects/${projectId}/cards/${cardId}`, { method: "DELETE", headers: { ...authHeaders() } });
    if (!res.ok) throw new Error("Failed to delete card");
    setBoard((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        cards: s.cards.filter((c) => c.id !== cardId),
      })),
    }));
  };

  const moveCard = async (cardId: string, targetSectionId: string) => {
    const projectId = getProjectId();
    const res = await fetch(`${API_BASE}/projects/${projectId}/cards/${cardId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ targetSectionId }),
    });
    if (!res.ok) throw new Error("Failed to move card");
    const moved = await res.json();
    // update client state using server response
    setBoard((prev) => {
      // remove from all sections then add to target
      const without = prev.sections.map((s) => ({
        ...s,
        cards: s.cards.filter((c) => c.id !== cardId),
      }));
      return {
        ...prev,
        sections: without.map((s) =>
          s.id === targetSectionId
            ? {
                ...s,
                cards: [
                  ...s.cards,
                  {
                    ...moved,
                    createdAt: new Date(moved.createdAt),
                    comments:
                      moved.comments?.map((cm: any) => ({
                        ...cm,
                        createdAt: new Date(cm.createdAt),
                      })) ?? [],
                  },
                ],
              }
            : s
        ),
      };
    });
  };

  // Memoize listUsers so consumers' useEffect([listUsers]) doesn't re-run every render
  // This prevents infinite/duplicate requests to /users caused by changing function identity.
  const memoListUsers = React.useCallback(listUsers, []);

  return {
    board,
    addSection,
    deleteSection,
    clearSection,
    deleteAllSections,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    // assignees/users
    listUsers: memoListUsers,
    assignUser,
    unassignUser,
    loaded,
  };
};
