# 🚀 Full Process of Project

## 📌 Project Overview

This project builds a **dependency graph for tools** using Composio APIs (Google Super + GitHub).
It enables an agent to decide:

* whether to call another tool
* or request input from the user

---

# 🧠 Phase 1: Initial Setup

### 1. Project Setup

* Created project structure
* Initialized Git repository
* Added basic files:

  * `src/`
  * `build_graph.ts`
  * `visualize.html`
  * `dependency_graph.json`

---

### 2. Environment Setup

* Installed Bun:

```bash
curl -fsSL https://bun.sh/install | bash
exec /bin/zsh
```

* Installed dependencies:

```bash
bun add axios dotenv @composio/core
```

---

# 🔑 Phase 2: API Integration

### 1. Composio API Setup

* Generated API key from Composio platform
* Stored securely in `.env`:

```env
COMPOSIO_API_KEY=your_api_key
```

* Ensured `.env` is ignored:

```bash
echo ".env" >> .gitignore
```

---

### 2. Fetching Tools from API

* Used:

```ts
composio.tools.getRawComposioTools()
```

* Fetched:

  * 438 Google tools
  * 867 GitHub tools

---

# 🔗 Phase 3: Base Dependency Graph

### 1. Defined Tools

Each tool includes:

* `id`
* `requires` (input parameters)
* `provides` (output parameters)

---

### 2. Manual Dependencies

Example:

* `GMAIL_LIST_THREADS → GMAIL_REPLY_TO_THREAD`
* `CONTACTS_SEARCH → SEND_EMAIL`

---

### 3. User Input Mapping

If parameter is not derivable:

* Marked as `USER_INPUT`

---

# 🤖 Phase 4: Auto Dependency Inference

### 1. Problem

Manual dependencies are:

* Limited
* Not scalable

---

### 2. Solution: Auto Inference

#### Step 1: Build Provider Map

```ts
param → tools that provide it
```

---

#### Step 2: Infer Dependencies

For each tool:

* Check required parameters
* Find tools that provide them
* Create edges automatically

---

### 3. Example

```
thread_id → provided by LIST_THREADS
→ auto link to REPLY_THREAD
```

---

# 🧠 Phase 5: API-Driven Intelligence

### 1. Enrich from Live Schema

Used:

```ts
live.parameters.required
live.parameters.properties
```

---

### 2. Dynamic Requires Update

```ts
t.requires += live.parameters.required
```

---

### 3. Inferred Outputs

From schema:

* id
* *_id
* url
* email

---

# 🔄 Phase 6: Parameter Normalization

### Problem:

Different formats:

* `thread_id`
* `threadId`
* `thread-id`

---

### Solution:

```ts
function normalize(param) {
  return param.toLowerCase().replace(/[_-]/g, "");
}
```

---

# 🎯 Phase 7: Confidence Scoring

Each edge includes:

* Manual edges → `confidence: 1.0`
* Inferred edges → `confidence: 0.9`

```json
{
  "inferred": true,
  "confidence": 0.9
}
```

---

# 📊 Phase 8: Graph Generation

Generated:

* Nodes (tools)
* Edges (dependencies)
* User input edges

Output:

```
dependency_graph.json
```

---

# 🎨 Phase 9: Visualization

* Built using HTML + JS
* Features:

  * Node graph
  * Tool vs user edges
  * Highlight dependencies

---

# 🧪 Phase 10: Execution

Run:

```bash
bun src/build_graph.ts
```

Output:

* 126 tools
* 145 manual edges
* 300+ inferred edges

---

# 🧾 Phase 11: Git & Deployment

### 1. Git Setup

```bash
git init
git add .
git commit -m "initial"
```

---

### 2. GitHub Repo (CLI)

```bash
gh auth login
gh repo create dep-graph --public --source=. --remote=origin --push
```

---

### 3. Final Push

```bash
git push origin main
```

---

# 🔒 Phase 12: Security

* `.env` excluded from Git
* API key protected

---

# 🏁 Final Result

## ✅ Features

* Real Composio API integration
* Automatic dependency inference
* Parameter normalization
* Confidence scoring
* Agent decision logic

---

## 🧠 What This Enables

The system can:

* Determine tool execution flow
* Decide between tool vs user input
* Scale to 1000+ tools

---

# 🚀 Conclusion

This project evolved from:

* ❌ Static dependency mapping

to:

👉 ✅ **Dynamic, API-driven agent decision graph**

---

# 💡 Key Takeaway

This is not just a graph.

👉 It is a **decision system for AI agents**.
