import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Loading skeleton for data tables
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {/* Header row */}
                    <div className="flex gap-4">
                        {Array.from({ length: columns }).map((_, i) => (
                            <Skeleton key={`header-${i}`} className="h-8 flex-1" />
                        ))}
                    </div>
                    {/* Data rows */}
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <div key={rowIndex} className="flex gap-4">
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <Skeleton key={`${rowIndex}-${colIndex}`} className="h-6 flex-1" />
                            ))}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Loading skeleton for a card with statistics
 */
export function StatsSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="text-center p-4 rounded-lg bg-muted/30">
                            <Skeleton className="h-4 w-20 mx-auto mb-2" />
                            <Skeleton className="h-8 w-16 mx-auto" />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Loading skeleton for column list
 */
export function ColumnListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent className="space-y-3">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-4 w-4" />
                            <div>
                                <Skeleton className="h-5 w-32" />
                                <Skeleton className="h-3 w-24 mt-1" />
                            </div>
                        </div>
                        <Skeleton className="h-6 w-20" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

/**
 * Full page loading skeleton
 */
export function PageSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="mb-8">
                <Skeleton className="h-9 w-64 mb-2" />
                <Skeleton className="h-5 w-96" />
            </div>
            <StatsSkeleton />
            <ColumnListSkeleton />
        </div>
    );
}
