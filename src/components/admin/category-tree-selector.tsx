"use client";

import * as React from "react";
import { Check, ChevronsUpDown, ChevronRight, ChevronDown } from "lucide-react";
import { Category } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CategoryTreeSelectorProps {
  categories: Category[];
  value?: string;
  onChange: (value: string) => void;
}

type TreeNode = Category & {
  children: TreeNode[];
  level: number;
};

export function CategoryTreeSelector({
  categories,
  value,
  onChange,
}: CategoryTreeSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const getCategoryLabel = React.useCallback((cat: Category) => {
    const content = cat.content as any;
    return (
      content?.es?.name ||
      content?.en?.name ||
      cat.slug ||
      (cat as any).name ||
      "Unnamed"
    );
  }, []);

  // Build tree from flat list
  const tree = React.useMemo(() => {
    const nodes: Record<string, TreeNode> = {};
    const roots: TreeNode[] = [];

    // Initialize nodes
    categories.forEach((cat) => {
      nodes[cat.id] = { ...cat, children: [], level: 0 };
    });

    // Build hierarchy
    categories.forEach((cat) => {
      if (cat.parentId && nodes[cat.parentId]) {
        nodes[cat.parentId].children.push(nodes[cat.id]);
      } else {
        roots.push(nodes[cat.id]);
      }
    });

    // Sort by name (optional)
    const sortNodes = (n: TreeNode[]) => {
      n.sort((a, b) => getCategoryLabel(a).localeCompare(getCategoryLabel(b)));
      n.forEach((child) => sortNodes(child.children));
    };
    sortNodes(roots);

    return roots;
  }, [categories, getCategoryLabel]);

  // Find selected category name
  const selectedCategory = categories.find((c) => c.id === value);

  // Auto-expand path to selected category
  React.useEffect(() => {
    if (value && !open) {
      // Find path
      const path: string[] = [];
      let current = categories.find((c) => c.id === value);
      while (current && current.parentId) {
        path.push(current.parentId);
        current = categories.find((c) => c.id === current?.parentId);
      }

      setExpanded((prev) => {
        const next = { ...prev };
        path.forEach((id) => (next[id] = true));
        return next;
      });
    }
  }, [value, categories, open]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNode = (node: any, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expanded[node.id];
    const isSelected = value === node.id;

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center py-1.5 px-2 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors",
            isSelected && "bg-accent text-accent-foreground"
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleSelect(node.id)}
        >
          <div
            role="button"
            className={cn(
              "p-0.5 rounded-sm hover:bg-slate-200 dark:hover:bg-slate-700 mr-1 transition-colors flex items-center justify-center h-5 w-5",
              !hasChildren && "invisible"
            )}
            onClick={(e) => hasChildren && toggleExpand(node.id, e)}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </div>
          <span className="flex-1 truncate text-sm select-none">
            {getCategoryLabel(node)}
          </span>
          {isSelected && <Check className="ml-auto h-4 w-4 opacity-100" />}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child: any) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedCategory
            ? getCategoryLabel(selectedCategory)
            : "Select category..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="p-2 border-b">
          <p className="text-xs text-muted-foreground font-medium px-2">
            Select a category
          </p>
        </div>
        <ScrollArea className="h-[300px] p-1">
          {tree.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No categories found.
            </div>
          ) : (
            tree.map((node) => renderNode(node))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
