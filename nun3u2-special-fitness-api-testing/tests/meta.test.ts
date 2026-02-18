import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const REPO = path.join(ROOT, 'repository_after');
const TESTS_DIR = path.join(REPO, 'tests');
const DATA_FILE = path.join(REPO, 'data.json');
const FIXTURE_FILE = path.join(REPO, 'test-fixtures', 'baseline-data.json');
const TEST_FILE = path.join(TESTS_DIR, 'fitness-api.test.ts');
const APP_FILE = path.join(REPO, 'app.ts');

function runTests(): { code: number; output: string } {
  try {
    const output = execSync(
      'npx jest --config jest.config.ts --verbose --forceExit 2>&1',
      { cwd: REPO, encoding: 'utf-8', timeout: 120000 },
    );
    return { code: 0, output };
  } catch (err: any) {
    return { code: err.status ?? 1, output: err.stdout ?? '' };
  }
}

// ─── Meta-test: Primary tests are discoverable ───────────────────
describe('Meta: Primary test discoverability', () => {
  it('should have test files in repository_after/tests/', () => {
    expect(fs.existsSync(TESTS_DIR)).toBe(true);
    const files = fs.readdirSync(TESTS_DIR).filter(f => f.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(0);
  });

  it('should have fixture data file', () => {
    expect(fs.existsSync(FIXTURE_FILE)).toBe(true);
  });

  it('should have jest config', () => {
    expect(fs.existsSync(path.join(REPO, 'jest.config.ts'))).toBe(true);
  });
});

// ─── Meta-test: Required test cases present ──────────────────────
describe('Meta: Required test cases present', () => {
  let testContent: string;

  beforeAll(() => {
    testContent = fs.readFileSync(TEST_FILE, 'utf-8');
  });

  it('should contain streak-reset test (gap day resets streak)', () => {
    expect(testContent).toMatch(/reset|gap|miss|interrupt/i);
    expect(testContent).toMatch(/currentStreak[\s\S]*?\.toBe\(1\)/);
  });

  it('should contain badge award tests including count-based badges', () => {
    expect(testContent).toMatch(/First Workout/);
    expect(testContent).toMatch(/Centurion/);
    expect(testContent).toMatch(/Week Warrior/);
    expect(testContent).toMatch(/200 Club/);
  });

  it('should contain date edge case tests with clock mocking', () => {
    expect(testContent).toMatch(/useFakeTimers|setSystemTime|fakeTimers/);
    expect(testContent).toMatch(/midnight/i);
    expect(testContent).toMatch(/DST|daylight|timezone/i);
  });

  it('should contain badge evaluation triggered by /complete', () => {
    expect(testContent).toMatch(/trigger.*badge|badge.*evaluation[\s\S]*?complet/i);
  });

  it('should contain meaningful error message validation', () => {
    // Tests must validate diagnostic content, not just non-empty strings
    expect(testContent).toMatch(/error[\s\S]*?toMatch|error[\s\S]*?toContain/i);
    expect(testContent).toMatch(/diagnos|meaningful|required|not found/i);
  });

  it('should contain specific required it()/describe() blocks for each endpoint', () => {
    // Verify specific test case names exist, not just keywords
    expect(testContent).toMatch(/it\(['"].*404.*non-existent.*user/i);
    expect(testContent).toMatch(/it\(['"].*409.*duplicate.*email/i);
    expect(testContent).toMatch(/it\(['"].*activeOnly/i);
    expect(testContent).toMatch(/it\(['"].*filter.*userId/i);
    expect(testContent).toMatch(/it\(['"].*sort.*asc/i);
    expect(testContent).toMatch(/it\(['"].*409.*already.*completed/i);
    expect(testContent).toMatch(/it\(['"].*personal.*record/i);
    expect(testContent).toMatch(/it\(['"].*equipment.*user.*does not have|exclude.*equipment/i);
    expect(testContent).toMatch(/it\(['"].*deprioritize.*recently/i);
    expect(testContent).toMatch(/it\(['"].*difficulty.*fitness.*level|filter.*difficulty/i);
  });

  it('should contain describe blocks organized by requirement/feature domain', () => {
    expect(testContent).toMatch(/describe\(['"].*GET \/users/i);
    expect(testContent).toMatch(/describe\(['"].*POST \/users/i);
    expect(testContent).toMatch(/describe\(['"].*GET \/workouts/i);
    expect(testContent).toMatch(/describe\(['"].*POST \/workouts/i);
    expect(testContent).toMatch(/describe\(['"].*Streak/i);
    expect(testContent).toMatch(/describe\(['"].*Badge/i);
    expect(testContent).toMatch(/describe\(['"].*\/complete/i);
    expect(testContent).toMatch(/describe\(['"].*recommendation/i);
    expect(testContent).toMatch(/describe\(['"].*Date/i);
  });
});

// ─── Meta-test: Assertion strength ──────────────────────────────
describe('Meta: Assertion strength', () => {
  let testContent: string;

  beforeAll(() => {
    testContent = fs.readFileSync(TEST_FILE, 'utf-8');
  });

  it('should contain non-trivial value assertions (not just shape checks)', () => {
    const toBeCalls = (testContent.match(/\.toBe\(/g) || []).length;
    const toEqualCalls = (testContent.match(/\.toEqual\(/g) || []).length;
    const toMatchCalls = (testContent.match(/\.toMatch\(/g) || []).length;
    const valueAssertions = toBeCalls + toEqualCalls + toMatchCalls;
    // Must have substantial value assertions, not just toHaveProperty
    expect(valueAssertions).toBeGreaterThan(30);
  });

  it('should not be trivially passing (no expect(true).toBe(true) pattern)', () => {
    const trivialPattern = /expect\(true\)\.toBe\(true\)/g;
    const matches = testContent.match(trivialPattern) || [];
    expect(matches.length).toBe(0);
  });

  it('should contain assertions on specific fixture values', () => {
    // Tests must reference known fixture data, not just generic checks
    expect(testContent).toMatch(/Alex Thompson/);
    expect(testContent).toMatch(/Taylor Chen/);
    expect(testContent).toMatch(/alex@example\.com/);
  });

  it('should assert specific numeric values from fixture data, not just types', () => {
    // Verify that tests check actual expected values (e.g., currentStreak 5, longestStreak 14)
    // A test using typeof checks instead of .toBe(5) would fail this
    expect(testContent).toMatch(/currentStreak[\s\S]*?\.toBe\(5\)/);
    expect(testContent).toMatch(/longestStreak[\s\S]*?\.toBe\(14\)/);
    expect(testContent).toMatch(/totalWorkouts[\s\S]*?\.toBe\(47\)/);
    // Badge count for u1 = 2 (First Workout + Week Warrior)
    expect(testContent).toMatch(/badges\.length[\s\S]*?\.toBe\(2\)/);
  });

  it('should have value assertions tied to API responses, not standalone expect(N).toBe(N)', () => {
    // Ensure assertions reference res.body or user response objects, not detached values
    const standaloneAssertions = testContent.match(/expect\(\d+\)\.toBe\(\d+\)/g) || [];
    expect(standaloneAssertions.length).toBe(0);
  });

  it('should verify inactive users are excluded by activeOnly filter (not just presence of active ones)', () => {
    // Test must assert specific users are NOT in the response
    expect(testContent).toMatch(/not\.toContain\(['"]u[234]['"]\)|returnedIds[\s\S]*?not.*toContain/i);
  });
});

// ─── Meta-test: Clean run ────────────────────────────────────────
describe('Meta: Clean run (correct implementation)', () => {
  it('should execute primary tests with all passing', () => {
    const { code, output } = runTests();
    expect(output).toContain('PASS');
    expect(output).not.toMatch(/FAIL\s/);
    expect(code).toBe(0);
  });

  it('should not skip any tests', () => {
    const { output } = runTests();
    const skippedMatch = output.match(/(\d+) skipped/);
    if (skippedMatch) {
      expect(parseInt(skippedMatch[1], 10)).toBe(0);
    }
  });
});

// ─── Meta-test: Data isolation ───────────────────────────────────
describe('Meta: Data isolation', () => {
  it('should restore data.json after test run', () => {
    const before = fs.readFileSync(DATA_FILE, 'utf-8');
    runTests();
    const after = fs.readFileSync(DATA_FILE, 'utf-8');
    expect(JSON.parse(after)).toEqual(JSON.parse(before));
  });
});

// ─── Meta-test: Test file deletion causes failure ────────────────
describe('Meta: Test file deletion', () => {
  let originalTestContent: string;

  beforeEach(() => {
    originalTestContent = fs.readFileSync(TEST_FILE, 'utf-8');
  });

  afterEach(() => {
    fs.writeFileSync(TEST_FILE, originalTestContent);
    // Restore data too
    const fixture = fs.readFileSync(FIXTURE_FILE, 'utf-8');
    fs.writeFileSync(DATA_FILE, fixture);
  });

  it('should fail when the test file is deleted', () => {
    fs.unlinkSync(TEST_FILE);
    const { code, output } = runTests();
    // Jest should fail: either no tests found or error
    expect(code).not.toBe(0);
    // Restore for cleanup
    fs.writeFileSync(TEST_FILE, originalTestContent);
  });
});

// ─── Meta-test: Mutation run ─────────────────────────────────────
describe('Meta: Mutation run (broken implementation)', () => {
  let originalApp: string;

  beforeEach(() => {
    originalApp = fs.readFileSync(APP_FILE, 'utf-8');
  });

  afterEach(() => {
    fs.writeFileSync(APP_FILE, originalApp);
    // Restore data too
    const fixture = fs.readFileSync(FIXTURE_FILE, 'utf-8');
    fs.writeFileSync(DATA_FILE, fixture);
  });

  it('should detect when email validation is removed (validation bypass)', () => {
    const mutated = originalApp.replace(
      /if \(!emailRegex\.test\(email\)\)[\s\S]*?return res\.status\(400\)\.json\(\{ error: 'Invalid email format' \}\);[\s\n]*\}/,
      '/* validation removed */',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when 404 for non-existent user is removed (deleted branch)', () => {
    const mutated = originalApp.replace(
      /if \(!user\) \{\s*return res\.status\(404\)\.json\(\{ error: 'User not found' \}\);\s*\}/,
      '/* 404 removed */',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when workout completion guard is removed (always-true)', () => {
    const mutated = originalApp.replace(
      /if \(workout\.completedAt\) \{\s*return res\.status\(409\)\.json\(\{ error: 'Workout already completed' \}\);\s*\}/,
      '/* always allow re-completion */',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when calculateStreak is stubbed to always return 999', () => {
    const mutated = originalApp.replace(
      'return { current: currentStreak, longest: maxStreak };',
      'return { current: 999, longest: 999 };',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when evaluateBadges awards no new badges', () => {
    const mutated = originalApp.replace(
      'for (const badge of data.availableBadges) {',
      'for (const badge of ([] as any[])) {',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when recommendation equipment filtering is bypassed', () => {
    const mutated = originalApp.replace(
      'return exercise.equipment.every(eq => user.equipment.includes(eq));',
      'return true;',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when totalWorkouts increment is removed from /complete', () => {
    const mutated = originalApp.replace(
      'user.totalWorkouts++;',
      '/* totalWorkouts increment removed */',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when personal records update is removed from /complete', () => {
    const mutated = originalApp.replace(
      /\/\/ Update personal records[\s\S]*?if \(exercise\.weight > currentPR\) \{\s*user\.personalRecords\[exercise\.name\] = exercise\.weight;\s*\}\s*\}/,
      '/* personal records update removed */',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when difficulty filtering is removed from recommendations', () => {
    const mutated = originalApp.replace(
      'return exLevel <= userLevel;',
      'return true;',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when recency deprioritization is removed from recommendations', () => {
    const mutated = originalApp.replace(
      /recommendations\.sort\(\(a, b\) => \{[\s\S]*?return aRecent - bRecent;\s*\}\);/,
      '/* recency sort removed */',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when activeOnly query parameter filtering is removed', () => {
    const mutated = originalApp.replace(
      /if \(req\.query\.activeOnly === 'true'\) \{[\s\S]*?users = users\.filter[\s\S]*?\);\s*\}/,
      '/* activeOnly filter removed */',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when dateFrom filter is removed from GET /workouts', () => {
    const mutated = originalApp.replace(
      /if \(req\.query\.dateFrom\) \{[^}]+\}/,
      '/* dateFrom filter removed */',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when dateTo filter is removed from GET /workouts', () => {
    const mutated = originalApp.replace(
      /if \(req\.query\.dateTo\) \{[^}]+\}/,
      '/* dateTo filter removed */',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when exerciseType filter is removed from GET /workouts', () => {
    // Replace the exerciseType filter condition with a no-op
    const mutated = originalApp.replace(
      "if (req.query.exerciseType) {",
      "if (false && req.query.exerciseType) {",
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when workout sort order is broken', () => {
    const mutated = originalApp.replace(
      "const sortOrder = req.query.order === 'asc' ? 1 : -1;",
      'const sortOrder = 1; /* always ascending */',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when exercises validation is removed from POST /workouts', () => {
    const mutated = originalApp.replace(
      /if \(!exercises[^\n]+\n[^\n]+Exercises array is required[^\n]+\n\s+\}/,
      '/* exercises validation removed */',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });

  it('should detect when duplicate email check is removed', () => {
    const mutated = originalApp.replace(
      /if \(data\.users\.some[^\n]+\n[^\n]+Email already exists[^\n]+\n\s+\}/,
      '/* duplicate check removed */',
    );
    expect(mutated).not.toEqual(originalApp);
    fs.writeFileSync(APP_FILE, mutated);
    const { code } = runTests();
    expect(code).not.toBe(0);
  });
});
