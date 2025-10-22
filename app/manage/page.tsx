"use client";

import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Dynamically import ApplicationManager, disabling Server-Side Rendering (SSR).
const ApplicationManager = dynamic(
  () => import('@/components/ApplicationManager').then((mod) => mod.ApplicationManager),
  {
    ssr: false, // CRITICAL FIX: Skip rendering on the server
    loading: () => (
      <Card className="shadow-lg mt-6">
        <CardHeader><CardTitle>Manage Applications</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading Application Manager...
        </CardContent>
      </Card>
    ),
  }
);

export default function ManageApplicationsPage() {
  // FIX: Accessing the variable by the name defined in the .env.
  // NOTE: If this variable is not prefixed by NEXT_PUBLIC_ in your build system, 
  // you must ensure the build system explicitly exposes GOODGRANTS_API_KEY to the client bundle.
  const config = { apiKey: process.env.GOODGRANTS_API_KEY || 'bD4z2YcN-01MUQhEqjN7DsemSr4LMPbZoWB8bp24iulAl0hdzp0shemFKoFXJubfIjzXO' };

  return (
    <ApplicationManager config={config} />
  );
}
