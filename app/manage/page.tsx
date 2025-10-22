import { ApplicationManager } from '@/components/ApplicationManager';

// Assumed to be passed globally or set in .env
const API_KEY = process.env.GOODGRANTS_API_KEY || ""; 

export default function ApplicationManagerPage() {
  const config = { apiKey: API_KEY };
  
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight">Manage Applications</h2>
      <ApplicationManager config={config} />
    </div>
  );
}
