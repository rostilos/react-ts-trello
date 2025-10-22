import { useState } from "react";
import { DndContext, DragEndEvent, closestCorners } from "@dnd-kit/core";
import { BoardHeader } from "@/components/board/BoardHeader";
import { BoardSection } from "@/components/board/BoardSection";
import { CardModal } from "@/components/board/CardModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBoardData } from "@/hooks/useBoardData";
import { useFilters } from "@/hooks/useFilters";
import { Card, Priority } from "@/types/board";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const {
    board,
    addSection,
    deleteSection,
    clearSection,
    deleteAllSections,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    loaded,
  } = useBoardData();

  const {
    filters,
    updateFilter,
    togglePriority,
    toggleExecutor,
    clearFilters,
    hasActiveFilters
  } = useFilters();

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [newCardSectionId, setNewCardSectionId] = useState<string>("");
  const [addSectionModalOpen, setAddSectionModalOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const cardId = String(active.id);
    const dropId = String(over.id);

    // Find the section that currently contains the card
    const currentSection = board.sections.find((s) => s.cards.some((c) => c.id === cardId));
    const currentSectionId = currentSection?.id;

    // Only allow moves when dropping onto a section, not onto a card
    const targetSection = board.sections.find((s) => s.id === dropId);
    const targetSectionId = targetSection?.id;

    // If not dropped on a valid section or no change, do nothing
    if (!targetSectionId || targetSectionId === currentSectionId) {
      return;
    }

    moveCard(cardId, targetSectionId);
    toast({
      title: "Card moved",
      description: `Card moved to "${targetSection.title}"`,
    });
  };

  const handleAddCard = (sectionId: string) => {
    setNewCardSectionId(sectionId);
    setSelectedCard(null);
    setCardModalOpen(true);
  };

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
    setCardModalOpen(true);
  };

  const handleCardSave = (card: Card) => {
    if (selectedCard) {
      updateCard(card);
      toast({
        title: "Card updated",
        description: "Your changes have been saved",
      });
    } else {
      addCard(newCardSectionId, card);
      toast({
        title: "Card created",
        description: "New card has been added to the board",
      });
    }
  };

  const handleCardDelete = (cardId: string) => {
    deleteCard(cardId);
    toast({
      title: "Card deleted",
      description: "Card has been removed from the board",
    });
  };

  const handleAddSection = () => {
    setAddSectionModalOpen(true);
  };

  const handleSectionCreate = () => {
    if (newSectionTitle.trim()) {
      addSection(newSectionTitle.trim());
      setNewSectionTitle("");
      setAddSectionModalOpen(false);
      toast({
        title: "Section created",
        description: `"${newSectionTitle}" section has been added`,
      });
    }
  };

  const handleDeleteSection = (sectionId: string) => {
    const section = board.sections.find(s => s.id === sectionId);
    if (section?.canDelete) {
      deleteSection(sectionId);
      toast({
        title: "Section deleted",
        description: `"${section.title}" section and its cards moved to Backlog`,
      });
    }
  };

  const handleClearSection = (sectionId: string) => {
    clearSection(sectionId);
    const section = board.sections.find(s => s.id === sectionId);
    toast({
      title: "Section cleared",
      description: `All cards from "${section?.title}" moved to Backlog`,
    });
  };

  const handleDeleteAllSections = () => {
    deleteAllSections();
    toast({
      title: "All sections deleted",
      description: "All custom sections deleted, cards moved to Backlog",
    });
  };

  // Filter and sort cards
  const getFilteredAndSortedCards = (cards: Card[]) => {
    let filtered = [...cards];

    // Apply filters
    if (filters.priorities.length > 0 || filters.executors.length > 0) {
      filtered = cards.filter(card => {
        const priorityMatch = filters.priorities.length === 0 || filters.priorities.includes(card.priority);
        const executorMatch = filters.executors.length === 0 || filters.executors.includes(card.executor);
        
        if (filters.multiFilter) {
          // AND logic - both conditions must be true
          return priorityMatch && executorMatch;
        } else {
          // OR logic - at least one condition must be true
          return priorityMatch || executorMatch;
        }
      });
    }

    // Apply sorting
    const priorityOrder = { low: 1, normal: 2, high: 3 };
    
    switch (filters.sortBy) {
      case 'date':
        return filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      case 'priority-low-high':
        return filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
      case 'priority-high-low':
        return filtered.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
      case 'priority-normal-first':
        return filtered.sort((a, b) => {
          if (a.priority === 'normal' && b.priority !== 'normal') return -1;
          if (a.priority !== 'normal' && b.priority === 'normal') return 1;
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
      default:
        return filtered;
    }
  };

  // Get unique executors for filter options
  const availableExecutors = Array.from(
    new Set(
      board.sections.flatMap(section => 
        section.cards
          .map(card => card.executor)
          .filter(executor => executor && executor.trim() !== '')
      )
    )
  );

  // Apply filters to board sections
  const filteredBoard = {
    ...board,
    sections: board.sections.map(section => ({
      ...section,
      cards: getFilteredAndSortedCards(section.cards)
    }))
  };

  // Resolve current project id for breadcrumb
  const projectId = window.location.pathname.match(/^\/project\/([^\/]+)/)?.[1] || "default";
  // Compute header title robustly:
  // - Prefer API-loaded board.title when available
  // - Fallback to projectId
  // If not loaded yet, avoid flashing the default "My Trello Board"
  const headerTitle =
    loaded
      ? (board.title && board.title.trim().length > 0 ? board.title : projectId)
      : "";

  return (
    <div className="min-h-screen bg-gradient-board p-6">
      <div className="max-w-full mx-auto">
        {/* Breadcrumb */}
        <div className="text-sm text-muted-foreground mb-3">
          <a href="/boards" className="hover:underline">Boards</a>
          <span className="mx-2">/</span>
          <span className="text-foreground">{projectId}</span>
        </div>
        <BoardHeader
          onAddSection={handleAddSection}
          onDeleteAllSections={handleDeleteAllSections}
          filters={filters}
          onUpdateFilter={updateFilter}
          onTogglePriority={togglePriority}
          onToggleExecutor={toggleExecutor}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters()}
          availableExecutors={availableExecutors}
          title={headerTitle}
          subtitle={loaded ? `Project: ${projectId}` : undefined}
        />

        <DndContext 
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 overflow-x-auto pb-6">
            {filteredBoard.sections.map((section) => (
              <BoardSection
                key={section.id}
                section={section}
                onAddCard={handleAddCard}
                onDeleteSection={handleDeleteSection}
                onClearSection={handleClearSection}
                onCardClick={handleCardClick}
              />
            ))}
          </div>
        </DndContext>

        <CardModal
          card={selectedCard}
          isOpen={cardModalOpen}
          onClose={() => setCardModalOpen(false)}
          onSave={handleCardSave}
          onDelete={handleCardDelete}
          isNew={!selectedCard}
        />

        <Dialog open={addSectionModalOpen} onOpenChange={setAddSectionModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Section</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="Enter section title..."
                onKeyPress={(e) => e.key === 'Enter' && handleSectionCreate()}
              />
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setAddSectionModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSectionCreate}
                  disabled={!newSectionTitle.trim()}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  Create Section
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Index;
