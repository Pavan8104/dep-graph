export type ToolGroup =
  | "gmail" | "contacts" | "calendar" | "drive" | "sheets"
  | "tasks" | "photos" | "analytics"
  | "github_repo" | "github_branches" | "github_commits" | "github_issues"
  | "github_prs" | "github_actions" | "github_deploy" | "github_releases"
  | "github_org" | "github_collaborators" | "github_checks";

export interface ToolDef {
  id: string;
  label: string;
  description: string;
  group: ToolGroup;
  provides: string[];
  requires: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  parameter: string;
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
  };
  groups: Record<string, GroupConfig>;
  nodes: {
    id: string;
    label: string;
    title: string;
    group: string;
    provides: string[];
    requires: string[];
  }[];
  edges: {
    id: string;
    from: string;
    to: string;
    label: string;
    title: string;
    parameter: string;
    arrows: string;
  }[];
}
