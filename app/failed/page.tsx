import { FailedSubmissions } from '@/components/failed-submissions';

export default function FailedSubmissionsPage() {
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight">Failed Submissions</h2>
      <FailedSubmissions />
    </div>
  );
}
