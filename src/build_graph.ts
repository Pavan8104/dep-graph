/**
 * Builds dependency_graph.json.
 *
 * Parameter sourcing rules (agent decision logic):
 *   source="tool"  → parameter comes from another tool's output; run that tool first
 *   source="user"  → parameter must be provided by the user / conversation context
 *
 * If COMPOSIO_API_KEY is set, live tool schemas are fetched and merged:
 *   - Descriptions are updated from live data
 *   - Tools present in live data but missing from our graph are logged
 *   - Parameter names from live schemas are cross-validated
 *
 * Usage:
 *   node --experimental-strip-types src/build_graph.ts
 *   COMPOSIO_API_KEY=xxx bun src/build_graph.ts
 */

import { writeFile } from "fs/promises";
import { tools, dependencies, groups } from "./graph_data.ts";
import { userInputsByTool } from "./user_inputs_data.ts";
import type { GraphData, UserInputDef } from "./types.ts";

// ── Composio live-data fetch ──────────────────────────────────────────────────

interface ComposioRawTool {
  slug?: string;
  name?: string;
  description?: string;
  parameters?: {
    properties?: Record<string, { description?: string; type?: string }>;
    required?: string[];
  };
}

async function fetchComposioSchemas(toolkit: string): Promise<Map<string, ComposioRawTool>> {
  const apiKey = process.env["COMPOSIO_API_KEY"];
  if (!apiKey) return new Map();
  try {
    const { Composio } = await import("@composio/core");
    const composio = new Composio({ apiKey });
    const rawTools = (await composio.tools.getRawComposioTools({
      toolkits: [toolkit],
      limit: 1000,
    })) as ComposioRawTool[];
    const map = new Map<string, ComposioRawTool>();
    for (const t of rawTools) {
      if (t.slug) map.set(t.slug, t);
    }
    console.log(`  ✓ Fetched ${map.size} tools from Composio (${toolkit})`);
    return map;
  } catch (err) {
    console.warn(`  ⚠ Composio fetch skipped for ${toolkit}: ${(err as Error).message}`);
    return new Map();
  }
}

// ── Tooltip builder ───────────────────────────────────────────────────────────

