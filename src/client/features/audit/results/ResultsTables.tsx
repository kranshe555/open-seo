import { useMemo, useState } from "react";
import {
  createColumnHelper,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Modal } from "@/client/components/Modal";
import {
  AppDataTable,
  useAppTable,
} from "@/client/components/table/AppDataTable";
import { TableExportMenu } from "@/client/components/table/TableBulkActionBar";
import { SortableHeader } from "@/client/components/table/SortableHeader";
import {
  extractPathname,
  HttpStatusBadge,
  LighthouseScoreBadge,
} from "@/client/features/audit/shared";
import type { AuditResultsData } from "@/client/features/audit/results/types";
import {
  countActiveFilters,
  EmptyTableMessage,
  PagesFilterBar,
  PerformanceFilterBar,
  TableFilterToggle,
} from "@/client/features/audit/results/AuditResultsTableFilters";
import {
  EMPTY_PAGES_FILTERS,
  EMPTY_PERFORMANCE_FILTERS,
  filterPages,
  filterPerformanceRows,
  isLighthouseFailure,
  nullableNumberSort,
  nullableStringSort,
  type PageRow,
  type PagesFilters,
  type PerformanceFilters,
  type PerformanceRowData,
} from "@/client/features/audit/results/AuditResultsTableFilterLogic";

const pageColumnHelper = createColumnHelper<PageRow>();
const performanceColumnHelper = createColumnHelper<PerformanceRowData>();

