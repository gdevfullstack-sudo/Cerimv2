import React from 'react';

interface SearchResultsSkeletonProps {
  count?: number;
  viewMode?: 'grid' | 'map';
}

export const PropertyCardSkeleton: React.FC = () => (
  <div
    aria-hidden="true"
    className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col"
  >
    {/* Image & square matricule gray placeholder */}
    <div className="relative aspect-[4/3] w-full cerim-skeleton">
      <div className="absolute top-3 left-3 w-12 h-6 rounded-[3px] bg-gray-300/90 border border-gray-300 animate-pulse" />
    </div>

    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
      <div className="space-y-2.5">
        {/* Status · Availability */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-16 rounded cerim-skeleton" />
          <div className="h-3 w-32 rounded bg-gray-200 animate-pulse" />
        </div>

        {/* Title (2 lines matching PropertyCard) */}
        <div className="space-y-2">
          <div className="h-4 w-11/12 rounded cerim-skeleton" />
          <div className="h-4 w-2/3 rounded bg-gray-200 animate-pulse" />
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 pt-0.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-gray-300 shrink-0 animate-pulse" />
          <div className="h-3.5 w-3/5 rounded bg-gray-200 animate-pulse" />
        </div>
      </div>

      {/* Price & specs footer */}
      <div className="pt-3 border-t border-gray-100 flex items-end justify-between gap-3">
        <div className="space-y-1.5 w-2/5">
          <div className="h-5 w-full rounded cerim-skeleton" />
          <div className="h-3 w-4/5 rounded bg-gray-200 animate-pulse" />
        </div>
        <div className="flex items-center gap-2.5 w-2/5 justify-end">
          <div className="h-3.5 w-12 rounded bg-gray-200 animate-pulse" />
          <div className="h-3.5 w-12 rounded bg-gray-200 animate-pulse" />
        </div>
      </div>
    </div>
  </div>
);

export const SearchMapSkeleton: React.FC = () => (
  <div
    aria-hidden="true"
    className="bg-white rounded-xl border border-gray-200 overflow-hidden"
  >
    <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
      <div className="h-4 w-48 rounded cerim-skeleton" />
      <div className="flex items-center gap-2">
        <div className="h-8 w-24 rounded-md bg-gray-200 animate-pulse" />
        <div className="h-8 w-24 rounded-md bg-gray-200 animate-pulse" />
      </div>
    </div>
    <div className="relative h-[460px] w-full cerim-skeleton">
      <div className="absolute top-1/3 left-1/3 h-8 w-24 rounded-md bg-gray-300/90 animate-pulse" />
      <div className="absolute top-1/2 left-2/3 h-8 w-24 rounded-md bg-gray-300/90 animate-pulse" />
      <div className="absolute bottom-1/3 left-1/2 h-8 w-24 rounded-md bg-gray-300/90 animate-pulse" />
    </div>
  </div>
);

export const SearchResultsSkeleton: React.FC<SearchResultsSkeletonProps> = ({
  count = 6,
  viewMode = 'grid',
}) => {
  const items = Array.from({ length: count });

  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement et filtrage des résultats en cours...</span>
      {viewMode === 'map' ? (
        <SearchMapSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((_, idx) => (
            <PropertyCardSkeleton key={idx} />
          ))}
        </div>
      )}
    </div>
  );
};

