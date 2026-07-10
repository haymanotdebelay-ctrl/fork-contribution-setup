// Trusted reporting logic for the "Report bundle size" workflow.
//
// This module is only ever imported by bundle-size-report.yml, which runs under
// the `workflow_run` trigger in the BASE repository's context. That means:
//   * it is loaded from the base repo's default branch (trusted code), never
//     from the artifact produced by the PR build, and
//   * its GITHUB_TOKEN keeps `statuses: write` even when the triggering run came
//     from a fork PR.
//
// The measurement JSON it reads is untrusted DATA. Its values only ever flow
// into numeric formatting (formatKB/formatDiff) — never into execution or into
// the status target (owner/repo/sha/target_url all come from the trusted
// workflow_run event).

import { readFileSync } from 'node:fs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function formatKB(bytes) {
  return (bytes / 1024).toFixed(2);
}

// Renders "<current> KB (<+/-diff> KB)" for a single measurement vs. the base.
function formatDiff(current, base) {
  const diff = current - base;
  const sign = diff >= 0 ? '+' : '';
  return `${formatKB(current)} KB (${sign}${formatKB(
    diff,
  )} KB)`;
}

function getStatusMetadata(context, sha, targetUrl) {
  return {
    owner: context.repo.owner,
    repo: context.repo.repo,
    sha,
    context: 'Bundle size',
    target_url: targetUrl,
  };
}

// Entry point for the "Report bundle size" workflow. Posts a commit status on
// `sha` (the trusted workflow_run head SHA). On a non-success run it reports an
// error without touching the artifact. On success it reads the measurement
// data, whose values only ever flow into numeric formatting, never execution.
export async function reportBundleSize({ github, context, sha, dataDir, conclusion, targetUrl }) {
  const metadata = getStatusMetadata(context, sha, targetUrl);

  if (conclusion !== 'success') {
    await github.rest.repos.createCommitStatus({
      ...metadata,
      state: 'error',
      description: 'The workflow encountered an error.',
    });
    return;
  }

  const basebranch = readJson(`${dataDir}/output-basebranch.json`);
  const pr = readJson(`${dataDir}/output.json`);

  console.log('Base branch:', basebranch);
  console.log('This PR:', pr);

  await github.rest.repos.createCommitStatus({
    ...metadata,
    state: 'success',
    description: [
      `gzip: ${formatDiff(pr.compressedSize, basebranch.compressedSize)}`,
      `raw: ${formatDiff(pr.uncompressedSize, basebranch.uncompressedSize)}`,
    ].join(', '),
  });
}
