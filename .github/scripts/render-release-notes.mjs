import fs from "node:fs";
import { execFileSync } from "node:child_process";
import https from "node:https";

const RELEASE_CONFIG_PATH = ".github/release.yml";
const GITHUB_API_BASE = new URL("https://api.github.com");
const GITHUB_WEB_BASE = new URL("https://github.com");
const GITHUB_REPO_SEGMENT_PATTERN = /^[A-Za-z0-9_.-]+$/;
const GITHUB_SHA_PATTERN = /^[a-f0-9]{7,40}$/i;
const GITHUB_USER_AGENT =
  process.env.GITHUB_USER_AGENT || "neonconductor-release-notes/1.0";

const REQUIRED_ENV = [
  "CHANNEL",
  "TAG_NAME",
  "VERSION",
  "CHANNEL_HEADLINE",
  "REPO_OWNER",
  "REPO_NAME",
];

const DEFAULT_CATEGORY_CONFIG = [
  { title: "Breaking Changes 💥", labels: ["type: breaking"] },
  { title: "Features 🚀", labels: ["type: feature"] },
  { title: "Enhancements 🌈", labels: ["type: enhancement"] },
  { title: "Bug Fixes 🐞", labels: ["type: bug"] },
  { title: "Refactoring 🛠", labels: ["type: refactor"] },
  { title: "Performance Improvements ⚡️", labels: ["type: performance"] },
  { title: "Documentation 📚", labels: ["type: docs"] },
  { title: "Tests 🧪", labels: ["type: test"] },
  { title: "Build System 🏗", labels: ["type: build"] },
  { title: "Continuous Integration 🔄", labels: ["type: ci"] },
  { title: "Dependency Updates 📦", labels: ["type: dependencies"] },
  { title: "Chores 🧹", labels: ["type: chore"] },
  { title: "Security 🔐", labels: ["type: security"] },
  { title: "Style 💅", labels: ["type: style"] },
  { title: "Reverts 🔄", labels: ["type: revert"] },
];

const SEMANTIC_TYPE_TO_LABEL = {
  feat: "type: feature",
  fix: "type: bug",
  chore: "type: chore",
  docs: "type: docs",
  refactor: "type: refactor",
  test: "type: test",
  perf: "type: performance",
  build: "type: build",
  ci: "type: ci",
  revert: "type: revert",
};

function readEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseReleaseConfig() {
  if (!fs.existsSync(RELEASE_CONFIG_PATH)) {
    return { categories: DEFAULT_CATEGORY_CONFIG, excludeLabels: ["ignore-for-release"] };
  }

  const source = fs.readFileSync(RELEASE_CONFIG_PATH, "utf8").replace(/\r\n/g, "\n");
  const categories = [];

  const categoriesMatch = source.match(/categories:\s*\n([\s\S]*)$/m);
  if (categoriesMatch) {
    const lines = categoriesMatch[1].split("\n");
    let current = null;
    let inLabels = false;

    for (const line of lines) {
      const titleMatch = line.match(/^\s*-\s+title:\s*(.+)\s*$/);
      if (titleMatch) {
        if (current) categories.push(current);
        current = { title: unquote(titleMatch[1]), labels: [] };
        inLabels = false;
        continue;
      }

      if (!current) continue;
      if (/^\s*labels:\s*$/.test(line)) {
        inLabels = true;
        continue;
      }

      if (inLabels) {
        const labelMatch = line.match(/^\s*-\s+(.+)\s*$/);
        if (labelMatch) {
          current.labels.push(unquote(labelMatch[1]));
        }
      }
    }

    if (current) categories.push(current);
  }

  const excludeLabels = [];
  const excludeMatch = source.match(/exclude:\s*\n\s*labels:\s*\n([\s\S]*?)\n\s*categories:/m);
  if (excludeMatch) {
    for (const line of excludeMatch[1].split("\n")) {
      const labelMatch = line.match(/^\s*-\s+(.+)\s*$/);
      if (labelMatch) excludeLabels.push(unquote(labelMatch[1]));
    }
  }

  if (!excludeLabels.includes("ignore-for-release")) {
    excludeLabels.push("ignore-for-release");
  }

  return {
    categories: categories.length > 0 ? categories : DEFAULT_CATEGORY_CONFIG,
    excludeLabels,
  };
}

