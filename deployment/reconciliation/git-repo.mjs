import { spawnSync } from "node:child_process";

function run(cwd, args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

export function createGit(cwd) {
  return {
    revParse(rev) {
      const result = run(cwd, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
      const sha = (result.stdout || "").trim();
      if (result.status !== 0 || !/^[0-9a-f]{40}$/.test(sha)) return { ok: false, sha: null };
      return { ok: true, sha };
    },
    isAncestor(ancestor, subject) {
      return run(cwd, ["merge-base", "--is-ancestor", ancestor, subject]).status === 0;
    },
    head() {
      return this.revParse("HEAD");
    },
    currentBranch() {
      const result = run(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
      return (result.stdout || "").trim();
    },
    diffNames(from, to) {
      const result = run(cwd, ["diff", "--name-only", from, to]);
      if (result.status !== 0) return { ok: false, paths: [] };
      return { ok: true, paths: (result.stdout || "").split("\n").filter(Boolean) };
    },
    dirtyPaths() {
      const result = run(cwd, ["status", "--porcelain", "-uall"]);
      if (result.status !== 0) return { ok: false, paths: [] };
      const paths = (result.stdout || "")
        .split("\n")
        .filter(Boolean)
        .map((line) => line.slice(3).replace(/^.* -> /, ""));
      return { ok: true, paths };
    },
  };
}
