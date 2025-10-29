"use client";

import { useMemo, useState } from "react";
import { ResponsiveSunburst } from "@nivo/sunburst";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Zap, Circle, User, Layers } from "lucide-react";
import type { FilteredAppRawData } from "./LeaderboardBreakdowns";

// --- Constants & Types ---
interface SunburstData {
    name: string;
    color?: string;
    children?: SunburstData[];
    value?: number;
    id: string;
    dimensionType?: string;
    sortKey?: number;
}

interface SunburstAnalyticsCardProps {
    filteredApps: FilteredAppRawData[];
    isLoading: boolean;
    municipalityFilter: string;
}

type IntermediateDimension = "gender" | "age" | "psCode";

const MUNICIPALITIES: (string | null)[] = [
    "Gaibandha",
    "Sirajganj",
    "Charghat",
    "Chapai Nawabganj",
];

const FIELD_SLUGS = {
    gender: "rojNQzOz",
    age: "xjzONPwj",
    psCodes: ["gkknPnQp", "jDJaNYGG", "RjAnzBZJ", "OJBPQyGP"],
};

const COLOR_MAPPING: Record<string, string> = {
    DEFAULT_MUNI_FALLBACK: "hsl(210, 30%, 70%)",
    Male: "hsl(200, 70%, 50%)",
    Female: "hsl(330, 70%, 60%)",
    Other: "hsl(60, 70%, 60%)",
    Gaibandha: "hsl(10, 70%, 50%)",
    Sirajganj: "hsl(180, 60%, 50%)",
    Charghat: "hsl(270, 60%, 50%)",
    "Chapai Nawabganj": "hsl(40, 70%, 50%)",
    "Other/N/A Muni": "hsl(0, 0%, 50%)",
};

const DISTINCT_FALLBACK_COLORS = [
    "hsl(240, 60%, 60%)",
    "hsl(150, 60%, 60%)",
    "hsl(30, 60%, 60%)",
    "hsl(270, 60%, 60%)",
    "hsl(0, 60%, 60%)",
    "hsl(90, 60%, 60%)",
];

const getFallbackColor = (key: string): string => {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % DISTINCT_FALLBACK_COLORS.length;
    return DISTINCT_FALLBACK_COLORS[index];
};

// --- Helper Functions ---
const extractFieldValue = (app: FilteredAppRawData, slug: string): string => {
    const rawFields = (app.raw_fields as any[]) || [];
    const field = rawFields.find((f: any) => f.slug === slug);
    const value = field?.value;
    if (typeof value === "object" && value !== null) {
        return (
            field?.translated?.en_GB ||
            value.en_GB ||
            value.en ||
            JSON.stringify(value)
        );
    }
    return value !== null && value !== undefined && typeof value === "string"
        ? value.split(" - [")[0].trim()
        : "N/A";
};

const abbreviateAgeLabel = (label: string): string => {
    if (!label) return "N/A";
    if (label.toLowerCase().includes("below 18")) return "< 18";
    if (label.toLowerCase().includes("above 65")) return "> 65";
    const match = label.match(/(\d{2}) - (\d{2}) years/);
    if (match) return `${match[1]}-${match[2]}-years`;
    return label
        .replace(/\s*years\s*/, "-years")
        .replace(/\s/g, "")
        .replace(/^-/, "")
        .trim();
};

const getCategoryValue = (app: FilteredAppRawData): string => {
    return app.category?.name?.en_GB || "Uncategorized";
};

const getDimensionValue = (
    app: FilteredAppRawData,
    dimension: IntermediateDimension
): { value: string; name: string; sortKey: number } => {
    switch (dimension) {
        case "gender":
            const genderValue = extractFieldValue(app, FIELD_SLUGS.gender) || "N/A";
            return { value: genderValue, name: genderValue, sortKey: 0 };
        case "age":
            const ageLabel = extractFieldValue(app, FIELD_SLUGS.age);
            const abbreviatedAge = abbreviateAgeLabel(ageLabel);
            const order = [
                "< 18",
                "18-25-years",
                "26-35-years",
                "36-45-years",
                "46-55-years",
                "56-65-years",
                "> 65",
            ];
            return {
                value: abbreviatedAge,
                name: abbreviatedAge,
                sortKey: order.indexOf(abbreviatedAge),
            };
        case "psCode":
            const psField = (app.raw_fields as any[])?.find((f: any) =>
                FIELD_SLUGS.psCodes.includes(f.slug)
            );
            if (!psField) return { value: "N/A", name: "N/A", sortKey: 1000 };

            const fullValue = String(psField.value);
            const cleanCode = fullValue.split(" - [")[0].trim() || "N/A";
            if (cleanCode === "N/A") return { value: "N/A", name: "N/A", sortKey: 1000 };

            const descriptiveLabel = psField.translated?.en_GB || "";
            const displayLabel = descriptiveLabel
                ? `${cleanCode}: ${descriptiveLabel.substring(0, 50).trim()}`
                : cleanCode;
            const sortMatch = cleanCode.match(/(\d+)$/);

            return {
                value: cleanCode,
                name: displayLabel,
                sortKey: sortMatch ? parseInt(sortMatch[1], 10) : 100,
            };
        default:
            return { value: "N/A", name: "N/A", sortKey: 1000 };
    }
};

