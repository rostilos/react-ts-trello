import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Filter, X, SlidersHorizontal } from "lucide-react";
import { Priority } from "@/types/board";
import { FilterState } from "@/hooks/useFilters";

interface FilterPanelProps {
  filters: FilterState;
  onUpdateFilter: (updates: Partial<FilterState>) => void;
  onTogglePriority: (priority: Priority) => void;
  onToggleExecutor: (executor: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  availableExecutors: string[];
}

const priorityConfig = {
  low: { label: "Low", color: "bg-priority-low text-priority-low-foreground" },
  normal: { label: "Normal", color: "bg-priority-normal text-priority-normal-foreground" },
  high: { label: "High", color: "bg-priority-high text-priority-high-foreground" }
};

export const FilterPanel = ({
  filters,
  onUpdateFilter,
  onTogglePriority,
  onToggleExecutor,
  onClearFilters,
  hasActiveFilters,
  availableExecutors
}: FilterPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(!isOpen)}
        className={`gap-2 transition-all duration-200 ${hasActiveFilters ? 'border-primary bg-primary/5' : ''}`}
      >
        <Filter className="h-4 w-4" />
        Filter
        {hasActiveFilters && (
          <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
            {filters.priorities.length + filters.executors.length}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute top-12 right-0 z-50 w-80 p-4 shadow-lg animate-fade-in">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Multi-filter toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="multi-filter"
                checked={filters.multiFilter}
                onCheckedChange={(checked) => 
                  onUpdateFilter({ multiFilter: !!checked })
                }
              />
              <label htmlFor="multi-filter" className="text-sm font-medium">
                Multi-filter (AND logic)
              </label>
            </div>

            {/* Priority filters */}
            <div>
              <h4 className="text-sm font-medium mb-2">Priority</h4>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(priorityConfig) as Priority[]).map((priority) => (
                  <Badge
                    key={priority}
                    variant={filters.priorities.includes(priority) ? "default" : "outline"}
                    className={`cursor-pointer transition-all hover:scale-105 ${
                      filters.priorities.includes(priority) 
                        ? priorityConfig[priority].color 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => onTogglePriority(priority)}
                  >
                    {priorityConfig[priority].label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Executor filters */}
            {availableExecutors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Executor</h4>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {availableExecutors.map((executor) => (
                    <Badge
                      key={executor}
                      variant={filters.executors.includes(executor) ? "default" : "outline"}
                      className="cursor-pointer transition-all hover:scale-105"
                      onClick={() => onToggleExecutor(executor)}
                    >
                      {executor}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Sort options */}
            <div>
              <h4 className="text-sm font-medium mb-2">Sort by</h4>
              <Select 
                value={filters.sortBy} 
                onValueChange={(value: any) => onUpdateFilter({ sortBy: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Creation Date</SelectItem>
                  <SelectItem value="priority-low-high">Priority: Low → High</SelectItem>
                  <SelectItem value="priority-high-low">Priority: High → Low</SelectItem>
                  <SelectItem value="priority-normal-first">Priority: Normal First</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClearFilters();
                  setIsOpen(false);
                }}
                className="w-full"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};