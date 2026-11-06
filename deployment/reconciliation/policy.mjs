// Flags that would weaken a failed reconciliation or publish an environment.
// The CLI rejects the whole invocation before it reads the tree.

export const FORBIDDEN_FLAGS = [
  "--waive",
  "--update-hashes",
  "--rewrite-hashes",
  "--force",
  "--attest",
  "--staging",
  "--create-staging",
  "--deploy",
  "--prod",
];

const VALUE_FLAGS = new Set(["--out", "--repo", "--build-evidence", "--live-evidence"]);

export const ALLOWED_FLAGS = new Set([
  "--help",
  "--execute-build",
  ...VALUE_FLAGS,
]);

export function parseArgs(argv) {
  const forbidden = [];
  const unknown = [];
  const values = {};
  const positionals = [];
  let help = false;
  let executeBuild = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const bare = arg.split("=", 1)[0];
    if (FORBIDDEN_FLAGS.includes(bare) || bare.startsWith("--waive") || bare.startsWith("--staging")) {
      forbidden.push(arg);
      continue;
    }
    if (!ALLOWED_FLAGS.has(bare)) {
      unknown.push(arg);
      continue;
    }
    if (bare === "--help") {
      help = true;
      continue;
    }
    if (bare === "--execute-build") {
      executeBuild = true;
      continue;
    }
    const inline = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : null;
    const value = inline ?? argv[++i];
    if (!value || value.startsWith("--")) {
      unknown.push(arg);
      continue;
    }
    values[bare] = value;
  }

  const refused = forbidden.length > 0 || unknown.length > 0 || positionals.length > 0;
  return { refused, forbidden, unknown, positionals, help, executeBuild, values };
}
