# build a tool dependency graph (60-120 mins)

we care about the quality and structure of the dependency relationships you discover

some actions need precursor actions before being able to execute them

a concrete example

1. the tool `GMAIL_REPLY_TO_THREAD` which needs a `thread_id`
2. which can be got by `GMAIL_LIST_THREADS` as an example, there could be other ways to get a `thread_id` too

a second more dense exmaple
the send email tool needs an email, if you give a name it should fetch the name from contacts and then you can send the email



when we agentically execute actions inside composio, we need to know either what info to get from the user or what other action we should take before we execute the action.

you are supposed to build a dependency graph for this

to keep this limited in scope, we expect you to only do it for [Google Super](https://docs.composio.dev/toolkits/googlesuper) and [Github](https://docs.composio.dev/toolkits/github)

the final submission should be a visualized dependency graph where i can see connection (this is not super important just should exist for me to see if graph with edges and nodes)

## get started

1. go to https://platform.composio.dev and get an api key
2. run `COMPOSIO_API_KEY=PUT_YOUR_KEY_HERE sh scaffold.sh` will give you an **openrouter-key**
3. check `src/index.ts` to see how to fetch full google raw tools (fastest way to run is https://bun.sh/)

you can implement this with whatever language you want, feel free to use language models and coding tools

## submit

once you are done use `sh upload.sh <your_email> [--skip-session]`

## agent session tracing (required by default)

- `upload.sh` collects recent local agent sessions into `agent-sessions/` before creating your submission zip.
- It includes recent activity from this task folder for Codex, Claude Code, OpenCode, and Cursor (90-minute window).
- If no recent sessions are found, interactive runs prompt you before continuing.
- Use `--skip-session` only if you explicitly want to upload without session tracing.

examples:

- `sh upload.sh your_email@example.com`
- `sh upload.sh your_email@example.com --skip-session`

NOTE:  Feel free to use LLM, you will be judged by the quality of output, eval...

---

## How the dependency graph works

### Running the graph builder

```bash
# Without Composio key (uses local schema — works offline)
node --experimental-strip-types src/build_graph.ts

# With Composio key (enriches descriptions from live API + cross-validates params)
COMPOSIO_API_KEY=your_key bun src/build_graph.ts

# View the visualization (requires a local HTTP server)
python3 -m http.server 8080
# → open http://localhost:8080/visualize.html
```

### How dependencies are derived

Each tool is modelled with two parameter lists:

| Field | Meaning |
|---|---|
| `provides` | IDs / resources this tool returns (e.g. `thread_id`, `file_id`) |
| `requires` | IDs this tool needs as input from another tool |
| `user_inputs` | Parameters the agent must get from the user / conversation |

A dependency edge `A → B` with `parameter = thread_id` means:
> Tool A must run before tool B, because B needs `thread_id` and A is the tool that returns it.

### Agent decision logic

When an agent needs to execute tool **T**:

```
for each required_param of T:
  if required_param is in provides[] of some other tool X:
    → add X as a prerequisite; run X first (source = "tool")
    → if multiple tools can provide it, prefer the most specific one
  else:
    → ask the user / pull from conversation context (source = "user")
```

Example — *"Reply to John's last thread"*:
1. `thread_id` → source=**tool** → run `GMAIL_LIST_THREADS` first
2. `body` → source=**user** → ask *"What should the reply say?"*
3. Now run `GMAIL_REPLY_TO_THREAD(thread_id, body)`

Example — *"Send an email to Alice Smith"*:
1. `email` → source=**tool** (alternative) → run `CONTACTS_SEARCH(query="Alice Smith")`  
   **OR** source=**user** if user provides the address directly
2. `subject`, `body` → source=**user** → ask user
3. Run `GMAIL_SEND_EMAIL(to, subject, body)`

### Edge types in the visualization

| Edge style | Meaning |
|---|---|
| Solid grey arrow | Tool-to-tool: parameter flows from one tool's output to another's input |
| Dashed orange arrow | User-to-tool: parameter must be supplied by the user/agent (click "User edges" to toggle) |

### Node shapes

| Shape | Meaning |
|---|---|
| Diamond | Entry point — no tool dependencies (can run without prerequisites) |
| Box | Middle node — both has dependencies and produces outputs |
| Ellipse | Terminal — consumes inputs but produces no further IDs |
| Star (gold) | Virtual USER / Agent node |

**Orange border** on a node = that tool requires at least one user-supplied parameter.

### Composio API enrichment

If `COMPOSIO_API_KEY` is set, `build_graph.ts` fetches live schemas from both `googlesuper` and `github` toolkits and:
- Updates tool descriptions from the live API
- Cross-validates required parameter names (run with `VERBOSE=1` for details)
- Logs tools present in the live API but not yet in the local graph

### Project structure

```
src/
  graph_data.ts       — 126 tool definitions with provides/requires
  user_inputs_data.ts — per-tool user-supplied parameter specs
  build_graph.ts      — generates dependency_graph.json (with optional Composio merge)
  types.ts            — TypeScript interfaces
  index.ts            — original Composio raw-tool fetch example
dependency_graph.json — pre-built graph (126 nodes, 145 tool edges, 51 user-input edges)
visualize.html        — interactive vis-network visualization
```

### Extra feature

The **"User edges" toggle button** in the header shows/hides the user-input dependency edges as dashed orange arrows flowing from the virtual **User / Agent** node into every tool that needs user-supplied parameters. This lets you switch between:
- **Off** (default): clean tool-to-tool graph, easy to trace execution paths
- **On**: full picture showing exactly which tools block on user input before they can execute
