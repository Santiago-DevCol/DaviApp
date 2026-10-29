import { bumpPatch, compareVersions } from './semver';

describe('compareVersions', () => {
  it('orders numerically, not lexicographically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });

  it('treats anything that is not x.y.z as 0.0.0', () => {
    expect(compareVersions('draft', '0.0.0')).toBe(0);
    expect(compareVersions('0.0.1', 'draft')).toBeGreaterThan(0);
    expect(compareVersions('v1.2.3', '1.2.3')).toBeLessThan(0);
  });
});

describe('bumpPatch', () => {
  it('increments the patch component', () => {
    expect(bumpPatch('1.2.3')).toBe('1.2.4');
    expect(bumpPatch('1.2.99')).toBe('1.2.100');
  });

  it('bumps a non-semver version to 0.0.1', () => {
    expect(bumpPatch('draft')).toBe('0.0.1');
    expect(bumpPatch('')).toBe('0.0.1');
  });
});
