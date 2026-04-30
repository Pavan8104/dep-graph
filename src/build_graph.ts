/**
 * Builds dependency_graph.json.
 *
 * Parameter sourcing rules (agent decision logic):
 *   source="tool"  → parameter comes from another tool's output; run that tool first
 *   source="user"  → parameter must be provided by the user / conversation context
 *
 * Dependency edges are produced in two passes:
 *   1. Manual  — curated edges in graph_data.ts (inferred=false)
 *   2. Auto    — inferred by matching tool.requires[] against paramProviders map (inferred=true)
 *
 * If COMPOSIO_API_KEY is set, live tool schemas are fetched and merged:
 *   - Descriptions updated from live API
 *   - Required params from live schema added to requires[] before inference
 *   - Tools present in live data but not in local graph are logged
 *
 * Usage:
 *   node --experimental-strip-types src/build_graph.ts
 *   COMPOSIO_API_KEY=xxx bun src/build_graph.ts
 *   VERBOSE=1 bun src/build_graph.ts   (shows uncovered params)
 */

import { writeFile } from "node:fs/promises";
import { tools, dependencies, groups } from "./graph_data.ts";
import { userInputsByTool } from "./user_inputs_data.ts";
import type { GraphData, UserInputDef } from "./types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ComposioRawTool {
  slug?: string;
  name?: string;
  description?: string;
  parameters?: {
    properties?: Record<string, { description?: string; type?: string }>;
    required?: string[];
  };
}

type ToolEdge = GraphData["edges"][number];

// ── Composio live-data fetch ──────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize(param: string): string {
  return param.toLowerCase().replace(/[_-]/g, "");
}

// ── Param provider map ────────────────────────────────────────────────────────

/**
 * Builds a map of { normalizedParamName → [toolId, ...] } from all tools' provides[].
 * Also infers potential outputs from live schema (id, url, email, etc.)
 */
function buildParamProviders(liveSchemas: Map<string, ComposioRawTool>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const t of tools) {
    const allProvides = new Set(t.provides);

    // Inferred outputs from schema
    const live = liveSchemas.get(t.id);
    if (live?.parameters?.properties) {
      for (const param of Object.keys(live.parameters.properties)) {
        if (param === "id" || param.endsWith("_id") || param === "url" || param === "email") {
          allProvides.add(param);
        }
      }
    }

    for (const param of allProvides) {
      const key = normalize(param);
      const existing = map.get(key) ?? [];
      if (!existing.includes(t.id)) existing.push(t.id);
      map.set(key, existing);
    }
  }
  return map;
}

// ── Auto-inference ────────────────────────────────────────────────────────────

/**
 * For every tool, looks up each entry in requires[] in paramProviders.
 */
function inferDependencies(
  paramProviders: Map<string, string[]>,
  existingKeys: Set<string>,
): Array<{ from: string; to: string; parameter: string }> {
  const inferred: Array<{ from: string; to: string; parameter: string }> = [];

  for (const t of tools) {
    for (const param of t.requires) {
      const providers = paramProviders.get(normalize(param)) ?? [];
      for (const from of providers) {
        if (from === t.id) continue; // skip self-loops
        const key = `${from}→${t.id}:${param}`;
        if (existingKeys.has(key)) continue;
        inferred.push({ from, to: t.id, parameter: param });
        existingKeys.add(key); // prevent duplicate inferred edges
      }
    }
  }

  return inferred;
}

// ── Tooltip builder ───────────────────────────────────────────────────────────

function buildTooltip(
  label: string,
  description: string,
  provides: string[],
  requires: string[],
  userInputs: UserInputDef[],
): string {
  const prov  = provides.length ? `<br/><b>Provides:</b> ${provides.join(", ")}` : "";
  const req   = requires.length ? `<br/><b>Requires (tool):</b> ${requires.join(", ")}` : "";
  const ui    = userInputs.filter(u => u.required).map(u => u.param);
  const uiStr = ui.length ? `<br/><b>Requires (user):</b> ${ui.join(", ")}` : "";
  return `<b>${label}</b><br/>${description}${prov}${req}${uiStr}`;
}

// ── Edge factory helpers ───────────────────────────────────────────────────────