// --- Build Sunburst Data ---
const buildSunburstData = (
    apps: FilteredAppRawData[],
    intermediateDimension: IntermediateDimension,
    municipalityFilter: string
): SunburstData => {
    const isAllMunicipalities = municipalityFilter === "all";
    const filteredMuniName = isAllMunicipalities
        ? "All Municipalities"
        : municipalityFilter;

    const root: SunburstData = {
        name: filteredMuniName,
        id: "root",
        color: "hsl(0, 0%, 80%)", // lighter root color to avoid black tint
        children: [],
    };

    const r1Nodes = new Map<string, SunburstData>();
    if (isAllMunicipalities) {
        MUNICIPALITIES.forEach((muniName) => {
            const key = muniName || "N/A";
            const node: SunburstData = {
                name: key,
                id: key.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                dimensionType: "municipality",
                color: COLOR_MAPPING[key] || COLOR_MAPPING["Other/N/A Muni"],
                children: [],
            };
            r1Nodes.set(key, node);
        });
    } else {
        r1Nodes.set(filteredMuniName, root);
    }

    const dimensionTracker = new Map<string, Map<string, SunburstData>>();

    apps.forEach((app) => {
        const R1_GROUP_KEY = isAllMunicipalities
            ? app.municipality && MUNICIPALITIES.includes(app.municipality)
                ? app.municipality
                : "N/A"
            : filteredMuniName;

        const r1Node = r1Nodes.get(R1_GROUP_KEY);
        if (!r1Node) return;

        const dimData = getDimensionValue(app, intermediateDimension);
        const dimValueKey = dimData.value;
        const categoryKey = getCategoryValue(app);

        if (dimValueKey === "N/A" || categoryKey === "Uncategorized") return;

        if (!dimensionTracker.has(R1_GROUP_KEY)) {
            dimensionTracker.set(R1_GROUP_KEY, new Map<string, SunburstData>());
        }
        const currentDimMap = dimensionTracker.get(R1_GROUP_KEY)!;

        if (!currentDimMap.has(dimValueKey)) {
            const explicitColor =
                COLOR_MAPPING[dimData.name] || COLOR_MAPPING[dimValueKey];
            const color = explicitColor || getFallbackColor(dimData.name);

            const dimNode: SunburstData = {
                name: dimData.name,
                id: `${r1Node.id}-${dimValueKey.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
                dimensionType: intermediateDimension,
                children: [],
                sortKey: dimData.sortKey,
                color,
            };
            currentDimMap.set(dimValueKey, dimNode);
            r1Node.children!.push(dimNode);
        }

        const dimNode = currentDimMap.get(dimValueKey)!;
        let categoryNode = dimNode.children!.find((c) => c.name === categoryKey);
        if (!categoryNode) {
            categoryNode = {
                name: categoryKey,
                id: `${dimNode.id}-${categoryKey.toLowerCase().replace(/\s/g, "-")}`,
                dimensionType: "category",
                value: 0,
            };
            dimNode.children!.push(categoryNode);
        }
        categoryNode.value! += 1;
    });

    let finalRoot = root;
    if (isAllMunicipalities) {
        r1Nodes.forEach((node) => {
            if (node.children && node.children.length > 0) {
                root.children!.push(node);
            }
        });
        root.children!.sort((a, b) => a.name.localeCompare(b.name));
    } else {
        const singleMuniNode = r1Nodes.get(filteredMuniName);
        if (singleMuniNode) {
            finalRoot = {
                ...root,
                children: singleMuniNode.children,
                name: filteredMuniName,
                color:
                    COLOR_MAPPING[filteredMuniName] ||
                    COLOR_MAPPING["DEFAULT_MUNI_FALLBACK"],
            };
        }
    }

    if (finalRoot.children) {
        finalRoot.children.forEach((r1Node) => {
            if (r1Node.children) {
                r1Node.children.sort((a, b) => a.sortKey! - b.sortKey!);
            }
        });
    }

    return finalRoot;
};

// --- Component ---
const sunburstTheme = {
    labels: { text: { fontSize: 10 } },
    tooltip: {
        container: {
            fontSize: 12,
            padding: 8,
            fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        },
    },
};

export function SunburstAnalyticsCard({
    filteredApps,
    isLoading,
    municipalityFilter,
}: SunburstAnalyticsCardProps) {
    const [intermediateDimension, setIntermediateDimension] =
        useState<IntermediateDimension>("gender");

    const sunburstData = useMemo(() => {
        if (filteredApps.length === 0) return null;
        return buildSunburstData(filteredApps, intermediateDimension, municipalityFilter);
    }, [filteredApps, intermediateDimension, municipalityFilter]);

    if (isLoading) {
        return (
            <Card className="shadow-lg mt-6 w-full">
                <CardContent className="flex items-center justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin mr-3" /> Loading Sunburst Data...
                </CardContent>
            </Card>
        );
    }

    const isAllMunicipalities = municipalityFilter === "all";
    const dimensionLabelMap = {
        municipality: "Municipality",
        gender: "Gender",
        age: "Age Range",
        psCode: "Challenge Statement",
        category: "Category",
    };

    const displayLevelLabels = isAllMunicipalities
        ? [
            dimensionLabelMap["municipality"],
            dimensionLabelMap[intermediateDimension],
            dimensionLabelMap["category"],
        ]
        : [
            dimensionLabelMap[intermediateDimension],
            dimensionLabelMap["category"],
        ];

    const finalSunburstData = sunburstData;
    const hasDataToDisplay = finalSunburstData && finalSunburstData.children?.length > 0;

    return (
        <Card className="shadow-lg mt-6 w-full col-span-full">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Three-Ring Application Breakdown (Sunburst)</CardTitle>
                    <CardDescription>
                        {isAllMunicipalities ? "Inner Ring" : "Ring 1 (Inner)"}:{" "}
                        <span className="font-semibold">{displayLevelLabels[0]}</span> |{" "}
                        {isAllMunicipalities ? "Middle Ring" : "Ring 2"}:{" "}
                        <span className="font-semibold">{displayLevelLabels[1]}</span> |{" "}
                        {isAllMunicipalities ? "Outer Ring" : "Ring 3 (Outer)"}:{" "}
                        <span className="font-semibold">
                            {isAllMunicipalities
                                ? displayLevelLabels[2]
                                : dimensionLabelMap["category"]}
                        </span>
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Group Middle Ring By:</span>
                    <Select
                        value={intermediateDimension}
                        onValueChange={(value: IntermediateDimension) =>
                            setIntermediateDimension(value)
                        }
                        disabled={isLoading || filteredApps.length === 0}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select Dimension" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="gender">
                                <Circle className="h-3 w-3 inline mr-2" /> Gender
                            </SelectItem>
                            <SelectItem value="age">
                                <User className="h-3 w-3 inline mr-2" /> Age Range
                            </SelectItem>
                            <SelectItem value="psCode">
                                <Layers className="h-3 w-3 inline mr-2" /> Challenge Statement
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {hasDataToDisplay ? (
                    <div style={{ height: "600px", width: "100%" }}>
                        <ResponsiveSunburst
                            data={finalSunburstData}
                            id="id"
                            value="value"
                            cornerRadius={4}
                            borderWidth={1}
                            borderColor={{ from: "color", modifiers: [["darker", 1.2]] }}
                            colors={(d) => d.data.color || "hsl(0, 0%, 60%)"}
                            childColor={{ from: "color", modifiers: [["brighter", 0.3]] }}
                            animate
                            motionConfig="gentle"
                            isInteractive
                            theme={sunburstTheme}
                            tooltip={({ value, color, data }) => (
                                <div
                                    style={{
                                        color: "white",
                                        backgroundColor: "#333",
                                        padding: "8px",
                                        borderRadius: "4px",
                                        border: `1px solid ${color}`,
                                    }}
                                >
                                    <strong style={{ color }}>{data.name}</strong>
                                    <br />
                                    <span style={{ fontSize: "10px" }}>
                                        {
                                            dimensionLabelMap[
                                            data.dimensionType as keyof typeof dimensionLabelMap
                                            ]
                                        }
                                        :
                                    </span>{" "}
                                    <strong>{value}</strong> Applications
                                </div>
                            )}
                            arcLabelsSkipAngle={10}
                            arcLabelsTextColor={{ from: "color", modifiers: [["darker", 2]] }}
                        />
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        <Zap className="h-8 w-8 mx-auto mb-2" />
                        <p>
                            No data to display. Please ensure filters return results or target
                            municipalities are present.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
