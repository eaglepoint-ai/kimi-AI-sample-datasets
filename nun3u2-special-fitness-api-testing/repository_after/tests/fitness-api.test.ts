import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../app';

const DATA_FILE = path.join(__dirname, '..', 'data.json');
const FIXTURE_FILE = path.join(__dirname, '..', 'test-fixtures', 'baseline-data.json');

let originalData: string;

interface User {
  id: string;
  name: string;
  email: string;
  equipment: string[];
  fitnessLevel: string;
  currentStreak: number;
  longestStreak: number;
  totalWorkouts: number;
  lastWorkoutDate?: string;
  badges: Badge[];
  personalRecords: Record<string, number>;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  earnedAt?: string;
  criteria: { type: string; threshold: number; exerciseType?: string };
  earned?: boolean;
  progress?: number;
}

interface Workout {
  id: string;
  userId: string;
  date: string;
  exercises: { name: string; sets: number; reps: number; weight?: number; equipment?: string[] }[];
  completedAt?: string;
  duration?: number;
  userName?: string;
}

interface ExerciseRec {
  name: string;
  equipment: string[];
  muscles: string[];
  difficulty: string;
}

function resetData(): void {
  const fixture = fs.readFileSync(FIXTURE_FILE, 'utf-8');
  fs.writeFileSync(DATA_FILE, fixture);
}

beforeAll(() => {
  originalData = fs.readFileSync(DATA_FILE, 'utf-8');
});

beforeEach(() => {
  resetData();
});

afterAll(() => {
  fs.writeFileSync(DATA_FILE, originalData);
});

// ─── Req 1 & 2: Setup & Fixtures ──────────────────────────────────
describe('Test setup (Req 1 & 2)', () => {
  it('should use supertest without starting a server', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
  });

  it('should reset data.json before each test to fixture state', () => {
    const current = fs.readFileSync(DATA_FILE, 'utf-8');
    const fixture = fs.readFileSync(FIXTURE_FILE, 'utf-8');
    expect(current).toEqual(fixture);
  });
});

// ─── Req 3: GET /users ────────────────────────────────────────────
describe('GET /users (Req 3)', () => {
  it('should return all users with correct structure and values', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(4);
    // Assert specific fixture values, not just shape
    const alex = (res.body as User[]).find(u => u.id === 'u1');
    expect(alex).toBeDefined();
    expect(alex!.name).toBe('Alex Thompson');
    expect(alex!.email).toBe('alex@example.com');
    expect(alex!.currentStreak).toBe(5);
    expect(alex!.totalWorkouts).toBe(47);
    expect(alex!.fitnessLevel).toBe('intermediate');
    const taylor = (res.body as User[]).find(u => u.id === 'u4');
    expect(taylor).toBeDefined();
    expect(taylor!.name).toBe('Taylor Chen');
    expect(taylor!.totalWorkouts).toBe(0);
    expect(taylor!.badges).toEqual([]);
    for (const user of res.body as User[]) {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('currentStreak');
      expect(user).toHaveProperty('longestStreak');
      expect(user).toHaveProperty('totalWorkouts');
      expect(user).toHaveProperty('badges');
      expect(Array.isArray(user.badges)).toBe(true);
    }
  });

  it('should filter active users with activeOnly=true and exclude inactive users', async () => {
    // Fixture lastWorkoutDate is far in the past (2024), so with real Date.now() all are inactive
    // We update only u1 to have a recent workout, leaving others inactive
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const today = new Date().toISOString().split('T')[0];
    data.users[0].lastWorkoutDate = today; // u1 = active
    // u2 lastWorkoutDate = 2023-12-20 (inactive), u3 = 2024-01-16 (inactive), u4 = undefined (inactive)
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    const res = await request(app).get('/users?activeOnly=true');
    expect(res.status).toBe(200);
    // Only u1 should be returned (the only active user)
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe('u1');
    // Verify inactive users are NOT in the response
    const returnedIds = (res.body as User[]).map(u => u.id);
    expect(returnedIds).not.toContain('u2');
    expect(returnedIds).not.toContain('u3');
    expect(returnedIds).not.toContain('u4');
    for (const u of res.body as User[]) {
      expect(u.lastWorkoutDate).toBeDefined();
    }
  });

  it('should return all users when activeOnly is not set', async () => {
    const res = await request(app).get('/users');
    expect(res.body.length).toBe(4);
  });
});

