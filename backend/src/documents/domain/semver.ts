/**
 * Minimal semantic-version helpers for ordering document versions. Only the
 * `MAJOR.MINOR.PATCH` core is understood; anything else is treated as `0.0.0`
 * so a free-text version never breaks the upload flow.
 */
const SEMVER_CORE = /^(\d+)\.(\d+)\.(\d+)$/;

type VersionTuple = [number, number, number];

function parse(version: string): VersionTuple {
  const match = SEMVER_CORE.exec(version.trim());
  if (!match) {
    return [0, 0, 0];
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Negative when `a < b`, zero when equal, positive when `a > b`. */
export function compareVersions(a: string, b: string): number {
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) {
      return left[i] - right[i];
    }
  }
  return 0;
}

export function bumpPatch(version: string): string {
  const [major, minor, patch] = parse(version);
  return `${major}.${minor}.${patch + 1}`;
}