function runGit(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function revList(range) {
  const raw = runGit(["rev-list", range]);
  return raw ? raw.split("\n").map((x) => x.trim()).filter(Boolean) : [];
}

function extractWhatsChanged(body) {
  if (!body) return "";
  const marker = "## What's Changed";
  const start = body.indexOf(marker);
  if (start === -1) return "";

  const afterMarker = body.slice(start + marker.length).replace(/^\s*\n/, "");
  const nextHeaderIndex = afterMarker.search(/\n##\s+/);
  const section = nextHeaderIndex === -1 ? afterMarker : afterMarker.slice(0, nextHeaderIndex);
  return section.trim();
}

function isWrapperPullRequest(pr, excludeLabels) {
  const labels = new Set((pr.labels || []).map((label) => label.name));
  for (const label of excludeLabels) {
    if (labels.has(label)) return true;
  }

  const headRef = pr.head?.ref || "";
  const baseRef = pr.base?.ref || "";
  const title = (pr.title || "").toLowerCase();

  if (headRef === "dev" && baseRef === "prev") return true;
  if (headRef === "prev" && baseRef === "main") return true;
  if (headRef.startsWith("changeset-release/")) return true;
  if (title.startsWith("chore(release): version")) return true;
  return false;
}

function normalizePrTitle(title) {
  return (title || "").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

function semanticLabelFromTitle(title) {
  const match = (title || "").match(
    /^(feat|fix|chore|docs|refactor|test|perf|build|ci|revert)(?:\([^)]+\))?(!)?:\s/i
  );
  if (!match) return null;
  if (match[2]) return "type: breaking";
  return SEMANTIC_TYPE_TO_LABEL[match[1].toLowerCase()] || null;
}

function categoryFromLabels(labelSet, categories) {
  for (const category of categories) {
    if (category.labels.some((label) => labelSet.has(label))) {
      return category.title;
    }
  }
  return null;
}

function formatChannelName(channel) {
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

function normalizeRepoSegment(segmentName, value) {
  const normalized = (value || "").trim();
  if (!GITHUB_REPO_SEGMENT_PATTERN.test(normalized)) {
    throw new Error(`Invalid repository ${segmentName}: ${value}`);
  }
  return normalized;
}

function normalizeSha(sha) {
  const normalized = (sha || "").trim();
  return GITHUB_SHA_PATTERN.test(normalized) ? normalized : null;
}

function buildGitHubRepoBasePath(owner, repo) {
  const normalizedOwner = normalizeRepoSegment("owner", owner);
  const normalizedRepo = normalizeRepoSegment("name", repo);
  return `/repos/${encodeURIComponent(normalizedOwner)}/${encodeURIComponent(normalizedRepo)}`;
}

function buildGitHubApiUrl(pathname, query) {
  const url = new URL(pathname, GITHUB_API_BASE);
  if (url.origin !== GITHUB_API_BASE.origin) {
    throw new Error(`Refusing to call non-GitHub API origin: ${url.origin}`);
  }

  if (query) {
    const params = new URLSearchParams(query);
    url.search = params.toString();
  }

  return url;
}

function buildGitHubWebUrl(pathname) {
  const url = new URL(pathname, GITHUB_WEB_BASE);
  if (url.origin !== GITHUB_WEB_BASE.origin) {
    throw new Error(`Refusing to build non-GitHub web URL origin: ${url.origin}`);
  }
  return url;
}

function buildTagUrl(owner, repo, tagName) {
  if (!tagName) return null;
  const repoBasePath = buildGitHubRepoBasePath(owner, repo);
  const url = buildGitHubWebUrl(
    `${repoBasePath.replace(/^\/repos/, "")}/releases/tag/${encodeURIComponent(tagName)}`
  );
  return url.toString();
}

function buildCompareUrl(owner, repo, previousTag, tagName) {
  if (!previousTag || !tagName) return null;
  const repoBasePath = buildGitHubRepoBasePath(owner, repo);
  const compareSpec = `${previousTag}...${tagName}`;
  const url = buildGitHubWebUrl(
    `${repoBasePath.replace(/^\/repos/, "")}/compare/${encodeURIComponent(compareSpec)}`
  );
  return url.toString();
}

function formatLinkedCode(text, href) {
  if (!href) return `\`${text}\``;
  return `[\`${text}\`](${href})`;
}

function githubRequest(pathname, { method = "GET", body, query } = {}) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN/GH_TOKEN for GitHub API calls.");
  const url = buildGitHubApiUrl(pathname, query);
  const payload = body ? JSON.stringify(body) : undefined;

  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port ? Number(url.port) : undefined,
        method,
        path: `${url.pathname}${url.search}`,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": GITHUB_USER_AGENT,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (response) => {
        let responseText = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseText += chunk;
        });
        response.on("end", () => {
          const status = response.statusCode || 0;
          if (status < 200 || status >= 300) {
            reject(
              new Error(
                `GitHub API ${method} ${url.pathname}${url.search} failed (${status}): ${responseText}`
              )
            );
            return;
          }

          if (status === 204 || responseText.trim() === "") {
            resolve(null);
            return;
          }

          try {
            resolve(JSON.parse(responseText));
          } catch {
            reject(new Error(`GitHub API ${method} ${url.pathname} returned invalid JSON.`));
          }
        });
      }
    );

    request.on("error", (error) => reject(error));

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

