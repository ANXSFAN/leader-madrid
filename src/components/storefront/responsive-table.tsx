"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ResponsiveTableProps {
  children: ReactNode;
  className?: string;
}

interface TableColumn {
  key: string;
  label: string;
  hideOnMobile?: boolean;
}

interface ResponsiveTableCardProps {
  children: ReactNode;
  className?: string;
}

interface TableRowData {
  [key: string]: ReactNode;
}

interface ResponsiveTableContainerProps {
  columns: TableColumn[];
  data: TableRowData[];
  keyField: string;
  mobileCardTitle?: (row: TableRowData) => ReactNode;
  mobileCardSubtitle?: (row: TableRowData) => ReactNode;
  className?: string;
  emptyMessage?: string;
  children?: (row: TableRowData, column: TableColumn) => ReactNode;
}

function ResponsiveTable({ children, className }: ResponsiveTableProps) {
  return (
    <div className={cn("rounded-md border overflow-x-auto", className)}>
      <Table>{children}</Table>
    </div>
  );
}

function ResponsiveTableCard({ children, className }: ResponsiveTableCardProps) {
  return (
    <div className={cn("bg-card rounded-lg border border-border p-4 shadow-sm", className)}>
      {children}
    </div>
  );
}

function TableColumnDisplay({
  column,
  value,
}: {
  column: TableColumn;
  value: ReactNode;
}) {
  if (column.hideOnMobile) {
    return (
      <div className="hidden md:table-cell">
        <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1 md:hidden">
          {column.label}
        </div>
        <div className="text-foreground">{value}</div>
      </div>
    );
  }
  return (
    <div className="flex justify-between items-center py-2 md:table-cell border-b md:border-b-0 border-border last:border-b-0">
      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider md:hidden">
        {column.label}
      </span>
      <div className="text-right md:text-left ml-auto md:ml-0">
        {value}
      </div>
    </div>
  );
}

export function ResponsiveTableContainer({
  columns,
  data,
  keyField,
  mobileCardTitle,
  mobileCardSubtitle,
  className,
  emptyMessage = "No data available",
  children,
}: ResponsiveTableContainerProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(col.hideOnMobile && "hidden lg:table-cell")}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row[keyField] as string}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(col.hideOnMobile && "hidden lg:table-cell")}
                  >
                    {children ? children(row, col) : row[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {data.map((row) => (
          <ResponsiveTableCard key={row[keyField] as string}>
            {mobileCardTitle && (
              <div className="font-semibold text-foreground mb-2">
                {mobileCardTitle(row)}
              </div>
            )}
            {mobileCardSubtitle && (
              <div className="text-base text-muted-foreground mb-3">
                {mobileCardSubtitle(row)}
              </div>
            )}
            <div className="space-y-1">
              {columns.map((col) => (
                <TableColumnDisplay
                  key={col.key}
                  column={col}
                  value={children ? children(row, col) : row[col.key]}
                />
              ))}
            </div>
          </ResponsiveTableCard>
        ))}
      </div>
    </div>
  );
}

export { ResponsiveTable };

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
