"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLocalized } from "@/lib/content";
import { Category } from "@prisma/client";
import { useLocale } from "next-intl";

interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[];
}

interface CategoryTreeItemProps {
  category: CategoryWithChildren;
  currentCategoryId: string;
  level?: number;
  useQueryParams?: boolean;
  onSelect?: (slug: string) => void;
}

export function CategoryTreeItem({
  category,
  currentCategoryId,
  level = 0,
  useQueryParams = false,
  onSelect,
}: CategoryTreeItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = category.children && category.children.length > 0;
  const locale = useLocale();

  // Auto-expand if current category is active or has active child
  useEffect(() => {
    if (isChildActive(category, currentCategoryId)) {
      setIsOpen(true);
    }
  }, [category, currentCategoryId]);

  const content = getLocalized(category.content, locale);
  const isActive = category.id === currentCategoryId;

  return (
    <li className="text-base select-none">
      <div
        className={cn(
          "flex items-center justify-between py-1.5 group rounded-lg hover:bg-muted pr-2",
          isActive && "bg-accent/10"
        )}
      >
        <Link
          href={
            useQueryParams
              ? `?category=${category.slug}`
              : `/category/${category.slug}`
          }
          className={cn(
            "flex-1 hover:text-accent transition-colors px-2",
            isActive
              ? "text-accent font-bold"
              : "text-muted-foreground group-hover:text-accent"
          )}
        >
          {content.name}
        </Link>
        {hasChildren && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="p-1 text-muted-foreground hover:text-accent rounded-full hover:bg-muted"
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>

      {hasChildren && isOpen && (
        <ul className="border-l border-border ml-3 pl-3 space-y-1 mt-1 animate-in slide-in-from-top-2 duration-200">
          {category.children!.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              currentCategoryId={currentCategoryId}
              level={level + 1}
              useQueryParams={useQueryParams}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function isChildActive(
  category: CategoryWithChildren,
  currentId: string
): boolean {
  if (category.id === currentId) return true;
  if (category.children) {
    return category.children.some((child) => isChildActive(child, currentId));
  }
  return false;
}