async function generateNotesFallback(owner, repo, tagName, previousTag) {
  if (!previousTag) return "";
  const repoBasePath = buildGitHubRepoBasePath(owner, repo);

  const payload = {
    tag_name: tagName,
    previous_tag_name: previousTag,
  };

  const generated = await githubRequest(`${repoBasePath}/releases/generate-notes`, {
    method: "POST",
    body: payload,
  });
  return extractWhatsChanged(generated?.body || "");
}

async function listPullRequestsForCommit(owner, repo, sha) {
  const repoBasePath = buildGitHubRepoBasePath(owner, repo);
  const normalizedSha = normalizeSha(sha);
  if (!normalizedSha) {
    return [];
  }

  try {
    const pulls = await githubRequest(
      `${repoBasePath}/commits/${encodeURIComponent(normalizedSha)}/pulls`,
      { query: { per_page: "100" } }
    );
    return Array.isArray(pulls) ? pulls : [];
  } catch {
    return [];
  }
}

async function main() {
  for (const name of REQUIRED_ENV) readEnv(name);

  const channel = process.env.CHANNEL.toLowerCase();
  if (!["alpha", "beta", "stable"].includes(channel)) {
    throw new Error(`Unsupported CHANNEL value: ${channel}`);
  }

  const owner = process.env.REPO_OWNER;
  const repo = process.env.REPO_NAME;
  const tagName = process.env.TAG_NAME;
  const version = process.env.VERSION;
  const previousTag = (process.env.PREVIOUS_TAG || "").trim();
  const headline = process.env.CHANNEL_HEADLINE;
  const currentTagLink = buildTagUrl(owner, repo, tagName);
  const previousTagLink = buildTagUrl(owner, repo, previousTag);
  const compareLink = buildCompareUrl(owner, repo, previousTag, tagName);

  const { categories, excludeLabels } = parseReleaseConfig();

  const lines = [];
  lines.push(`## ${headline}`);
  lines.push("");
  lines.push(`_${formatChannelName(channel)} changelog_`);
  lines.push("");
  lines.push(`- Version: ${formatLinkedCode(version, currentTagLink)}`);
  if (previousTag) {
    lines.push(`- Previous ${channel} tag: ${formatLinkedCode(previousTag, previousTagLink)}`);
  } else {
    lines.push(`- Previous ${channel} tag: _none_ (first ${channel} release)`);
  }
  lines.push("");
  if (compareLink) {
    lines.push(
      `### Changes since previous ${channel} ([compare](${compareLink}))`
    );
  } else {
    lines.push(`### Changes since previous ${channel}`);
  }

  if (!previousTag) {
    lines.push(`- No previous ${channel} tag was found, so a same-channel diff is not available yet.`);
    fs.writeFileSync("release-notes.md", `${lines.join("\n")}\n`, "utf8");
    return;
  }

  const range = `${previousTag}..${tagName}`;
  const commits = revList(range);
  const pullRequestMap = new Map();

  for (const sha of commits) {
    const pullRequests = await listPullRequestsForCommit(owner, repo, sha);
    for (const pr of pullRequests) {
      if (!pr?.number) continue;
      if (!pullRequestMap.has(pr.number)) {
        pullRequestMap.set(pr.number, pr);
      }
    }
  }

  const filteredPullRequests = [...pullRequestMap.values()].filter(
    (pr) => !isWrapperPullRequest(pr, excludeLabels)
  );

  filteredPullRequests.sort((a, b) => {
    const aDate = a.merged_at || a.updated_at || a.created_at || "";
    const bDate = b.merged_at || b.updated_at || b.created_at || "";
    if (aDate && bDate && aDate !== bDate) {
      return aDate.localeCompare(bDate);
    }
    return a.number - b.number;
  });

  const grouped = new Map();
  for (const category of categories) grouped.set(category.title, []);
  grouped.set("Other Changes", []);

  for (const pr of filteredPullRequests) {
    const labelSet = new Set((pr.labels || []).map((label) => label.name));
    let categoryTitle = categoryFromLabels(labelSet, categories);

    if (!categoryTitle) {
      const semanticLabel = semanticLabelFromTitle(pr.title || "");
      if (semanticLabel) {
        labelSet.add(semanticLabel);
        categoryTitle = categoryFromLabels(labelSet, categories);
      }
    }

    if (!categoryTitle) categoryTitle = "Other Changes";
    grouped.get(categoryTitle).push(pr);
  }

  let renderedAny = false;
  for (const category of categories) {
    const entries = grouped.get(category.title) || [];
    if (entries.length === 0) continue;

    renderedAny = true;
    lines.push("");
    lines.push(`#### ${category.title}`);
    lines.push("");
    for (const pr of entries) {
      const title = normalizePrTitle(pr.title);
      const login = pr.user?.login || "unknown";
      lines.push(`- ${title} by @${login} in [#${pr.number}](${pr.html_url})`);
    }
  }

  const otherEntries = grouped.get("Other Changes") || [];
  if (otherEntries.length > 0) {
    renderedAny = true;
    lines.push("");
    lines.push("#### Other Changes");
    lines.push("");
    for (const pr of otherEntries) {
      const title = normalizePrTitle(pr.title);
      const login = pr.user?.login || "unknown";
      lines.push(`- ${title} by @${login} in [#${pr.number}](${pr.html_url})`);
    }
  }

  if (!renderedAny) {
    const fallback = await generateNotesFallback(owner, repo, tagName, previousTag);
    if (fallback) {
      lines.push("");
      lines.push(fallback);
    } else {
      lines.push(
        `- No release-note entries were resolved between ${formatLinkedCode(previousTag, previousTagLink)} and ${formatLinkedCode(tagName, currentTagLink)}.`
      );
    }
  }

  fs.writeFileSync("release-notes.md", `${lines.join("\n")}\n`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
