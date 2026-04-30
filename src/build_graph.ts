/**
 * Builds dependency_graph.json from graph_data.ts tool definitions.
 * Optionally enriches with live Composio API data when COMPOSIO_API_KEY is set.
 *
 * Usage:
 *   bun src/build_graph.ts
 *   COMPOSIO_API_KEY=xxx bun src/build_graph.ts
 */

import { writeFile } from "fs/promises";
import { tools, dependencies, groups } from "./graph_data.ts";
import type { GraphData } from "./types.ts";

const usedNodeIds = new Set<string>([
  ...dependencies.map((d) => d.from),
  ...dependencies.map((d) => d.to),
]);

// If Composio API key is set, optionally merge live tool descriptions
async function fetchComposioTools(toolkit: string): Promise<Record<string, string>> {
  const apiKey = process.env["COMPOSIO_API_KEY"];
  if (!apiKey) return {};
  try {
    const { Composio } = await import("@composio/core");
    const composio = new Composio({ apiKey });
    const rawTools = await composio.tools.getRawComposioTools({
      toolkits: [toolkit],
      limit: 1000,
    });
    const map: Record<string, string> = {};
    for (const t of rawTools as { slug?: string; description?: string }[]) {
      if (t.slug && t.description) map[t.slug] = t.description;
    }
    console.log(`Fetched ${Object.keys(map).length} tools from Composio (${toolkit})`);
    return map;
  } catch {
    console.warn(`Composio fetch skipped for ${toolkit} (no API key or module not found)`);
    return {};
  }
}

async function buildGraph(): Promise<void> {
  const [googleDescriptions, githubDescriptions] = await Promise.all([
    fetchComposioTools("googlesuper"),
    fetchComposioTools("github"),
  ]);
  const liveDescriptions = { ...googleDescriptions, ...githubDescriptions };

  const nodes = tools.map((t) => ({
    id: t.id,
    label: t.label,
    title: buildTooltip(t, liveDescriptions[t.id]),
    group: t.group,
    provides: t.provides,
    requires: t.requires,
  }));

  const edges = dependencies.map((d, i) => ({
    id: `e${String(i).padStart(3, "0")}`,
    from: d.from,
    to: d.to,
    label: d.parameter,
    title: `<b>${getLabel(d.from)}</b> → provides <code>${d.parameter}</code> → <b>${getLabel(d.to)}</b>`,
    parameter: d.parameter,
    arrows: "to",
  }));

  const graph: GraphData = {
    metadata: {
      description:
        "Tool dependency graph for Google Super and GitHub toolkits. " +
        "An edge FROM→TO means tool FROM provides a parameter that tool TO requires. " +
        "Built by analysing each tool's inputs/outputs and mapping the parameter flows.",
      toolkits: ["googlesuper", "github"],
      generated_at: new Date().toISOString(),
      total_tools: nodes.length,
      total_dependencies: edges.length,
    },
    groups,
    nodes,
    edges,
  };

  await writeFile("dependency_graph.json", JSON.stringify(graph, null, 2), "utf-8");
  console.log(
    `✓ dependency_graph.json written — ${nodes.length} tools, ${edges.length} edges`
  );

  // Print summary table
  const groupCounts: Record<string, number> = {};
  for (const n of nodes) {
    groupCounts[n.group] = (groupCounts[n.group] ?? 0) + 1;
  }
  console.log("\nTools per service:");
  for (const [grp, count] of Object.entries(groupCounts).sort()) {
    const label = groups[grp]?.label ?? grp;
    console.log(`  ${label.padEnd(30)} ${count}`);
  }

  // Print interesting dependency chains
  console.log("\nExample dependency chains:");
  printChain("Reply to thread", [
    "GOOGLESUPER_GMAIL_LIST_THREADS",
    "GOOGLESUPER_GMAIL_REPLY_TO_THREAD",
  ]);
  printChain("Send email by contact name", [
    "GOOGLESUPER_CONTACTS_SEARCH",
    "GOOGLESUPER_GMAIL_SEND_EMAIL",
  ]);
  printChain("Add label to message", [
    "GOOGLESUPER_GMAIL_LIST_MESSAGES",
    "GOOGLESUPER_GMAIL_LIST_LABELS",
    "GOOGLESUPER_ADD_LABEL_TO_EMAIL",
  ]);
  printChain("Update calendar event", [
    "GOOGLESUPER_CALENDAR_LIST_LIST",
    "GOOGLESUPER_EVENTS_LIST",
    "GOOGLESUPER_EVENTS_UPDATE",
  ]);
  printChain("Create PR from branch", [
    "GITHUB_LIST_REPOS_FOR_AUTH_USER",
    "GITHUB_LIST_BRANCHES",
    "GITHUB_CREATE_PULL_REQUEST",
    "GITHUB_MERGE_PULL_REQUEST",
  ]);
  printChain("Git object model commit", [
    "GITHUB_LIST_REPOS_FOR_AUTH_USER",
    "GITHUB_CREATE_A_BLOB",
    "GITHUB_CREATE_A_TREE",
    "GITHUB_CREATE_A_COMMIT",
    "GITHUB_CREATE_BRANCH",
  ]);
  printChain("Trigger + cancel workflow", [
    "GITHUB_LIST_REPOS_FOR_AUTH_USER",
    "GITHUB_LIST_WORKFLOWS",
    "GITHUB_TRIGGER_WORKFLOW",
    "GITHUB_LIST_WORKFLOW_RUNS",
    "GITHUB_CANCEL_WORKFLOW_RUN",
  ]);
  printChain("Deploy and update status", [
    "GITHUB_LIST_REPOS_FOR_AUTH_USER",
    "GITHUB_LIST_BRANCHES",
    "GITHUB_CREATE_DEPLOYMENT",
    "GITHUB_CREATE_DEPLOYMENT_STATUS",
  ]);
}

function getLabel(id: string): string {
  return tools.find((t) => t.id === id)?.label ?? id;
}

function buildTooltip(t: typeof tools[0], liveDesc?: string): string {
  const desc = liveDesc ?? t.description;
  const provides = t.provides.length ? `<br/><b>Provides:</b> ${t.provides.join(", ")}` : "";
  const requires = t.requires.length ? `<br/><b>Requires:</b> ${t.requires.join(", ")}` : "";
  return `<b>${t.label}</b><br/>${desc}${provides}${requires}`;
}

function printChain(name: string, chain: string[]): void {
  console.log(`  ${name}: ${chain.map(getLabel).join(" → ")}`);
}

buildGraph().catch(console.error);
