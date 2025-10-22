import { DuplicateFinder } from '@/components/DuplicateFinder';

// Assumed to be passed globally or set in .env
const API_KEY = process.env.GOODGRANTS_API_KEY || ""; 

export default function FindDuplicatesPage() {
  const config = { apiKey: API_KEY };
  
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight">Find Duplicates</h2>
      <DuplicateFinder config={config} />
    </div>
  );
}
