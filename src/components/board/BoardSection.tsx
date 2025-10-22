import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, MoreVertical, Trash2, RefreshCw } from "lucide-react";
import { Section, Card as CardType } from "@/types/board";
import { TaskCard } from "./TaskCard";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface BoardSectionProps {
  section: Section;
  onAddCard: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onClearSection: (sectionId: string) => void;
  onCardClick: (card: CardType) => void;
}

export const BoardSection = ({ 
  section, 
  onAddCard, 
  onDeleteSection, 
  onClearSection,
  onCardClick 
}: BoardSectionProps) => {
  const { setNodeRef } = useDroppable({
    id: section.id,
  });

  return (
    <Card className="bg-board-section/50 backdrop-blur-sm shadow-section p-4 min-h-[500px] w-80 flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-board-header text-lg">{section.title}</h3>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {section.cards.length}
          </span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => onClearSection(section.id)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear Section
              </DropdownMenuItem>
              {section.canDelete && (
                <DropdownMenuItem 
                  onClick={() => onDeleteSection(section.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Section
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Button 
        variant="ghost" 
        onClick={() => onAddCard(section.id)}
        className="w-full mb-4 border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Card
      </Button>

      <div 
        ref={setNodeRef}
        className="space-y-3 min-h-[400px]"
      >
        <SortableContext items={section.cards.map(card => card.id)} strategy={verticalListSortingStrategy}>
          {section.cards.map((card) => (
            <TaskCard 
              key={card.id} 
              card={card} 
              onClick={() => onCardClick(card)}
            />
          ))}
        </SortableContext>
      </div>
    </Card>
  );
};