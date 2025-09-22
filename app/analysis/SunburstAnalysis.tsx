"use client";

import { useState, useMemo } from "react";
import { ResponsiveSunburst } from "@nivo/sunburst";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const extractFieldValue = (app: any, slug: string) => {
  const field = app.raw_fields?.find((f: any) => f.slug === slug);
  const value = field?.value;
  if (typeof value === 'object' && value !== null) {
    return field?.translated?.en_GB || value.en_GB || value.en || JSON.stringify(value);
  }
  return value !== null && value !== undefined ? String(value) : "N/A";
};

const extractPsCodeValue = (app: any, possibleSlugs: string[]) => {
  const field = app.raw_fields?.find((f: any) => possibleSlugs.includes(f.slug));
  return field?.value || "N/A";
};

const dimensionOptions = [
    { value: "gender", label: "Gender" },
    { value: "age", label: "Age Range" },
    { value: "psCode", label: "PS Code" },
];

export function SunburstAnalysis({ apps }: { apps: any[] }) {
  const [secondaryDimension, setSecondaryDimension] = useState("gender");

  const sunburstData = useMemo(() => {
    const root = { name: "all", children: [] as any[] };
    const municipalityMap = new Map();
    const psCodeSlugs = ['gkknPnQp', 'jDJaNYGG', 'RjAnzBZJ', 'OJBPQyGP'];

    apps.forEach(app => {
        const municipality = extractFieldValue(app, "rDkKljjz");
        if (municipality === "N/A") return;

        let secondaryValue;
        switch (secondaryDimension) {
            case 'age':
                secondaryValue = extractFieldValue(app, 'xjzONPwj');
                break;
            case 'psCode':
                secondaryValue = extractPsCodeValue(app, psCodeSlugs);
                break;
            case 'gender':
            default:
                secondaryValue = extractFieldValue(app, 'rojNQzOz');
                break;
        }
        if (secondaryValue === "N/A") return;

        const category = app.category?.name?.en_GB || "Uncategorized";

        const muniId = municipality;
        const secondaryId = `${muniId}-${secondaryValue}`;
        const categoryId = `${secondaryId}-${category}`;

        let muniNode = municipalityMap.get(municipality);
        if (!muniNode) {
            muniNode = { name: municipality, id: muniId, children: [] };
            municipalityMap.set(municipality, muniNode);
            root.children.push(muniNode);
        }

        let secondaryNode = muniNode.children.find((child: any) => child.id === secondaryId);
        if (!secondaryNode) {
            secondaryNode = { name: secondaryValue, id: secondaryId, children: [] };
            muniNode.children.push(secondaryNode);
        }
        
        let categoryNode = secondaryNode.children.find((child: any) => child.id === categoryId);
        if (!categoryNode) {
            categoryNode = { name: category, id: categoryId, value: 0 };
            secondaryNode.children.push(categoryNode);
        }
        
        categoryNode.value += 1;
    });

    return root;
  }, [apps, secondaryDimension]);

  return (
    <Card className="transition-all duration-300 hover:shadow-xl">
      <CardHeader>
        <CardTitle>Hierarchical Analysis</CardTitle>
        <CardDescription>Click through the segments to explore a deeper breakdown of the data.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
            <Label htmlFor="breakdown-select" className="font-semibold">2nd Level Breakdown</Label>
            <Select onValueChange={setSecondaryDimension} defaultValue={secondaryDimension}>
                <SelectTrigger id="breakdown-select" className="mt-2">
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
        <div className="md:col-span-3 h-[450px]">
            <ResponsiveSunburst
                data={sunburstData}
                id="id"
                value="value"
                margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                innerRadius={0.2}
                cornerRadius={3}
                borderWidth={1}
                borderColor="white"
                colors={{ scheme: 'blues' }}
                childColor={{ from: 'color', modifiers: [ [ 'darker', 0.1 ] ] }}
                inheritColorFromParent={false}
                enableArcLabels={true}
                arcLabelsSkipAngle={12}
                arcLabelsTextColor={{ from: 'color', modifiers: [ [ 'darker', 2 ] ] }}
                theme={{
                    labels: {
                        text: {
                            fontSize: 14,
                            fontWeight: 'bold',
                            textOutlineWidth: 4,
                            textOutlineColor: 'white',
                        },
                    },
                }}
                tooltip={node => {
                    const pathParts: string[] = [];
                    let currentNode: typeof node | undefined = node;
                    while (currentNode?.parent && currentNode.id !== 'all') {
                        pathParts.unshift(currentNode.data.name);
                        currentNode = currentNode.parent;
                    }
                    const fullPath = pathParts.join(' / ');
                    return (
                        <div className="p-2 text-center bg-background border rounded-md shadow-lg">
                            <div className="font-bold text-sm">{fullPath}</div>
                            <div style={{ color: node.color }} className="text-xs font-semibold uppercase mt-1">
                                {node.value} applications
                            </div>
                        </div>
                    );
                }}
            />
        </div>
      </CardContent>
    </Card>
  );
}