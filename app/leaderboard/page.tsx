import { Leaderboard } from '@/components/Leaderboard';

// Assumed to be passed globally or set in .env
const API_KEY = process.env.GOODGRANTS_API_KEY || ""; 

export default function LeaderboardPage() {
  const config = { apiKey: API_KEY };
  
  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold tracking-tight">Leaderboard & Analytics</h2>
      <Leaderboard config={config} />
    </div>
  );
}