function CouponAuditCell({ couponAuditJson }: { couponAuditJson?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!couponAuditJson) {
    return <span className="text-xs text-base-content/30">-</span>;
  }

  let report: any;
  try {
    report = JSON.parse(couponAuditJson);
  } catch (e) {
    return <span className="text-xs text-error">error</span>;
  }

  const { summary, results, pageType } = report;
  const score = summary.score;

  let badgeColor = "bg-success";
  if (score < 5) badgeColor = "bg-error";
  else if (score < 8) badgeColor = "bg-warning";

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`badge ${badgeColor} gap-1 cursor-pointer hover:scale-105 transition-transform font-bold text-white border-none py-2.5 px-2.5`}
      >
        {pageType === "store" ? "Store" : "Coupon"}: {score}/10
      </button>

      {isOpen && (
        <Modal maxWidth="max-w-2xl" onClose={() => setIsOpen(false)}>
          <div className="flex justify-between items-center border-b border-base-200 pb-3" dir="rtl">
            <h3 className="font-bold text-lg text-primary">
              📋 فحص السيو لمواقع الكوبونات ({pageType === "store" ? "صفحة متجر" : "صفحة كوبون"})
            </h3>
            <span className={`badge ${badgeColor} badge-lg text-white font-bold border-none`}>
              التقييم: {score}/10
            </span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1 py-2 text-right" dir="rtl">
            <div className="grid grid-cols-3 gap-2 bg-base-200 p-3 rounded-lg text-xs font-bold text-center">
              <div>البنود المجتازة: {summary.passedCount}</div>
              <div>البنود الفاشلة: {summary.failedCount}</div>
              <div>إجمالي البنود: {results.length}</div>
            </div>

            <div className="space-y-2">
              {results.map((rule: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-sm flex flex-col gap-1 ${
                    rule.passed
                      ? "bg-success/10 border-success/30 text-success-content"
                      : "bg-error/10 border-error/30 text-error-content"
                  }`}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span>{rule.name}</span>
                    <span className={`badge ${rule.passed ? "badge-success text-white" : "badge-error text-white"} badge-xs border-none`}>
                      {rule.passed ? "ناجح" : "فشل"}
                    </span>
                  </div>
                  <div className="text-xs opacity-90 font-mono mt-1 whitespace-pre-line leading-relaxed">
                    {rule.details}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-action mt-2 justify-end flex">
            <button className="btn btn-sm" onClick={() => setIsOpen(false)}>
              إغلاق
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

const pagesColumns: ColumnDef<PageRow>[] = [
  pageColumnHelper.accessor("url", {
    header: ({ column }) => <SortableHeader column={column} label="URL" />,
    cell: ({ getValue }) => {
      const url = getValue();
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="link link-primary inline-flex items-center gap-1 text-xs"
        >
          <span className="truncate">{extractPathname(url)}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
      );
    },
    meta: { cellClassName: "max-w-[240px] truncate" },
  }),
  pageColumnHelper.accessor("statusCode", {
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: ({ getValue }) => <HttpStatusBadge code={getValue()} />,
    sortingFn: nullableNumberSort,
  }),
  pageColumnHelper.accessor("title", {
    header: ({ column }) => <SortableHeader column={column} label="Title" />,
    cell: ({ getValue }) => {
      const title = getValue();
      return title ? (
        <span title={title}>{title}</span>
      ) : (
        <span className="text-error text-xs">missing</span>
      );
    },
    sortingFn: nullableStringSort,
    meta: { cellClassName: "max-w-[220px] truncate" },
  }),
  pageColumnHelper.accessor("h1Count", {
    header: ({ column }) => <SortableHeader column={column} label="H1" />,
  }),
  pageColumnHelper.accessor("wordCount", {
    header: ({ column }) => <SortableHeader column={column} label="Words" />,
  }),
  pageColumnHelper.display({
    id: "images",
    header: ({ column }) => <SortableHeader column={column} label="Images" />,
    cell: ({ row }) =>
      row.original.imagesMissingAlt > 0 ? (
        <span className="text-warning">
          {row.original.imagesMissingAlt}/{row.original.imagesTotal}
        </span>
      ) : (
        row.original.imagesTotal
      ),
    enableSorting: true,
    sortingFn: (left, right) =>
      left.original.imagesMissingAlt - right.original.imagesMissingAlt ||
      left.original.imagesTotal - right.original.imagesTotal,
  }),
  pageColumnHelper.accessor("responseTimeMs", {
    header: ({ column }) => <SortableHeader column={column} label="Speed" />,
    cell: ({ getValue }) => {
      const value = getValue();
      return value ? (
        <span className="text-xs">{value}ms</span>
      ) : (
        <span className="text-xs text-base-content/40">-</span>
      );
    },
    sortingFn: nullableNumberSort,
  }),
  pageColumnHelper.accessor("couponAuditJson", {
    header: ({ column }) => <SortableHeader column={column} label="Coupon Audit" />,
    cell: ({ getValue }) => <CouponAuditCell couponAuditJson={getValue()} />,
  }),
];

export function PagesTable({ pages }: { pages: AuditResultsData["pages"] }) {
  const [filters, setFilters] = useState<PagesFilters>(EMPTY_PAGES_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "statusCode", desc: true },
  ]);
  const activeFilterCount = countActiveFilters(filters, EMPTY_PAGES_FILTERS);
  const filteredPages = useMemo(
    () => filterPages(pages, filters),
    [filters, pages],
  );
  const table = useAppTable({
    data: filteredPages,
    columns: pagesColumns,
    state: { sorting },
    onSortingChange: setSorting,
    withSorting: true,
  });

  return (
    <div className="space-y-3">
      <TableFilterToggle
        showFilters={showFilters}
        onToggle={() => setShowFilters((current) => !current)}
        activeFilterCount={activeFilterCount}
        resultCount={filteredPages.length}
        totalCount={pages.length}
      />
      {showFilters ? (
        <PagesFilterBar
          filters={filters}
          onChange={setFilters}
          activeFilterCount={activeFilterCount}
          onReset={() => setFilters(EMPTY_PAGES_FILTERS)}
        />
      ) : null}
      <AppDataTable
        table={table}
        className="table table-sm"
        empty={<EmptyTableMessage label="No pages match these filters." />}
      />
    </div>
  );
}

export function PerformanceTable({
  auditId,
  projectId,
  lighthouse,
  pages,
}: {
  auditId: string;
  projectId: string;
  lighthouse: AuditResultsData["lighthouse"];
  pages: AuditResultsData["pages"];
}) {
  const [filters, setFilters] = useState<PerformanceFilters>(
    EMPTY_PERFORMANCE_FILTERS,
  );
  const [showFilters, setShowFilters] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "performanceScore", desc: false },
  ]);
  const rows = useMemo(
    () =>
      lighthouse.map((result) => {
        const page = pages.find((candidate) => candidate.id === result.pageId);
        const pageUrl = page?.url ?? null;
        return {
          ...result,
          pageUrl,
          pagePath: pageUrl ? extractPathname(pageUrl) : null,
        };
      }),
    [lighthouse, pages],
  );
  const filteredRows = useMemo(
    () => filterPerformanceRows(rows, filters),
    [filters, rows],
  );
  const activeFilterCount = countActiveFilters(
    filters,
    EMPTY_PERFORMANCE_FILTERS,
  );
  const columns = useMemo(
    () => buildPerformanceColumns({ auditId, projectId }),
    [auditId, projectId],
  );
  const table = useAppTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    withSorting: true,
  });

  return (
    <div className="space-y-3">
      <TableFilterToggle
        showFilters={showFilters}
        onToggle={() => setShowFilters((current) => !current)}
        activeFilterCount={activeFilterCount}
        resultCount={filteredRows.length}
        totalCount={rows.length}
      />
      {showFilters ? (
        <PerformanceFilterBar
          filters={filters}
          onChange={setFilters}
          activeFilterCount={activeFilterCount}
          onReset={() => setFilters(EMPTY_PERFORMANCE_FILTERS)}
        />
      ) : null}
      <AppDataTable
        table={table}
        className="table table-sm"
        empty={
          <EmptyTableMessage label="No performance results match these filters." />
        }
      />
    </div>
  );
}

function buildPerformanceColumns({
  auditId,
  projectId,
}: {
  auditId: string;
  projectId: string;
}): ColumnDef<PerformanceRowData>[] {
  return [
    performanceColumnHelper.accessor("pagePath", {
      header: ({ column }) => <SortableHeader column={column} label="URL" />,
      cell: ({ getValue }) => (
        <span className="text-xs">{getValue() ?? "-"}</span>
      ),
      sortingFn: nullableStringSort,
      meta: { cellClassName: "max-w-[180px] truncate" },
    }),
    performanceColumnHelper.accessor("strategy", {
      header: ({ column }) => <SortableHeader column={column} label="Device" />,
      cell: ({ getValue }) => (
        <span className="capitalize text-xs">{getValue()}</span>
      ),
    }),
    performanceColumnHelper.display({
      id: "status",
      header: ({ column }) => <SortableHeader column={column} label="Status" />,
      cell: ({ row }) => {
        const isFailed = isLighthouseFailure(row.original);
        const failureMessage =
          row.original.errorMessage ?? "Lighthouse returned no category scores";
        return isFailed ? (
          <span
            className="badge badge-error badge-outline text-xs"
            title={failureMessage}
          >
            failed
          </span>
        ) : (
          <span className="badge badge-success badge-outline text-xs">ok</span>
        );
      },
      enableSorting: true,
      sortingFn: (left, right) =>
        Number(isLighthouseFailure(left.original)) -
        Number(isLighthouseFailure(right.original)),
    }),
    performanceColumnHelper.accessor("performanceScore", {
      header: ({ column }) => <SortableHeader column={column} label="Perf" />,
      cell: ({ getValue }) => <LighthouseScoreBadge score={getValue()} />,
      sortingFn: nullableNumberSort,
    }),
    performanceColumnHelper.accessor("accessibilityScore", {
      header: ({ column }) => <SortableHeader column={column} label="A11y" />,
      cell: ({ getValue }) => <LighthouseScoreBadge score={getValue()} />,
      sortingFn: nullableNumberSort,
    }),
    performanceColumnHelper.accessor("seoScore", {
      header: ({ column }) => <SortableHeader column={column} label="SEO" />,
      cell: ({ getValue }) => <LighthouseScoreBadge score={getValue()} />,
      sortingFn: nullableNumberSort,
    }),
    performanceColumnHelper.accessor("lcpMs", {
      header: ({ column }) => <SortableHeader column={column} label="LCP" />,
      cell: ({ getValue }) => {
        const value = getValue();
        return value ? (
          <span className="text-xs">{(value / 1000).toFixed(1)}s</span>
        ) : (
          <span className="text-xs text-base-content/40">-</span>
        );
      },
      sortingFn: nullableNumberSort,
    }),
    performanceColumnHelper.accessor("cls", {
      header: ({ column }) => <SortableHeader column={column} label="CLS" />,
      cell: ({ getValue }) => {
        const value = getValue();
        return value != null ? (
          <span className="text-xs">{value.toFixed(3)}</span>
        ) : (
          <span className="text-xs text-base-content/40">-</span>
        );
      },
      sortingFn: nullableNumberSort,
    }),
    performanceColumnHelper.accessor("inpMs", {
      header: ({ column }) => <SortableHeader column={column} label="INP" />,
      cell: ({ getValue }) => {
        const value = getValue();
        return value ? (
          <span className="text-xs">{Math.round(value)}ms</span>
        ) : (
          <span className="text-xs text-base-content/40">-</span>
        );
      },
      sortingFn: nullableNumberSort,
    }),
    performanceColumnHelper.accessor("ttfbMs", {
      header: ({ column }) => <SortableHeader column={column} label="TTFB" />,
      cell: ({ getValue }) => {
        const value = getValue();
        return value ? (
          <span className="text-xs">{Math.round(value)}ms</span>
        ) : (
          <span className="text-xs text-base-content/40">-</span>
        );
      },
      sortingFn: nullableNumberSort,
    }),
    performanceColumnHelper.display({
      id: "issues",
      header: () => "Issues",
      cell: ({ row }) =>
        row.original.r2Key && !isLighthouseFailure(row.original) ? (
          <Link
            className="btn btn-primary btn-xs"
            to="/p/$projectId/audit/issues/$resultId"
            params={{ projectId, resultId: row.original.id }}
            search={{ auditId, category: "performance" }}
          >
            View issues
          </Link>
        ) : (
          <span className="text-xs text-base-content/40">-</span>
        ),
    }),
  ];
}

export function ExportDropdown({
  onExport,
}: {
  onExport: (format: "csv" | "json" | "sheets") => void;
}) {
  return (
    <TableExportMenu
      buttonClassName="btn btn-sm btn-ghost gap-1"
      menuClassName="dropdown-content z-10 menu p-2 shadow-lg bg-base-100 border border-base-300 rounded-box w-52"
      actions={[
        { label: "Export to Sheets", onClick: () => onExport("sheets") },
        { label: "CSV", onClick: () => onExport("csv") },
        { label: "JSON", onClick: () => onExport("json") },
      ]}
    />
  );
}
