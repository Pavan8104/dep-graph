export type ToolGroup =
  | "gmail" | "contacts" | "calendar" | "drive" | "sheets"
  | "tasks" | "photos" | "analytics"
  | "github_repo" | "github_branches" | "github_commits" | "github_issues"
  | "github_prs" | "github_actions" | "github_deploy" | "github_releases"
  | "github_org" | "github_collaborators" | "github_checks";

export interface UserInputDef {
  param: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required: boolean;
  example?: string;
}

export interface ToolDef {
  id: string;
  label: string;
  description: string;
  group: ToolGroup;
  provides: string[];
  requires: string[];
  user_inputs?: UserInputDef[];
}

/** source="tool" → parameter flows from another tool's output.
 *  source="user" → parameter must be supplied by the user/agent caller. */
export interface DependencyEdge {
  from: string;
  to: string;
  parameter: string;
  source: "tool" | "user";
  inferred?: boolean;
  confidence?: number;
}

export interface GroupConfig {
  color: string;
  label: string;
}

export interface GraphData {
  metadata: {
    description: string;
    toolkits: string[];
    generated_at: string;
    total_tools: number;
    total_dependencies: number;
    total_user_input_edges: number;
    composio_enriched: boolean;
  };
  groups: Record<string, GroupConfig>;
  nodes: {
    id: string;
    label: string;
    title: string;
    group: string;
    provides: string[];
    requires: string[];
    user_inputs: UserInputDef[];
    has_user_inputs: boolean;
  }[];
  edges: {
    id: string;
    from: string;
    to: string;
    label: string;
    title: string;
    parameter: string;
    source: "tool" | "user";
    /** true = edge was auto-inferred from provides/requires schema */
    inferred: boolean;
    confidence: number;
    arrows: string;
  }[];
  /** Total auto-inferred tool-to-tool edges (subset of total_dependencies) */
  inferred_dependencies?: number;
}
