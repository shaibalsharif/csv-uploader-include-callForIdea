"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Application = { [key: string]: any };

// --- Helper Functions ---
const getPsCodeTranslation = (app: Application, possibleSlugs: string[]) => {
  const field = app.raw_fields?.find((f: any) => possibleSlugs.includes(f.slug));
  return field?.translated?.en_GB || "";
};
const extractFieldValue = (app: Application, slug: string) => {
  const field = app.raw_fields?.find((f: any) => f.slug === slug);
  const value = field?.value;
  if (typeof value === 'object' && value !== null) {
    return field?.translated?.en_GB || value.en_GB || value.en || JSON.stringify(value);
  }
  return value !== null && value !== undefined ? String(value) : "N/A";
};

const extractPsCodeValue = (app: Application, possibleSlugs: string[]) => {
  const field = app.raw_fields?.find((f: any) => possibleSlugs.includes(f.slug));
  return field?.value || "N/A";
};
const abbreviateAgeLabel = (label: string): string => {
  if (label.toLowerCase().includes('below 18')) return '< 18';
  if (label.toLowerCase().includes('above 65')) return '> 65';
  return label.replace(/\s*years\s*/, '').replace(/\s/g, '');
};

const dimensionOptions = [
  { value: "gender", label: "Gender" },
  { value: "age", label: "Age Range" },
  { value: "psCode", label: "Challenge Statement" },
];

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

// Renders a custom tooltip showing the full Challenge Statement
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="p-3 bg-background border rounded-md shadow-lg">
        <p className="font-bold text-sm">{label}</p>
        {data.translatedName && (
          <p className="text-xs text-muted-foreground italic mb-2">{data.translatedName}</p>
        )}
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} style={{ color: entry.color }} className="text-sm">
            {`${entry.name}: ${entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// New function to process data for a specific dimension
const processStackedBarData = (apps: Application[], municipalityData: any[], dimension: string) => {
    const psCodeSlugs = ['gkknPnQp', 'jDJaNYGG', 'RjAnzBZJ', 'OJBPQyGP'];
    const topMunicipalities = municipalityData.slice(0, 4).map(m => m.name);
    const allCategories = [...new Set(apps.map((app: Application) => app.category?.name?.en_GB || "Uncategorized"))].sort();

    const chartsData = topMunicipalities.map(municipality => {
      const muniApps = apps.filter((app: Application) => extractFieldValue(app, "rDkKljjz") === municipality);
      const groupedByDimension = muniApps.reduce((acc, app: Application) => {
        let key, translation = "";
        switch (dimension) {
          case 'age':
            const fullAgeLabel = extractFieldValue(app, 'xjzONPwj');
            key = abbreviateAgeLabel(fullAgeLabel);
            break;
          case 'psCode':
            key = extractPsCodeValue(app, psCodeSlugs);
            translation = getPsCodeTranslation(app, psCodeSlugs);
            break;
          case 'gender':
          default:
            key = extractFieldValue(app, 'rojNQzOz');
            break;
        }
        if (!acc[key]) {
          acc[key] = { apps: [], translation };
        }
        acc[key].apps.push(app);
        return acc;
      }, {} as Record<string, { apps: Application[], translation: string }>);

      const chartData = Object.entries(groupedByDimension).map(([name, group]) => {
        const { apps: groupedApps, translation } = group;
        const counts = allCategories.reduce((acc, category) => {
          acc[category] = 0;
          return acc;
        }, {} as Record<string, number>);

        groupedApps.forEach((app: Application) => {
          const category = app.category?.name?.en_GB || "Uncategorized";
          if (counts[category] !== undefined) counts[category]++;
        });

        return { name, translatedName: translation, ...counts };
      }).sort((a, b) => {
        switch (dimension) {
          case 'age':
            const ageOrder = ['< 18', '18-25', '26-35', '36-45', '46-55', '56-65', '> 65'];
            return ageOrder.indexOf(a.name) - ageOrder.indexOf(b.name);
          
          case 'gender':
            const genderOrder = ['Female', 'Male', 'Other'];
            return genderOrder.indexOf(a.name) - genderOrder.indexOf(b.name);

          case 'psCode':
            const regex = /^([a-z]+)-ps-(\d+)$/i;
            const aMatch = a.name.match(regex);
            const bMatch = b.name.match(regex);

            if (aMatch && bMatch) {
                const aPrefix = aMatch[1];
                const bPrefix = bMatch[1];
                const aNum = parseInt(aMatch[2], 10);
                const bNum = parseInt(bMatch[2], 10);

                if (aPrefix !== bPrefix) {
                    return aPrefix.localeCompare(bPrefix);
                }
                return aNum - bNum;
            }
            return a.name.localeCompare(b.name);

          default:
            return a.name.localeCompare(b.name);
        }
      });

      return { municipality, data: chartData };
    });

    return { chartsData, categories: allCategories };
};

export function StackedBarAnalysis({ apps, municipalityData }: { apps: Application[], municipalityData: any[] }) {
  const [dimension, setDimension] = useState("gender");

  // Renders a single chart based on the selected dimension
  const renderSingleChart = useMemo(() => {
    if (!apps || !municipalityData) return null;
    const { chartsData, categories } = processStackedBarData(apps, municipalityData, dimension);
    
    return (
        <CardContent className="grid gap-8 pt-4 md:grid-cols-2">
            {chartsData.map(({ municipality, data }) => (
                <div key={municipality} className="group">
                    <h3 className="text-lg font-semibold text-center mb-2 transition-all duration-300 group-hover:text-primary group-hover:scale-105">
                        {municipality}
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            {categories.map((category, index) => (
                                <Bar key={category} dataKey={category} stackId="a" fill={COLORS[index % COLORS.length]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ))}
        </CardContent>
    );
  }, [apps, municipalityData, dimension]);

  return (
    <Card className="transition-all duration-300 hover:shadow-xl group">
      <CardHeader className="flex flex-row items-center justify-between ">
        <div className="text-left">
          <CardTitle>
            Municipality Breakdown
          </CardTitle>
          <CardDescription>
            Comparing application categories across municipalities.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="breakdown-select" className="font-semibold whitespace-nowrap">
            Stack by
          </Label>
          <Select onValueChange={setDimension} defaultValue={dimension}>
            <SelectTrigger id="breakdown-select" className="w-[200px]">
              <SelectValue placeholder="Select a breakdown..." />
            </SelectTrigger>
            <SelectContent>
              {dimensionOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      {renderSingleChart}
    </Card>
  );
}

// Export the data processing function for use in the parent component
export { processStackedBarData };