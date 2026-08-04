// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// View switcher, search, watched filter and sort for the object/class/field
// apps. Desktop renders a PageUtilityBar; below the sm breakpoint the same
// controls move into a bottom sheet behind one button.


import { useState, useMemo } from "react";
import { Trans, useLingui } from '@lingui/react/macro'
import { t } from '@lingui/core/macro'
import { Eye, SlidersHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { PageUtilityBar } from "../layout/page-utility-bar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { SortDirectionButton } from "../ui/sort-direction-button";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { ViewTabs } from "../view-tabs";
import type { FilterState } from "../filter-bar";
import type {
  EntityField,
  EntitySortState,
  EntityView,
} from "../../types/entity-object";

function useBuiltInSortOptions() {
  const { t } = useLingui();
  return useMemo(
    () => [
      { id: "rank", label: t`Manual` },
      { id: "number", label: t`Number` },
      { id: "created", label: t`Created` },
      { id: "updated", label: t`Updated` },
    ],
    [t],
  );
}

export interface EntityViewOptionsBarProps {
  views: EntityView[];
  fields?: EntityField[];
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  activeViewId: string;
  onViewChange: (viewId: string) => void;
  sort: EntitySortState | null;
  onSortChange: (sort: EntitySortState) => void;
  showSort: boolean;
}

export function EntityViewOptionsBar({
  views,
  fields,
  filters,
  onFilterChange,
  activeViewId,
  onViewChange,
  sort,
  onSortChange,
  showSort,
}: EntityViewOptionsBarProps) {
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const builtInSortOptions = useBuiltInSortOptions();
  const hasSearchValue = filters.search.trim().length > 0;

  // Build sort options: built-in + fields with 'sort' flag.
  // A view's designed default sort can name any field (the design editor lists
  // them all), not just the flagged ones — so keep whatever is currently active
  // in the list, or the dropdown renders blank next to a correctly sorted board.
  const activeSortId = sort?.field || "rank";
  const sortFieldOptions = useMemo(() => {
    const options = (fields || [])
      .filter((f) => f.flags?.split(",").includes("sort"))
      .map((f) => ({ id: `field:${f.id}`, label: f.name }));
    if (activeSortId.startsWith("field:") && !options.some((o) => o.id === activeSortId)) {
      const fieldId = activeSortId.slice("field:".length);
      const field = (fields || []).find((f) => f.id === fieldId);
      options.push({ id: activeSortId, label: field?.name || fieldId });
    }
    return options;
  }, [fields, activeSortId]);

  const updateSearch = (search: string) => {
    onFilterChange({ ...filters, search });
  };

  const hasActiveMobileControls =
    hasSearchValue ||
    filters.watched ||
    (showSort && (sort?.field || "rank") !== "rank") ||
    (showSort && (sort?.direction || "asc") !== "asc");

  return (
    <>
      <div className="sticky top-[calc(var(--sticky-top,0px)+56px)] z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:hidden">
        <div className="flex items-center">
          <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <div className="flex min-w-max items-center px-4 py-2">
              <ViewTabs variant="pill" views={views} activeViewId={activeViewId} onViewChange={onViewChange} />
            </div>
          </div>
          <div className="flex shrink-0 items-center border-s px-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={hasActiveMobileControls ? "default" : "ghost"}
                  size="icon"
                  className="size-9"
                  aria-label={t`Open view controls`}
                  onClick={() => setIsMobileControlsOpen(true)}
                >
                  <SlidersHorizontal className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t`Open view controls`}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <Sheet open={isMobileControlsOpen} onOpenChange={setIsMobileControlsOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[80vh] gap-0 rounded-t-lg p-0 sm:hidden"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle><Trans>View controls</Trans></SheetTitle>
            <SheetDescription><Trans>Search, watch, and sort this view.</Trans></SheetDescription>
          </SheetHeader>
          <div className="space-y-5 overflow-y-auto p-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="entity-mobile-view-search"><Trans>Search</Trans></Label>
              <Input
                id="entity-mobile-view-search"
                type="search"
                placeholder={t`Search...`}
                value={filters.search}
                onChange={(e) => updateSearch(e.target.value)}
              />
            </div>

            <Button
              variant={filters.watched ? "default" : "outline"}
              className="w-full justify-start"
              aria-label={t`Toggle watched filter`}
              onClick={() => onFilterChange({ ...filters, watched: !filters.watched })}
            >
              <Eye className="size-4" />
              <Trans>Watched only</Trans>
            </Button>

            {showSort && (
              <div className="space-y-2">
                <Label><Trans>Sort</Trans></Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={sort?.field || "rank"}
                    onValueChange={(value) =>
                      onSortChange({ field: value, direction: sort?.direction || "asc" })
                    }
                  >
                    <SelectTrigger className="min-w-0 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortFieldOptions.length > 0 && (
                        <>
                          <SelectGroup>
                            {sortFieldOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectSeparator />
                        </>
                      )}
                      <SelectGroup>
                        {builtInSortOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <SortDirectionButton
                    direction={sort?.direction || "asc"}
                    onToggle={() =>
                      onSortChange({
                        field: sort?.field || "rank",
                        direction: sort?.direction === "asc" ? "desc" : "asc",
                      })
                    }
                    size="sm"
                  />
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <PageUtilityBar compact scrollable className="hidden sm:block">
        <ViewTabs variant="pill" views={views} activeViewId={activeViewId} onViewChange={onViewChange} />

        <div className="bg-border mx-1 h-6 w-px shrink-0" />

        <Input
          type="search"
          placeholder={t`Search...`}
          value={filters.search}
          onChange={(e) => updateSearch(e.target.value)}
          className="h-9 w-[200px] text-xs"
        />

        <Button
          variant={filters.watched ? "default" : "ghost"}
          size="sm"
          className="px-2 text-xs"
          aria-label={t`Toggle watched filter`}
          onClick={() => onFilterChange({ ...filters, watched: !filters.watched })}
        >
          <Eye className="size-3.5 sm:me-1" />
          <span><Trans>Watched</Trans></span>
        </Button>

        {showSort && (
          <div className="flex items-center gap-2">
            <Select
              value={sort?.field || "rank"}
              onValueChange={(value) =>
                onSortChange({ field: value, direction: sort?.direction || "asc" })
              }
            >
              <SelectTrigger className="w-[132px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortFieldOptions.length > 0 && (
                  <>
                    <SelectGroup>
                      {sortFieldOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                  </>
                )}
                <SelectGroup>
                  {builtInSortOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <SortDirectionButton
              direction={sort?.direction || "asc"}
              onToggle={() =>
                onSortChange({
                  field: sort?.field || "rank",
                  direction: sort?.direction === "asc" ? "desc" : "asc",
                })
              }
              size="sm"
              className="size-9"
            />
          </div>
        )}
      </PageUtilityBar>
    </>
  );
}

