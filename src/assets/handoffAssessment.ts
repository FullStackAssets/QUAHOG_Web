// The described 344-GLB handoff is an external claim. This module only reports
// what the caller actually passed in: a doc, an attached archive, and repo files.

export const INTEGRATION_DOC_NAME = "PRODUCTION-344-ASSET-INTEGRATION.md";

export const INTEGRATION_DOC_CANDIDATES = [
  INTEGRATION_DOC_NAME,
  `docs/${INTEGRATION_DOC_NAME}`,
  `docs/assets/${INTEGRATION_DOC_NAME}`,
  `docs/r3-asset-loader/${INTEGRATION_DOC_NAME}`,
];

export type HandoffStatus = "verified" | "unverified" | "mismatch";

export type HandoffAssessment = {
  describedGlbCount: number | null;
  integrationDocPresent: boolean;
  integrationDocStatedCount: number | null;
  integrationDocCountAmbiguous: boolean;
  archiveAttached: boolean;
  verifiedRepoGlbCount: number;
  repoGlbFiles: string[];
  status: HandoffStatus;
  blockers: string[];
};

export function readIntegrationDocCount(markdown: string): { count: number | null; ambiguous: boolean } {
  const patterns = [
    /(?:^|\n)\s*glb[_\s-]*count\s*[:=]\s*(\d+)/gi,
    /(?:^|\n)\s*meshopt[_\s-]*glb[_\s-]*count\s*[:=]\s*(\d+)/gi,
    /(?:^|\n)\s*model[_\s-]*count\s*[:=]\s*(\d+)/gi,
  ];
  const found = new Set<number>();
  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      found.add(Number(match[1]));
    }
  }
  if (found.size === 1) return { count: [...found][0], ambiguous: false };
  if (found.size > 1) return { count: null, ambiguous: true };
  return { count: null, ambiguous: false };
}

export function assessAssetHandoff(input: {
  describedGlbCount: number | null;
  integrationDocPresent: boolean;
  integrationDocStatedCount: number | null;
  integrationDocCountAmbiguous?: boolean;
  archiveAttached: boolean;
  repoGlbFiles: readonly string[];
}): HandoffAssessment {
  const repoGlbFiles = [...input.repoGlbFiles].sort((a, b) => a.localeCompare(b));
  const blockers: string[] = [];
  const docAmbiguous = input.integrationDocCountAmbiguous === true;

  if (!input.integrationDocPresent) {
    blockers.push(`${INTEGRATION_DOC_NAME} is not in the repo, so no integration count can be read from it`);
  } else if (docAmbiguous) {
    blockers.push(`${INTEGRATION_DOC_NAME} states more than one GLB count`);
  } else if (input.integrationDocStatedCount == null) {
    blockers.push(`${INTEGRATION_DOC_NAME} is present and does not state a glb_count`);
  }

  if (!input.archiveAttached) {
    const described = input.describedGlbCount == null ? "no numeric claim was supplied" : `a described count of ${input.describedGlbCount} was supplied`;
    blockers.push(`No GLB handoff archive is attached (${described}); that count was not checked against archive bytes`);
  }

  let status: HandoffStatus = "unverified";
  const docCount = input.integrationDocStatedCount;
  const canCompare = input.archiveAttached && input.integrationDocPresent && docCount != null && !docAmbiguous;
  if (canCompare) {
    if (docCount === repoGlbFiles.length) status = "verified";
    else {
      status = "mismatch";
      blockers.push(`Integration doc states ${docCount} GLBs; the repo file list has ${repoGlbFiles.length}`);
    }
  }

  return {
    describedGlbCount: input.describedGlbCount,
    integrationDocPresent: input.integrationDocPresent,
    integrationDocStatedCount: docAmbiguous ? null : docCount,
    integrationDocCountAmbiguous: docAmbiguous,
    archiveAttached: input.archiveAttached,
    verifiedRepoGlbCount: repoGlbFiles.length,
    repoGlbFiles,
    status,
    blockers,
  };
}
