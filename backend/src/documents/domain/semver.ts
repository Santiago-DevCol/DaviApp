/**
 * Tolerant semantic-version helpers for ordering document versions.
 *
 * Accepted shape: optional leading `v`/`V`, a core of one to three numeric
 * components (`1` -> 1.0.0, `1.2` -> 1.2.0, `1.2.3`) and an optional
 * prerelease tag (`-beta`, `-rc.1`). A prerelease sorts below the same core
 * release; two prereleases are compared lexically. Anything else is not a
 * version (`parseVersion` returns `null`) and sorts below every parseable one,
 * so a free-text version never breaks the upload flow.
 */
const SEMVER = /^[vV]?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/;

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
}

export function parseVersion(version: string): ParsedVersion | null {
  const match = SEMVER.exec(version.trim());
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
    prerelease: match[4] ?? null,
  };
}

/** Negative when `a < b`, zero when equal, positive when `a > b`. */
export function compareVersions(a: string, b: string): number {
  return compareParsed(parseVersion(a), parseVersion(b));
}

function compareParsed(left: ParsedVersion | null, right: ParsedVersion | null): number {
  if (!left || !right) {
    return Number(left !== null) - Number(right !== null);
  }
  const coreDiff = left.major - right.major || left.minor - right.minor || left.patch - right.patch;
  if (coreDiff !== 0) {
    return coreDiff;
  }
  if (left.prerelease === right.prerelease) {
    return 0;
  }
  if (left.prerelease === null || right.prerelease === null) {
    // A release outranks any prerelease of the same core.
    return left.prerelease === null ? 1 : -1;
  }
  return left.prerelease < right.prerelease ? -1 : 1;
}

/**
 * Next patch after `version`, normalized to `x.y.z`. A prerelease is promoted
 * to its core release (`1.2.3-beta` -> `1.2.3`); an unparsable version counts
 * as `0.0.0` and yields `0.0.1`.
 */
export function bumpPatch(version: string): string {
  const parsed = parseVersion(version);
  if (!parsed) {
    return '0.0.1';
  }
  if (parsed.prerelease !== null) {
    return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  }
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}
