export function verifyLiveProduction(evidence) {
  if (!evidence) {
    return {
      ok: false,
      summary: "Live production was not read. This tool does not fetch production.",
      evidence: { fetchedProductionBody: false },
    };
  }
  const deployment = Array.isArray(evidence.deployments) ? evidence.deployments[0] : null;
  const productionHttp = evidence.kind === "production-http"
    && evidence.environment === "production"
    && evidence.fetchedProductionBody === true;
  if (!productionHttp) {
    return {
      ok: false,
      summary: "Supplied evidence is not a fetched production response and is not reconciled as production.",
      evidence: {
        kind: evidence.kind ?? null,
        environment: evidence.environment ?? null,
        fetchedProductionBody: evidence.fetchedProductionBody === true,
        pagesBranch: evidence.pages?.source?.branch ?? null,
        pagesUrl: evidence.pages?.html_url ?? null,
        deploymentEnvironment: deployment?.environment ?? null,
        deploymentSha: deployment?.sha ?? null,
        deploymentRef: deployment?.ref ?? null,
        productionEnvironmentFlag: deployment?.production_environment ?? null,
      },
    };
  }
  const failures = [];
  if (evidence.subjectShaMatch !== true) failures.push("production response does not match the subject commit");
  if (typeof evidence.bodySha256 !== "string" || !/^[a-f0-9]{64}$/.test(evidence.bodySha256)) {
    failures.push("production body sha256 is missing");
  }
  return {
    ok: failures.length === 0,
    summary: failures.length === 0 ? "Fetched production body matches the subject commit." : failures.join("; "),
    evidence: { bodySha256: evidence.bodySha256 ?? null, subjectShaMatch: evidence.subjectShaMatch === true },
  };
}

export function verifyProductionBranch({ branch, subjectSha, mainSha, mainIsAncestor }) {
  const stagingName = /staging|preview/i.test(branch || "");
  const descendsFailures = [];
  if (!mainSha) descendsFailures.push("main does not resolve");
  if (!mainIsAncestor) descendsFailures.push("subject does not contain main as an ancestor");
  if (stagingName) descendsFailures.push(`branch ${branch} is not a production branch`);
  const onMain = branch === "main" && Boolean(mainSha) && subjectSha === mainSha && !stagingName;
  const tipFailures = [];
  if (stagingName) tipFailures.push(`branch ${branch} is not a production branch`);
  if (branch !== "main") tipFailures.push(`checked out branch ${branch || "(unknown)"} is not main`);
  else if (!mainSha || subjectSha !== mainSha) tipFailures.push("HEAD is not the tip of main");
  return {
    descends: {
      ok: descendsFailures.length === 0,
      failures: descendsFailures,
    },
    tip: {
      ok: onMain,
      failures: onMain ? [] : tipFailures,
    },
  };
}