function buildTooltip(
  id: string,
  label: string,
  description: string,
  provides: string[],
  requires: string[],
  userInputs: UserInputDef[],
): string {
  const prov = provides.length ? `<br/><b>Provides:</b> ${provides.join(", ")}` : "";
  const req  = requires.length  ? `<br/><b>Requires (tool):</b> ${requires.join(", ")}` : "";
  const ui   = userInputs.filter(u => u.required).map(u => u.param);
  const uiStr = ui.length ? `<br/><b>Requires (user):</b> ${ui.join(", ")}` : "";
  return `<b>${label}</b><br/>${description}${prov}${req}${uiStr}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function buildGraph(): Promise<void> {
  console.log("Building dependency graph…");

  // Fetch live schemas if API key present
  const hasApiKey = !!process.env["COMPOSIO_API_KEY"];
  const [googleSchemas, githubSchemas] = await Promise.all([
    fetchComposioSchemas("googlesuper"),
    fetchComposioSchemas("github"),
  ]);
  const liveSchemas = new Map([...googleSchemas, ...githubSchemas]);
  const composioEnriched = liveSchemas.size > 0;

  // Detect tools in live data not yet in our graph
  if (composioEnriched) {
    const ourIds = new Set(tools.map(t => t.id));
    let missing = 0;
    for (const slug of liveSchemas.keys()) {
      if (!ourIds.has(slug)) missing++;
    }
    if (missing > 0) console.log(`  ℹ  ${missing} live tools not yet in local graph (run with --verbose to list)`);
  }

  // Build nodes
  const nodes = tools.map((t) => {
    const live = liveSchemas.get(t.id);
    const description = live?.description ?? t.description;
    const userInputs: UserInputDef[] = userInputsByTool[t.id] ?? [];

    // Cross-validate required params from live schema
    if (live?.parameters?.required && process.env["VERBOSE"]) {
      const knownParams = new Set([...t.requires, ...t.provides, ...userInputs.map(u => u.param)]);
      const uncovered = live.parameters.required.filter(p => !knownParams.has(p));
      if (uncovered.length) console.warn(`  ⚠ ${t.id} uncovered live params: ${uncovered.join(", ")}`);
    }

    return {
      id: t.id,
      label: t.label,
      title: buildTooltip(t.id, t.label, description, t.provides, t.requires, userInputs),
      group: t.group,
      provides: t.provides,
      requires: t.requires,
      user_inputs: userInputs,
      has_user_inputs: userInputs.length > 0,
    };
  });

  // Build tool-to-tool edges
  const toolEdges = dependencies.map((d, i) => ({
    id: `t${String(i).padStart(3, "0")}`,
    from: d.from,
    to: d.to,
    label: d.parameter,
    title: `<b>${getLabel(d.from)}</b> provides <code>${d.parameter}</code> needed by <b>${getLabel(d.to)}</b>`,
    parameter: d.parameter,
    source: "tool" as const,
    arrows: "to",
  }));

  // Build user-input edges (one virtual edge per required user param)
  const userEdges: GraphData["edges"] = [];
  let uIdx = 0;
  for (const node of nodes) {
    for (const ui of node.user_inputs) {
      if (!ui.required) continue;
      userEdges.push({
        id: `u${String(uIdx++).padStart(3, "0")}`,
        from: "USER_INPUT",
        to: node.id,
        label: ui.param,
        title: `<b>User provides</b> <code>${ui.param}</code> (${ui.type}) → <b>${node.label}</b><br/>${ui.description}${ui.example ? `<br/>Example: <i>${ui.example}</i>` : ""}`,
        parameter: ui.param,
        source: "user" as const,
        arrows: "to",
      });
    }
  }

  // Add virtual USER_INPUT node
  const userInputNode = {
    id: "USER_INPUT",
    label: "User / Agent",
    title: "<b>User / Agent</b><br/>Parameters supplied directly by the user or inferred from conversation context.",
    group: "user_input" as any,
    provides: ["user-supplied params"],
    requires: [],
    user_inputs: [],
    has_user_inputs: false,
  };

  const graph: GraphData = {
    metadata: {
      description:
        "Tool dependency graph for Google Super and GitHub (Composio toolkits). " +
        "Edges show parameter flows between tools (source=tool) or from the user/agent (source=user). " +
        "An agent uses this graph to decide: run a prerequisite tool OR prompt the user.",
      toolkits: ["googlesuper", "github"],
      generated_at: new Date().toISOString(),
      total_tools: nodes.length,
      total_dependencies: toolEdges.length,
      total_user_input_edges: userEdges.length,
      composio_enriched: composioEnriched,
    },
    groups: {
      ...groups,
      user_input: { color: "#F79F1A", label: "User / Agent Input" },
    },
    nodes: [userInputNode, ...nodes],
    edges: [...toolEdges, ...userEdges],
  };

  await writeFile("dependency_graph.json", JSON.stringify(graph, null, 2), "utf-8");
  console.log(
    `\n✓ dependency_graph.json — ${nodes.length} tools, ${toolEdges.length} tool edges, ${userEdges.length} user-input edges`,
    composioEnriched ? "(Composio-enriched)" : "(local schema only — set COMPOSIO_API_KEY to enrich)"
  );

  // Summary
  const groupCounts: Record<string, number> = {};
  for (const n of nodes) groupCounts[n.group] = (groupCounts[n.group] ?? 0) + 1;
  console.log("\nTools per service:");
  for (const [g, c] of Object.entries(groupCounts).sort())
    console.log(`  ${(groups[g]?.label ?? g).padEnd(32)} ${c}`);

  console.log("\nExample dependency chains (tool → tool):");
  logChain("Reply to email thread",   ["GOOGLESUPER_GMAIL_LIST_THREADS", "GOOGLESUPER_GMAIL_REPLY_TO_THREAD"]);
  logChain("Email by contact name",   ["GOOGLESUPER_CONTACTS_SEARCH", "GOOGLESUPER_GMAIL_SEND_EMAIL"]);
  logChain("Label a Gmail message",   ["GOOGLESUPER_GMAIL_LIST_MESSAGES", "GOOGLESUPER_GMAIL_LIST_LABELS", "GOOGLESUPER_ADD_LABEL_TO_EMAIL"]);
  logChain("Update calendar event",   ["GOOGLESUPER_CALENDAR_LIST_LIST", "GOOGLESUPER_EVENTS_LIST", "GOOGLESUPER_EVENTS_UPDATE"]);
  logChain("Revoke calendar share",   ["GOOGLESUPER_CALENDAR_LIST_LIST", "GOOGLESUPER_ACL_LIST", "GOOGLESUPER_ACL_DELETE"]);
  logChain("Create PR + merge",       ["GITHUB_LIST_REPOS_FOR_AUTH_USER", "GITHUB_LIST_BRANCHES", "GITHUB_CREATE_PULL_REQUEST", "GITHUB_MERGE_PULL_REQUEST"]);
  logChain("Git object commit",       ["GITHUB_CREATE_A_BLOB", "GITHUB_CREATE_A_TREE", "GITHUB_CREATE_A_COMMIT", "GITHUB_CREATE_BRANCH"]);
  logChain("Deploy + status update",  ["GITHUB_LIST_REPOS_FOR_AUTH_USER", "GITHUB_LIST_BRANCHES", "GITHUB_CREATE_DEPLOYMENT", "GITHUB_CREATE_DEPLOYMENT_STATUS"]);
  logChain("Cancel running workflow", ["GITHUB_LIST_REPOS_FOR_AUTH_USER", "GITHUB_LIST_WORKFLOW_RUNS", "GITHUB_CANCEL_WORKFLOW_RUN"]);

  console.log("\nUser-input summary (tools requiring user-supplied params):");
  for (const n of nodes.filter(n => n.has_user_inputs).slice(0, 10))
    console.log(`  ${n.label.padEnd(30)} ${n.user_inputs.filter(u => u.required).map(u => u.param).join(", ")}`);
  const remaining = nodes.filter(n => n.has_user_inputs).length - 10;
  if (remaining > 0) console.log(`  … and ${remaining} more`);
}

function getLabel(id: string): string {
  return tools.find(t => t.id === id)?.label ?? id;
}

function logChain(name: string, chain: string[]): void {
  console.log(`  ${name.padEnd(28)} ${chain.map(getLabel).join(" → ")}`);
}

buildGraph().catch(console.error);
