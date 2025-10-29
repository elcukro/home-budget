'use client';

export function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title Skeleton */}
      <div className="h-8 w-48 rounded bg-muted"></div>

      {/* Cards Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6 shadow">
            <div className="mb-4 h-4 w-24 rounded bg-muted"></div>
            <div className="h-8 w-32 rounded bg-muted"></div>
          </div>
        ))}
      </div>

      {/* Content Section Skeleton */}
      <div className="card p-6 shadow">
        <div className="mb-6 h-6 w-32 rounded bg-muted"></div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="h-4 w-full rounded bg-muted"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="card p-6 shadow">
        <div className="mb-6 h-6 w-40 rounded bg-muted"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-1/4 rounded bg-muted"></div>
              <div className="h-4 w-1/4 rounded bg-muted"></div>
              <div className="h-4 w-1/4 rounded bg-muted"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center h-32">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

export function LoadingRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-24 bg-muted rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-32 bg-muted rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-16 bg-muted rounded"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 w-24 bg-muted rounded"></div>
      </td>
    </tr>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title */}
      <div className="h-8 w-48 bg-muted rounded"></div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6 rounded-lg shadow">
            <div className="h-4 w-24 bg-muted rounded mb-4"></div>
            <div className="h-8 w-32 bg-muted rounded"></div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="card p-6 rounded-lg shadow">
        <div className="mb-6 h-6 w-40 rounded bg-muted"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 w-1/4 bg-muted rounded"></div>
              <div className="h-4 w-1/4 bg-muted rounded"></div>
              <div className="h-4 w-1/4 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TablePageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title */}
      <div className="h-8 w-48 bg-muted rounded"></div>

      {/* Add New Form */}
      <div className="card p-6 rounded-lg shadow">
        <div className="h-6 w-32 bg-muted rounded mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded"></div>
              <div className="h-10 w-full bg-muted rounded"></div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <div className="h-10 w-24 bg-muted rounded"></div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-6 rounded-lg shadow overflow-hidden">
        <div className="h-6 w-40 bg-muted rounded mb-6"></div>
        <table className="min-w-full">
          <thead>
            <tr>
              {[...Array(4)].map((_, i) => (
                <th key={i} className="px-6 py-3">
                  <div className="h-4 w-24 bg-muted rounded"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                {[...Array(4)].map((_, j) => (
                  <td key={j} className="px-6 py-4">
                    <div className="h-4 w-24 rounded bg-muted"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title */}
      <div className="h-8 w-48 bg-muted rounded"></div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-6 rounded-lg shadow">
            <div className="h-4 w-24 bg-muted rounded mb-4"></div>
            <div className="h-8 w-32 bg-muted rounded"></div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card p-6 rounded-lg shadow">
            <div className="h-6 w-40 bg-muted rounded mb-6"></div>
            <div className="h-80 bg-muted rounded"></div>
          </div>
        ))}
      </div>

      {/* Financial Health Indicators */}
      <div className="card p-6 rounded-lg shadow">
        <div className="h-6 w-48 bg-muted rounded mb-6"></div>
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-40 bg-muted rounded"></div>
              <div className="h-2 w-full bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title */}
      <div className="h-8 w-48 bg-muted rounded"></div>

      {/* Settings Form */}
      <div className="card p-6 rounded-lg shadow">
        <div className="h-6 w-32 bg-muted rounded mb-6"></div>
        <div className="space-y-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded"></div>
              <div className="h-10 w-full max-w-xs bg-muted rounded"></div>
            </div>
          ))}
          <div className="pt-4">
            <div className="h-10 w-24 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoadingButton() {
  return (
    <div className="inline-flex items-center">
      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
      <div className="h-4 w-16 bg-muted rounded"></div>
    </div>
  );
} 
