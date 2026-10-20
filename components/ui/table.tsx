import * as React from "react";
import { cn } from "@/lib/utils";

export const Table = ({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <div className="relative w-full overflow-x-auto">
    <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
  </div>
);
export const THead = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className="border-b border-tinta/15" {...props} />;
export const TBody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody className="[&_tr:last-child]:border-0" {...props} />;
export const TR = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => <tr className={cn("border-b transition-colors hover:bg-papel", className)} {...props} />;
export const TH = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn("h-11 px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-ceja text-grafito", className)} {...props} />
);
export const TD = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("px-3 py-3 align-middle", className)} {...props} />;
