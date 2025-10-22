import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { FilterPanel } from "./FilterPanel";
import { FilterState } from "@/hooks/useFilters";

interface BoardHeaderProps {
  onAddSection: () => void;
  onDeleteAllSections: () => void;
  filters: FilterState;
  onUpdateFilter: (updates: Partial<FilterState>) => void;
  onTogglePriority: (priority: any) => void;
  onToggleExecutor: (executor: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  availableExecutors: string[];
  title?: string;
  subtitle?: string;
}

export const BoardHeader = ({ 
  onAddSection, 
  onDeleteAllSections,
  filters,
  onUpdateFilter,
  onTogglePriority,
  onToggleExecutor,
  onClearFilters,
  hasActiveFilters,
  availableExecutors,
  title,
  subtitle
}: BoardHeaderProps) => {
  return (
    <div className="mb-6 md:mb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent truncate">
            {title ?? "Board"}
          </h1>
          {subtitle && <p className="text-muted-foreground mt-1 md:mt-2 truncate">{subtitle}</p>}
        </div>

        {/* Actions stacked on small screens */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="order-2 sm:order-1">
            <FilterPanel
              filters={filters}
              onUpdateFilter={onUpdateFilter}
              onTogglePriority={onTogglePriority}
              onToggleExecutor={onToggleExecutor}
              onClearFilters={onClearFilters}
              hasActiveFilters={hasActiveFilters}
              availableExecutors={availableExecutors}
            />
          </div>

          <div className="flex gap-2 order-1 sm:order-2">
            <Button 
              onClick={onAddSection}
              className="gap-2 bg-gradient-primary hover:opacity-90 transition-opacity flex-1 sm:flex-none"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden xs:inline">Add Section</span>
              <span className="xs:hidden">Add</span>
            </Button>
            
            <Button 
              variant="destructive"
              onClick={onDeleteAllSections}
              className="gap-2 flex-1 sm:flex-none"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden md:inline">Delete All Sections</span>
              <span className="md:hidden">Delete All</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
