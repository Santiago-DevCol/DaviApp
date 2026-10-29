import { bumpPatch, compareVersions, parseVersion } from './semver';

describe('parseVersion', () => {
  it('parses a full core with an optional leading v', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: null });
    expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: null });
    expect(parseVersion(' V10.0.1 ')).toEqual({ major: 10, minor: 0, patch: 1, prerelease: null });
  });

  it('completes a partial core with zeros', () => {
    expect(parseVersion('1.2')).toEqual({ major: 1, minor: 2, patch: 0, prerelease: null });
    expect(parseVersion('3')).toEqual({ major: 3, minor: 0, patch: 0, prerelease: null });
  });

  it('keeps the prerelease tag', () => {
    expect(parseVersion('1.0.0-beta')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: 'beta' });
    expect(parseVersion('v2.1-rc.1')).toEqual({ major: 2, minor: 1, patch: 0, prerelease: 'rc.1' });
  });

  it('returns null for anything else', () => {
    expect(parseVersion('draft')).toBeNull();
    expect(parseVersion('')).toBeNull();
    expect(parseVersion('1.2.3.4')).toBeNull();
    expect(parseVersion('1.x')).toBeNull();
    expect(parseVersion('1.0.0-')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('orders numerically, not lexicographically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });

  it('ignores the leading v and completes partial cores', () => {
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('2', '1.9.9')).toBeGreaterThan(0);
  });

  it('sorts a prerelease below the same core release and prereleases lexically', () => {
    expect(compareVersions('1.0.0-beta', '1.0.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '1.0.0-beta')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
    expect(compareVersions('1.0.0-beta', '1.0.0-beta')).toBe(0);
    expect(compareVersions('1.0.1-alpha', '1.0.0')).toBeGreaterThan(0);
  });

  it('treats an unparsable version as lower than everything', () => {
    expect(compareVersions('draft', '0.0.0')).toBeLessThan(0);
    expect(compareVersions('0.0.1', 'draft')).toBeGreaterThan(0);
    expect(compareVersions('draft', 'final')).toBe(0);
  });
});

describe('bumpPatch', () => {
  it('increments the patch component and normalizes the output', () => {
    expect(bumpPatch('1.2.3')).toBe('1.2.4');
    expect(bumpPatch('1.2.99')).toBe('1.2.100');
    expect(bumpPatch('v1.2.3')).toBe('1.2.4');
    expect(bumpPatch('1.2')).toBe('1.2.1');
  });

  it('drops the prerelease without bumping the core', () => {
    expect(bumpPatch('1.2.3-beta')).toBe('1.2.3');
  });

  it('bumps an unparsable version to 0.0.1', () => {
    expect(bumpPatch('draft')).toBe('0.0.1');
    expect(bumpPatch('')).toBe('0.0.1');
  });
});