function makeToolEdge(from: string, to: string, param: string, idx: number, inferred: boolean): ToolEdge {
  const inferNote = inferred ? " <i>(auto-inferred)</i>" : "";
  return {
    id: inferred ? `i${String(idx).padStart(3, "0")}` : `t${String(idx).padStart(3, "0")}`,
    from,
    to,
    label: param,
    title: `<b>${getLabel(from)}</b> provides <code>${param}</code> needed by <b>${getLabel(to)}</b>${inferNote}`,
    parameter: param,
    source: "tool",
    inferred,
    confidence: inferred ? 0.9 : 1.0,
    arrows: "to",
  };
}

function makeUserEdge(to: string, ui: UserInputDef, idx: number): ToolEdge {
  const exampleNote = ui.example ? ` Example: ${ui.example}` : "";
  return {
    id: `u${String(idx).padStart(3, "0")}`,
    from: "USER_INPUT",
    to,
    label: ui.param,
    title: `<b>User provides</b> <code>${ui.param}</code> (${ui.type}) to <b>${getLabel(to)}</b>. ${ui.description}.${exampleNote}`,
    parameter: ui.param,
    source: "user",
    inferred: false,
    confidence: 1.0,
    arrows: "to",
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function buildGraph(): Promise<void> {
  console.log("Building dependency graph…");

  // 1. Fetch live schemas (no-op if no API key)
  const [googleSchemas, githubSchemas] = await Promise.all([
    fetchComposioSchemas("googlesuper"),
    fetchComposioSchemas("github"),
  ]);
  const liveSchemas = new Map([...googleSchemas, ...githubSchemas]);
  const composioEnriched = liveSchemas.size > 0;

  if (composioEnriched) {
    const ourIds = new Set(tools.map(t => t.id));
    let missing = 0;
    for (const slug of liveSchemas.keys()) {
      if (!ourIds.has(slug)) missing++;
    }
    if (missing > 0)
      console.log(`  ℹ  ${missing} live tools not yet in local graph (set VERBOSE=1 to list)`);
  }

  // 2. Build nodes (enrich descriptions from live schema if available)
  const nodes = tools.map((t) => {
    const live = liveSchemas.get(t.id);
    const description = live?.description ?? t.description;
    const userInputs: UserInputDef[] = userInputsByTool[t.id] ?? [];

    // Enrich requires from live schema
    const liveRequired = live?.parameters?.required ?? [];
    for (const param of liveRequired) {
      if (!t.requires.includes(param)) {
        t.requires.push(param);
      }
    }

    if (live?.parameters?.required && process.env["VERBOSE"]) {
      const known = new Set([...t.requires, ...t.provides, ...userInputs.map(u => u.param)]);
      const uncovered = live.parameters.required.filter(p => !known.has(p));
      if (uncovered.length) console.warn(`  ⚠ ${t.id} uncovered live params: ${uncovered.join(", ")}`);
    }

    return {
      id: t.id,
      label: t.label,
      title: buildTooltip(t.label, description, t.provides, t.requires, userInputs),
      group: t.group,
      provides: t.provides,
      requires: t.requires,
      user_inputs: userInputs,
      has_user_inputs: userInputs.length > 0,
    };
  });

  // 3. Build param-provider map for auto-inference
  const paramProviders = buildParamProviders(liveSchemas);

  // 4. Existing manual edges → seed the dedup key set
  const existingKeys = new Set(
    dependencies.map(d => `${d.from}→${d.to}:${d.parameter}`)
  );

  // 5. Infer additional edges from schema provides/requires
  const inferredDeps = inferDependencies(paramProviders, existingKeys);
  console.log(`  Using Composio schema for inference: ${composioEnriched}`);
  console.log(`  Total inferred edges: ${inferredDeps.length}`);
  if (inferredDeps.length > 0) {
    console.log("  First 5 inferred edges:");
    for (const e of inferredDeps.slice(0, 5))
      console.log(`    ${getLabel(e.from)} → ${getLabel(e.to)}  [${e.parameter}]`);
  }

  // 6. Build all tool edges (manual + inferred)
  const toolEdges: ToolEdge[] = [
    ...dependencies.map((d, i) => makeToolEdge(d.from, d.to, d.parameter, i, false)),
    ...inferredDeps.map((d, i) => makeToolEdge(d.from, d.to, d.parameter, i, true)),
  ];

  // 7. Build user-input edges
  const userEdges: ToolEdge[] = [];
  let uIdx = 0;
  for (const node of nodes) {
    for (const ui of node.user_inputs) {
      if (ui.required) userEdges.push(makeUserEdge(node.id, ui, uIdx++));
    }
  }

  // 8. Virtual USER_INPUT node
  const userInputNode = {
    id: "USER_INPUT",
    label: "User / Agent",
    title: "<b>User / Agent</b><br/>Parameters supplied directly by the user or inferred from conversation context.",
    group: "user_input" as any,
    provides: ["user-supplied params"],
    requires: [] as string[],
    user_inputs: [] as UserInputDef[],
    has_user_inputs: false,
  };

  // 9. Assemble graph
  const graph: GraphData = {
    metadata: {
      description:
        "Tool dependency graph for Google Super and GitHub (Composio toolkits). " +
        "Edges show parameter flows between tools (source=tool) or from the user/agent (source=user). " +
        "Inferred edges are auto-derived by matching requires[] against provides[] across all tools.",
      toolkits: ["googlesuper", "github"],
      generated_at: new Date().toISOString(),
      total_tools: nodes.length,
      total_dependencies: toolEdges.length,
      total_user_input_edges: userEdges.length,
      composio_enriched: composioEnriched,
    },
    inferred_dependencies: inferredDeps.length,
    groups: { ...groups, user_input: { color: "#F79F1A", label: "User / Agent Input" } },
    nodes: [userInputNode, ...nodes],
    edges: [...toolEdges, ...userEdges],
  };

  await writeFile("dependency_graph.json", JSON.stringify(graph, null, 2), "utf-8");
  console.log(
    `\n✓ dependency_graph.json — ${nodes.length} tools, ` +
    `${dependencies.length} manual + ${inferredDeps.length} inferred tool edges, ` +
    `${userEdges.length} user-input edges` +
    (composioEnriched ? " (Composio-enriched)" : "")
  );

  // 10. Summary tables
  const groupCounts: Record<string, number> = {};
  for (const n of nodes) groupCounts[n.group] = (groupCounts[n.group] ?? 0) + 1;
  console.log("\nTools per service:");
  for (const [g, c] of Object.entries(groupCounts).sort((a, b) => a[0].localeCompare(b[0])))
    console.log(`  ${(groups[g]?.label ?? g).padEnd(32)} ${c}`);

  console.log("\nExample dependency chains:");
  logChain("Reply to email thread",   ["GOOGLESUPER_GMAIL_LIST_THREADS", "GOOGLESUPER_GMAIL_REPLY_TO_THREAD"]);
  logChain("Email by contact name",   ["GOOGLESUPER_CONTACTS_SEARCH", "GOOGLESUPER_GMAIL_SEND_EMAIL"]);
  logChain("Label a message",         ["GOOGLESUPER_GMAIL_LIST_MESSAGES", "GOOGLESUPER_GMAIL_LIST_LABELS", "GOOGLESUPER_ADD_LABEL_TO_EMAIL"]);
  logChain("Update calendar event",   ["GOOGLESUPER_CALENDAR_LIST_LIST", "GOOGLESUPER_EVENTS_LIST", "GOOGLESUPER_EVENTS_UPDATE"]);
  logChain("Create PR + merge",       ["GITHUB_LIST_REPOS_FOR_AUTH_USER", "GITHUB_LIST_BRANCHES", "GITHUB_CREATE_PULL_REQUEST", "GITHUB_MERGE_PULL_REQUEST"]);
  logChain("Git object commit",       ["GITHUB_CREATE_A_BLOB", "GITHUB_CREATE_A_TREE", "GITHUB_CREATE_A_COMMIT", "GITHUB_CREATE_BRANCH"]);
  logChain("Deploy + status update",  ["GITHUB_LIST_REPOS_FOR_AUTH_USER", "GITHUB_LIST_BRANCHES", "GITHUB_CREATE_DEPLOYMENT", "GITHUB_CREATE_DEPLOYMENT_STATUS"]);

  console.log("\nUser-input summary:");
  for (const n of nodes.filter(n => n.has_user_inputs).slice(0, 10))
    console.log(`  ${n.label.padEnd(30)} ${n.user_inputs.filter(u => u.required).map(u => u.param).join(", ")}`);
  const extraUI = nodes.filter(n => n.has_user_inputs).length - 10;
  if (extraUI > 0) console.log(`  … and ${extraUI} more`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLabel(id: string): string {
  return tools.find(t => t.id === id)?.label ?? id;
}

function logChain(name: string, chain: string[]): void {
  console.log(`  ${name.padEnd(28)} ${chain.map(getLabel).join(" → ")}`);
}

buildGraph().catch(console.error);
