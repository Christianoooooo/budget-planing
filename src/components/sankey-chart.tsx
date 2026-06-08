"use client";

import React, { useEffect, useState } from "react";
import { ResponsiveSankey } from "@nivo/sankey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/constants";
import { useTheme } from "next-themes";

interface SankeyNode {
  id: string;
  label: string;
  color: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

interface Props {
  year: number;
  month: number;
}

export default function SankeyChart({ year, month }: Props) {
  const [data, setData] = useState<SankeyData | null>(null);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/sankey?year=${year}&month=${month}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Sankey data fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [year, month]);

  if (loading) {
    return <Skeleton className="h-[400px] rounded-lg" />;
  }

  if (!data || data.nodes.length === 0 || data.links.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Finanz-Flussdiagramm
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Keine Daten für diesen Monat verfügbar
          </div>
        </CardContent>
      </Card>
    );
  }

  const nodeColorMap: Record<string, string> = {};
  data.nodes.forEach((n) => { nodeColorMap[n.id] = n.color; });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Finanz-Flussdiagramm (Sankey)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: Math.max(400, data.nodes.length * 40) }}>
          <ResponsiveSankey
            data={data}
            margin={{ top: 20, right: 160, bottom: 20, left: 20 }}
            align="justify"
            colors={(node) => nodeColorMap[(node as unknown as unknown as SankeyNode).id] || "#94a3b8"}
            nodeOpacity={1}
            nodeHoverOthersOpacity={0.35}
            nodeThickness={18}
            nodeSpacing={24}
            nodeBorderWidth={0}
            nodeBorderRadius={3}
            linkOpacity={0.3}
            linkHoverOthersOpacity={0.1}
            linkContract={3}
            enableLinkGradient
            labelPosition="outside"
            labelOrientation="horizontal"
            labelPadding={12}
            labelTextColor={isDark ? "#e2e8f0" : "#1e293b"}
            label={(node) => {
              const n = data.nodes.find((nd) => nd.id === (node as unknown as SankeyNode).id);
              return n?.label || String((node as unknown as SankeyNode).id);
            }}
            nodeTooltip={({ node }) => {
              const n = data.nodes.find((nd) => nd.id === node.id);
              return (
                <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-sm">
                  <strong>{n?.label || node.id}</strong>
                  <br />
                  {formatCurrency(node.value as number)}
                </div>
              );
            }}
            linkTooltip={({ link }) => {
              const sourceNode = data.nodes.find((n) => n.id === link.source.id);
              const targetNode = data.nodes.find((n) => n.id === link.target.id);
              return (
                <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-sm">
                  {sourceNode?.label || link.source.id} → {targetNode?.label || link.target.id}
                  <br />
                  <strong>{formatCurrency(link.value as number)}</strong>
                </div>
              );
            }}
            theme={{
              text: { fill: isDark ? "#94a3b8" : "#64748b" },
              tooltip: { container: { background: "transparent", boxShadow: "none", padding: 0 } },
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
