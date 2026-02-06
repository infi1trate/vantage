/**
 * Admin Challenges Filters Component
 * 
 * Filter controls for the challenges table.
 */

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

export type StatusFilter = "all" | "draft" | "scheduled" | "active" | "ended";
export type TypeFilter = "all" | "community" | "sponsored";

interface ChallengesFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  typeFilter: TypeFilter;
  onTypeChange: (type: TypeFilter) => void;
  gameFilter: string;
  onGameChange: (game: string) => void;
  availableGames: string[];
}

export function ChallengesFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  gameFilter,
  onGameChange,
  availableGames,
}: ChallengesFiltersProps) {
  const hasActiveFilters =
    searchQuery || statusFilter !== "all" || typeFilter !== "all" || gameFilter !== "all";

  const clearFilters = () => {
    onSearchChange("");
    onStatusChange("all");
    onTypeChange("all");
    onGameChange("all");
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search challenges..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-background/50"
        />
      </div>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as StatusFilter)}>
        <SelectTrigger className="w-[130px] bg-background/50">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="scheduled">Scheduled</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="ended">Ended</SelectItem>
        </SelectContent>
      </Select>

      {/* Type Filter */}
      <Select value={typeFilter} onValueChange={(v) => onTypeChange(v as TypeFilter)}>
        <SelectTrigger className="w-[140px] bg-background/50">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="community">Community</SelectItem>
          <SelectItem value="sponsored">Sponsored</SelectItem>
        </SelectContent>
      </Select>

      {/* Game Filter */}
      <Select value={gameFilter} onValueChange={onGameChange}>
        <SelectTrigger className="w-[150px] bg-background/50">
          <SelectValue placeholder="Game" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Games</SelectItem>
          {availableGames.map((game) => (
            <SelectItem key={game} value={game}>
              {game}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-10 px-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