// ─── Req 4: GET /users/:id ──────────────────────────────────────
describe('GET /users/:id (Req 4)', () => {
  it('should return a specific user with all fields and correct computed values', async () => {
    const res = await request(app).get('/users/u1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('u1');
    expect(res.body.name).toBe('Alex Thompson');
    expect(res.body.email).toBe('alex@example.com');
    expect(res.body.fitnessLevel).toBe('intermediate');
    // Assert computed field VALUES, not just types (Req 4: "computed fields like currentStreak and badge count")
    expect(res.body.currentStreak).toBe(5);
    expect(res.body.longestStreak).toBe(14);
    expect(res.body.totalWorkouts).toBe(47);
    expect(Array.isArray(res.body.badges)).toBe(true);
    expect(res.body.badges.length).toBe(2); // First Workout + Week Warrior in fixture
    expect(res.body.badges.map((b: Badge) => b.name).sort()).toEqual(['First Workout', 'Week Warrior']);
  });

  it('should return correct computed fields for a different user', async () => {
    const res = await request(app).get('/users/u3');
    expect(res.status).toBe(200);
    expect(res.body.currentStreak).toBe(12);
    expect(res.body.longestStreak).toBe(30);
    expect(res.body.totalWorkouts).toBe(156);
    expect(res.body.badges.length).toBe(5);
  });

  it('should return 404 for non-existent user', async () => {
    const res = await request(app).get('/users/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── Req 5: POST /users ──────────────────────────────────────────
describe('POST /users (Req 5)', () => {
  it('should create a user with valid data and return 201', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Test User', email: 'testuser@example.com', fitnessLevel: 'beginner' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test User');
    expect(res.body.email).toBe('testuser@example.com');
    expect(res.body.totalWorkouts).toBe(0);
    expect(res.body.badges).toEqual([]);
  });

  it('should auto-generate a unique ID', async () => {
    const r1 = await request(app).post('/users').send({ name: 'A', email: 'a@b.com' });
    resetData();
    const r2 = await request(app).post('/users').send({ name: 'B', email: 'b@b.com' });
    expect(r1.body.id).toBeDefined();
    expect(r2.body.id).toBeDefined();
    expect(r1.body.id).not.toEqual(r2.body.id);
  });

  it('should return 400 when name is missing', async () => {
    const res = await request(app).post('/users').send({ email: 'x@y.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('should return 400 when email is missing', async () => {
    const res = await request(app).post('/users').send({ name: 'NoEmail' });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid email format', async () => {
    const res = await request(app).post('/users').send({ name: 'Bad', email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('should return 409 for duplicate email', async () => {
    const res = await request(app).post('/users').send({ name: 'Dup', email: 'alex@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/exists/i);
  });
});

// ─── Req 6: GET /workouts ─────────────────────────────────────────
describe('GET /workouts (Req 6)', () => {
  it('should return all workouts with user info and correct values', async () => {
    const res = await request(app).get('/workouts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(8);
    // Assert specific workout values, not just shape
    const w1 = (res.body as Workout[]).find(w => w.id === 'w1');
    expect(w1).toBeDefined();
    expect(w1!.userId).toBe('u1');
    expect(w1!.userName).toBe('Alex Thompson');
    expect(w1!.exercises.length).toBe(3);
    expect(w1!.exercises[0].name).toBe('Bench Press');
    expect(w1!.completedAt).toBe('2024-01-15T09:15:00Z');
    const w4 = (res.body as Workout[]).find(w => w.id === 'w4');
    expect(w4).toBeDefined();
    expect(w4!.userId).toBe('u2');
    expect(w4!.userName).toBe('Jordan Martinez');
    for (const w of res.body as Workout[]) {
      expect(w).toHaveProperty('id');
      expect(w).toHaveProperty('userId');
      expect(w).toHaveProperty('exercises');
      expect(w).toHaveProperty('userName');
    }
  });

  it('should filter by userId', async () => {
    const res = await request(app).get('/workouts?userId=u1');
    expect(res.status).toBe(200);
    for (const w of res.body as Workout[]) {
      expect(w.userId).toBe('u1');
    }
  });

  it('should filter by dateFrom', async () => {
    const res = await request(app).get('/workouts?dateFrom=2024-01-14');
    expect(res.status).toBe(200);
    for (const w of res.body as Workout[]) {
      expect(new Date(w.date).getTime()).toBeGreaterThanOrEqual(new Date('2024-01-14').getTime());
    }
  });

  it('should filter by dateTo', async () => {
    const res = await request(app).get('/workouts?dateTo=2024-01-14');
    expect(res.status).toBe(200);
    for (const w of res.body as Workout[]) {
      expect(new Date(w.date).getTime()).toBeLessThanOrEqual(new Date('2024-01-14').getTime());
    }
  });

  it('should filter by exerciseType', async () => {
    const res = await request(app).get('/workouts?exerciseType=Bench Press');
    expect(res.status).toBe(200);
    for (const w of res.body as Workout[]) {
      const names = w.exercises.map(e => e.name.toLowerCase());
      expect(names).toContain('bench press');
    }
  });

  it('should sort ascending by date', async () => {
    const res = await request(app).get('/workouts?order=asc');
    const dates = (res.body as Workout[]).map(w => new Date(w.date).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
    }
  });

  it('should sort descending by date (default)', async () => {
    const res = await request(app).get('/workouts');
    const dates = (res.body as Workout[]).map(w => new Date(w.date).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
    }
  });
});

// ─── Req 7: POST /workouts ───────────────────────────────────────

describe('POST /workouts (Req 7)', () => {
  it('should create a workout and return 201', async () => {
    const res = await request(app).post('/workouts').send({
      userId: 'u1',
      date: '2024-02-01T08:00:00Z',
      exercises: [{ name: 'Push-ups', sets: 3, reps: 15 }],
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.userId).toBe('u1');
  });

  it('should return 404 for non-existent userId', async () => {
    const res = await request(app).post('/workouts').send({
      userId: 'missing',
      exercises: [{ name: 'Push-ups', sets: 3, reps: 15 }],
    });
    expect(res.status).toBe(404);
  });

  it('should return 400 when exercises array is missing', async () => {
    const res = await request(app).post('/workouts').send({ userId: 'u1' });
    expect(res.status).toBe(400);
  });

  it('should return 400 when exercises array is empty', async () => {
    const res = await request(app).post('/workouts').send({ userId: 'u1', exercises: [] });
    expect(res.status).toBe(400);
  });

  it('should return 400 for exercise missing required fields', async () => {
    const res = await request(app).post('/workouts').send({
      userId: 'u1',
      exercises: [{ name: 'Push-ups' }], // missing sets & reps
    });
    expect(res.status).toBe(400);
  });

  it('should NOT update totalWorkouts immediately after POST /workouts (only after /complete)', async () => {
    const before = await request(app).get('/users/u4');
    const wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: new Date().toISOString(),
      exercises: [{ name: 'Push-ups', sets: 3, reps: 15 }],
    });
    expect(wr.status).toBe(201);
    // Verify totalWorkouts is NOT incremented yet (only happens on /complete)
    const afterPost = await request(app).get('/users/u4');
    expect(afterPost.body.totalWorkouts).toBe(before.body.totalWorkouts);
    
    // Now complete the workout and verify the increment
    await request(app).post(`/workouts/${wr.body.id}/complete`);
    const afterComplete = await request(app).get('/users/u4');
    expect(afterComplete.body.totalWorkouts).toBe(before.body.totalWorkouts + 1);
  });

  it('should NOT trigger streak recalculation after POST /workouts (only after /complete)', async () => {
    const before = await request(app).get('/users/u4');
    expect(before.body.currentStreak).toBe(0);
    const wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: new Date().toISOString(),
      exercises: [{ name: 'Push-ups', sets: 3, reps: 15 }],
    });
    // Verify streak is NOT recalculated yet (only happens on /complete)
    const afterPost = await request(app).get('/users/u4');
    expect(afterPost.body.currentStreak).toBe(0);
    
    // Now complete the workout and verify streak is recalculated
    await request(app).post(`/workouts/${wr.body.id}/complete`);
    const afterComplete = await request(app).get('/users/u4');
    expect(afterComplete.body.currentStreak).toBe(1);
  });
});

// ─── Req 8: Streak calculation ───────────────────────────────────
describe('Streak calculation (Req 8)', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'clearTimeout',
        'clearInterval', 'clearImmediate', 'nextTick', 'queueMicrotask'],
    });
    jest.setSystemTime(new Date('2024-07-20T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should increase currentStreak on consecutive day workouts', async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dayBefore = new Date(today);
    dayBefore.setDate(today.getDate() - 2);

    // Log & complete workout day-before-yesterday
    let res = await request(app).post('/workouts').send({
      userId: 'u4',
      date: dayBefore.toISOString(),
      exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${res.body.id}/complete`);

    // Log & complete workout yesterday
    res = await request(app).post('/workouts').send({
      userId: 'u4',
      date: yesterday.toISOString(),
      exercises: [{ name: 'Lunges', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${res.body.id}/complete`);

    // Log & complete workout today
    res = await request(app).post('/workouts').send({
      userId: 'u4',
      date: today.toISOString(),
      exercises: [{ name: 'Plank', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${res.body.id}/complete`);

    const userRes = await request(app).get('/users/u4');
    expect(userRes.body.currentStreak).toBe(3);
  });

  it('should not double-count streak for same-day workouts', async () => {
    const today = new Date();

    let res = await request(app).post('/workouts').send({
      userId: 'u4',
      date: today.toISOString(),
      exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${res.body.id}/complete`);

    res = await request(app).post('/workouts').send({
      userId: 'u4',
      date: today.toISOString(),
      exercises: [{ name: 'Lunges', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${res.body.id}/complete`);

    const userRes = await request(app).get('/users/u4');
    // Two workouts on same day = streak of 1, not 2
    expect(userRes.body.currentStreak).toBe(1);
  });

  it('should update longestStreak when currentStreak exceeds it', async () => {
    // u4 starts with longestStreak = 0
    const beforeUser = await request(app).get('/users/u4');
    expect(beforeUser.body.longestStreak).toBe(0);

    const today = new Date();
    for (let i = 2; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const res = await request(app).post('/workouts').send({
        userId: 'u4',
        date: d.toISOString(),
        exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
      });
      await request(app).post(`/workouts/${res.body.id}/complete`);
    }

    const userRes = await request(app).get('/users/u4');
    // longestStreak must have been updated from 0 to at least 3
    expect(userRes.body.longestStreak).toBe(3);
    expect(userRes.body.longestStreak).toBeGreaterThanOrEqual(userRes.body.currentStreak);
  });

  it('should reset currentStreak to 1 when a day is missed (gap day)', async () => {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);

    // Complete a workout 3 days ago
    let res = await request(app).post('/workouts').send({
      userId: 'u4',
      date: threeDaysAgo.toISOString(),
      exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${res.body.id}/complete`);

    // Skip two days, then complete a workout today — gap resets streak
    res = await request(app).post('/workouts').send({
      userId: 'u4',
      date: today.toISOString(),
      exercises: [{ name: 'Lunges', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${res.body.id}/complete`);

    const userRes = await request(app).get('/users/u4');
    expect(userRes.body.currentStreak).toBe(1);
  });

  it('should reset streak when exactly 1 day is missed (boundary test)', async () => {
    const today = new Date();
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(today.getDate() - 2);

    // Complete a workout day-before-yesterday
    let res = await request(app).post('/workouts').send({
      userId: 'u4',
      date: dayBeforeYesterday.toISOString(),
      exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${res.body.id}/complete`);

    // Skip yesterday, then complete a workout today — exactly 1 day missed resets streak
    res = await request(app).post('/workouts').send({
      userId: 'u4',
      date: today.toISOString(),
      exercises: [{ name: 'Lunges', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${res.body.id}/complete`);

    const userRes = await request(app).get('/users/u4');
    expect(userRes.body.currentStreak).toBe(1);
  });
});

// ─── Req 9: GET /users/:id/badges ───────────────────────────────
describe('GET /users/:id/badges (Req 9)', () => {
  it('should return badges with progress for a user', async () => {
    const res = await request(app).get('/users/u1/badges');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const b of res.body as Badge[]) {
      expect(b).toHaveProperty('id');
      expect(b).toHaveProperty('name');
      expect(typeof b.progress).toBe('number');
      if (b.earned) {
        expect(b.progress).toBe(100);
        expect(b.earnedAt).toBeDefined();
      }
    }
  });

  it('should return 404 for non-existent user', async () => {
    const res = await request(app).get('/users/nouser/badges');
    expect(res.status).toBe(404);
  });

  it('should show earned badges for qualifying user', async () => {
    const res = await request(app).get('/users/u3/badges');
    const earned = (res.body as Badge[]).filter(b => b.earned);
    expect(earned.length).toBeGreaterThan(0);
    expect(earned.find(b => b.name === 'Centurion')).toBeDefined();
  });

  it('should show correctly calculated progress for unearned badges', async () => {
    // u4 has 0 totalWorkouts, 0 streak, no PRs
    const res = await request(app).get('/users/u4/badges');
    for (const b of res.body as Badge[]) {
      expect(b.earned).toBe(false);
      expect(b.progress).toBeLessThan(100);
    }
    // Count badges: 0/1 = 0% for First Workout
    const firstWorkout = (res.body as Badge[]).find(b => b.name === 'First Workout');
    expect(firstWorkout).toBeDefined();
    expect(firstWorkout!.progress).toBe(0);
    const centurion = (res.body as Badge[]).find(b => b.name === 'Centurion');
    expect(centurion).toBeDefined();
    expect(centurion!.progress).toBe(0);
    // u1 has 47 totalWorkouts: Centurion progress = round(47/100 * 100) = 47%
    const resU1 = await request(app).get('/users/u1/badges');
    const centurionU1 = (resU1.body as Badge[]).find((b: Badge) => b.name === 'Centurion');
    expect(centurionU1).toBeDefined();
    expect(centurionU1!.progress).toBe(47);
    expect(centurionU1!.earned).toBe(false);
  });
});

// ─── Req 10: Badge award system ──────────────────────────────────
describe('Badge award system (Req 10)', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'clearTimeout',
        'clearInterval', 'clearImmediate', 'nextTick', 'queueMicrotask'],
    });
    jest.setSystemTime(new Date('2024-07-20T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should award First Workout badge after 1 completed workout', async () => {
    // u4 has 0 workouts
    const wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: new Date().toISOString(),
      exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${wr.body.id}/complete`);

    const res = await request(app).get('/users/u4');
    expect(res.body.badges.find((b: Badge) => b.name === 'First Workout')).toBeDefined();
  });

  it('should award streak-based badge when streak meets threshold', async () => {
    // Build a 7-day streak for u4
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const wr = await request(app).post('/workouts').send({
        userId: 'u4',
        date: d.toISOString(),
        exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
      });
      await request(app).post(`/workouts/${wr.body.id}/complete`);
    }

    const res = await request(app).get('/users/u4');
    const weekWarrior = res.body.badges.find((b: Badge) => b.name === 'Week Warrior');
    expect(weekWarrior).toBeDefined();
  });

  it('should award weight milestone badge on personal record', async () => {
    // u4 has no PR; log a workout with Bench Press ≥ 200 and complete it
    const wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: new Date().toISOString(),
      exercises: [{ name: 'Bench Press', sets: 1, reps: 1, weight: 205 }],
    });
    await request(app).post(`/workouts/${wr.body.id}/complete`);

    const res = await request(app).get('/users/u4');
    const club200 = res.body.badges.find((b: Badge) => b.name === '200 Club');
    expect(club200).toBeDefined();
  });

  it('should award Centurion badge when 100 workouts reached via award flow', async () => {
    // Set u1 to 99 workouts and ensure Centurion is not already earned
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const u1 = data.users.find((u: User) => u.id === 'u1');
    u1.totalWorkouts = 99;
    u1.badges = u1.badges.filter((b: Badge) => b.name !== 'Centurion');
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    const wr = await request(app).post('/workouts').send({
      userId: 'u1',
      date: new Date().toISOString(),
      exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${wr.body.id}/complete`);

    const userRes = await request(app).get('/users/u1');
    expect(userRes.body.totalWorkouts).toBe(100);
    const centurion = userRes.body.badges.find((b: Badge) => b.name === 'Centurion');
    expect(centurion).toBeDefined();
    expect(centurion.earnedAt).toBeDefined();
  });
});

// ─── Req 11: POST /workouts/:id/complete ─────────────────────────
describe('POST /workouts/:id/complete (Req 11)', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'clearTimeout',
        'clearInterval', 'clearImmediate', 'nextTick', 'queueMicrotask'],
    });
    jest.setSystemTime(new Date('2024-07-20T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should mark a workout as completed', async () => {
    const wr = await request(app).post('/workouts').send({
      userId: 'u1',
      date: new Date().toISOString(),
      exercises: [{ name: 'Push-ups', sets: 3, reps: 15 }],
    });
    const res = await request(app).post(`/workouts/${wr.body.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.completedAt).toBeDefined();
  });

  it('should update user totalWorkouts after completion', async () => {
    const before = await request(app).get('/users/u4');
    const wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: new Date().toISOString(),
      exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${wr.body.id}/complete`);
    const after = await request(app).get('/users/u4');
    expect(after.body.totalWorkouts).toBe(before.body.totalWorkouts + 1);
  });

  it('should return 409 when completing an already-completed workout', async () => {
    // w1 is already completed in fixture
    const res = await request(app).post('/workouts/w1/complete');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already/i);
  });

  it('should return 404 for non-existent workout', async () => {
    const res = await request(app).post('/workouts/nonexistent/complete');
    expect(res.status).toBe(404);
  });

  it('should update personal records on completion', async () => {
    const wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: new Date().toISOString(),
      exercises: [{ name: 'Squat', sets: 1, reps: 1, weight: 100 }],
    });
    await request(app).post(`/workouts/${wr.body.id}/complete`);
    const user = await request(app).get('/users/u4');
    expect(user.body.personalRecords['Squat']).toBe(100);
  });

  it('should trigger badge evaluation as a side effect of /complete', async () => {
    // u4 has 0 badges before any completion
    const beforeBadges = await request(app).get('/users/u4/badges');
    const earnedBefore = (beforeBadges.body as Badge[]).filter(b => b.earned);
    expect(earnedBefore.length).toBe(0);

    // One /complete call should trigger badge evaluation and award First Workout
    const wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: new Date().toISOString(),
      exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
    });
    const completeRes = await request(app).post(`/workouts/${wr.body.id}/complete`);
    expect(completeRes.status).toBe(200);

    const afterUser = await request(app).get('/users/u4');
    expect(afterUser.body.badges.length).toBeGreaterThan(0);
    expect(afterUser.body.badges.find((b: Badge) => b.name === 'First Workout')).toBeDefined();
  });
});

// ─── Req 12: GET /recommendations/:userId ────────────────────────
describe('GET /recommendations/:userId (Req 12)', () => {
  it('should return recommendations for a valid user', async () => {
    const res = await request(app).get('/recommendations/u1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should exclude exercises requiring equipment the user does not have', async () => {
    // u4 has NO equipment
    const res = await request(app).get('/recommendations/u4');
    for (const ex of res.body as ExerciseRec[]) {
      if (ex.equipment.length > 0) {
        throw new Error(`Exercise "${ex.name}" requires equipment but user has none`);
      }
    }
  });

  it('should filter by difficulty matching user fitness level', async () => {
    // u1 is intermediate with barbell — should not get advanced exercises like Deadlift
    const resU1 = await request(app).get('/recommendations/u1');
    expect(resU1.body.length).toBeGreaterThan(0);
    for (const ex of resU1.body as ExerciseRec[]) {
      expect(['beginner', 'intermediate']).toContain(ex.difficulty);
    }
    // Specifically verify Deadlift (advanced, needs barbell which u1 has) is excluded
    const deadlift = (resU1.body as ExerciseRec[]).find(e => e.name === 'Deadlift');
    expect(deadlift).toBeUndefined();

    // u2 is beginner — should only get beginner-level exercises
    const resU2 = await request(app).get('/recommendations/u2');
    expect(resU2.body.length).toBeGreaterThan(0);
    for (const ex of resU2.body as ExerciseRec[]) {
      expect(ex.difficulty).toBe('beginner');
    }
  });

  it('should deprioritize recently performed exercises', async () => {
    // u1 recently did Bench Press, Squat, Pull-ups, etc. — they should rank later
    const res = await request(app).get('/recommendations/u1');
    const names = (res.body as ExerciseRec[]).map(e => e.name);
    expect(names.length).toBeGreaterThan(1);

    // Bench Press must be present (u1 has equipment) and must NOT be first
    const benchIdx = names.indexOf('Bench Press');
    expect(benchIdx).toBeGreaterThanOrEqual(0); // Must be present, not silently absent
    expect(benchIdx).toBeGreaterThan(0); // Must be deprioritized

    // Non-recent exercises must appear before recent ones
    const recentNames = ['bench press', 'squat', 'pull-ups', 'dumbbell row', 'overhead press', 'lateral raise'];
    const firstNonRecent = names.findIndex(n => !recentNames.includes(n.toLowerCase()));
    const firstRecent = names.findIndex(n => recentNames.includes(n.toLowerCase()));
    if (firstNonRecent >= 0 && firstRecent >= 0) {
      expect(firstNonRecent).toBeLessThan(firstRecent);
    }
  });

  it('should return 404 for non-existent user', async () => {
    const res = await request(app).get('/recommendations/nobody');
    expect(res.status).toBe(404);
  });
});

// ─── Req 13: Date handling edge cases ────────────────────────────
describe('Date handling edge cases (Req 13)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should correctly track streak across midnight boundary with mocked clock', async () => {
    jest.useFakeTimers({
      doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'clearTimeout',
        'clearInterval', 'clearImmediate', 'nextTick', 'queueMicrotask'],
    });
    // Set clock to July 14, 2024
    jest.setSystemTime(new Date('2024-07-14T23:00:00Z'));

    // Complete workout just before midnight on July 14
    let wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: '2024-07-14T23:30:00Z',
      exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${wr.body.id}/complete`);

    // Advance clock to just after midnight — July 15
    jest.setSystemTime(new Date('2024-07-15T00:30:00Z'));

    wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: '2024-07-15T00:30:00Z',
      exercises: [{ name: 'Lunges', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${wr.body.id}/complete`);

    const userRes = await request(app).get('/users/u4');
    // Two consecutive calendar days = streak of 2
    expect(userRes.body.currentStreak).toBe(2);
  });

  it('should handle timezone offsets and maintain streak correctness', async () => {
    jest.useFakeTimers({
      doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'clearTimeout',
        'clearInterval', 'clearImmediate', 'nextTick', 'queueMicrotask'],
    });
    jest.setSystemTime(new Date('2024-07-15T12:00:00Z'));

    // Workout with +05:30 offset: 2024-07-15T02:00:00+05:30 = 2024-07-14T20:30:00Z
    let wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: '2024-07-15T02:00:00+05:30',
      exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
    });
    expect(wr.status).toBe(201);
    await request(app).post(`/workouts/${wr.body.id}/complete`);

    // Workout at UTC July 15
    wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: '2024-07-15T10:00:00Z',
      exercises: [{ name: 'Lunges', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${wr.body.id}/complete`);

    const userRes = await request(app).get('/users/u4');
    // Dates resolve to two different UTC calendar days (July 14 and 15), consecutive
    expect(userRes.body.currentStreak).toBe(2);
  });

  it('should handle DST transition dates deterministically with mocked clock', async () => {
    jest.useFakeTimers({
      doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'clearTimeout',
        'clearInterval', 'clearImmediate', 'nextTick', 'queueMicrotask'],
    });
    // Simulate around US Spring Forward: March 10, 2024
    jest.setSystemTime(new Date('2024-03-09T20:00:00Z'));

    let wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: '2024-03-09T22:00:00Z',
      exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${wr.body.id}/complete`);

    // Advance to DST transition day
    jest.setSystemTime(new Date('2024-03-10T12:00:00Z'));

    wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: '2024-03-10T08:00:00Z',
      exercises: [{ name: 'Lunges', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${wr.body.id}/complete`);

    // Day after DST
    jest.setSystemTime(new Date('2024-03-11T12:00:00Z'));

    wr = await request(app).post('/workouts').send({
      userId: 'u4',
      date: '2024-03-11T08:00:00Z',
      exercises: [{ name: 'Plank', sets: 3, reps: 10 }],
    });
    await request(app).post(`/workouts/${wr.body.id}/complete`);

    const userRes = await request(app).get('/users/u4');
    // Three consecutive calendar days: March 9, 10, 11 — streak = 3
    expect(userRes.body.currentStreak).toBe(3);
  });
});

// ─── Req 14: Async correctness & diagnostics ─────────────────────
describe('Async correctness (Req 14)', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'clearTimeout',
        'clearInterval', 'clearImmediate', 'nextTick', 'queueMicrotask'],
    });
    jest.setSystemTime(new Date('2024-07-20T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should handle sequential create+complete without race conditions', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await request(app).post('/workouts').send({
        userId: 'u4',
        date: new Date().toISOString(),
        exercises: [{ name: 'Push-ups', sets: 3, reps: 10 }],
      });
      expect(r.status).toBe(201);
      ids.push(r.body.id);
    }
    for (const id of ids) {
      const c = await request(app).post(`/workouts/${id}/complete`);
      expect(c.status).toBe(200);
    }
    const user = await request(app).get('/users/u4');
    expect(user.body.totalWorkouts).toBe(3);
  });

  it('should return meaningful, diagnostic error messages', async () => {
    // Missing required fields — message should mention what's needed
    const r1 = await request(app).post('/users').send({});
    expect(r1.status).toBe(400);
    expect(typeof r1.body.error).toBe('string');
    expect(r1.body.error.toLowerCase()).toMatch(/name|email|required/);

    // Invalid email — message should reference email
    const r2 = await request(app).post('/users').send({ name: 'Test', email: 'bad' });
    expect(r2.status).toBe(400);
    expect(r2.body.error.toLowerCase()).toMatch(/email/);

    // Duplicate email — message should indicate existence
    const r3 = await request(app).post('/users').send({ name: 'Dup', email: 'alex@example.com' });
    expect(r3.status).toBe(409);
    expect(r3.body.error.toLowerCase()).toMatch(/exists|duplicate|already/);

    // Missing user for workout — message should say not found
    const r4 = await request(app).post('/workouts').send({
      userId: 'nonexistent',
      exercises: [{ name: 'Push-ups', sets: 3, reps: 15 }],
    });
    expect(r4.status).toBe(404);
    expect(r4.body.error.toLowerCase()).toMatch(/not found|user/);

    // Missing exercises — message should reference exercises
    const r5 = await request(app).post('/workouts').send({ userId: 'u1' });
    expect(r5.status).toBe(400);
    expect(r5.body.error.toLowerCase()).toMatch(/exercise/);

    // Already completed workout — message should say already
    const r6 = await request(app).post('/workouts/w1/complete');
    expect(r6.status).toBe(409);
    expect(r6.body.error.toLowerCase()).toMatch(/already/);
  });
});
