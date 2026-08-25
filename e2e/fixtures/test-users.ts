/**
 * Test user credentials for E2E tests.
 * These must match seeded users in the test database.
 * In CI, set E2E_TEST_PASSWORD env var.
 */

export interface TestUser {
  email: string
  password: string
  role: string
  fullName: string
}

const password = process.env.E2E_TEST_PASSWORD || 'TestPassword123!'

export const TEST_USERS: Record<string, TestUser> = {
  owner: {
    email: 'owner@test.coordin.io',
    password,
    role: 'OWNER',
    fullName: 'Test Owner',
  },
  admin: {
    email: 'admin@test.coordin.io',
    password,
    role: 'ADMIN',
    fullName: 'Test Admin',
  },
  manager: {
    email: 'manager@test.coordin.io',
    password,
    role: 'MANAGER',
    fullName: 'Test Manager',
  },
  hr: {
    email: 'hr@test.coordin.io',
    password,
    role: 'HR',
    fullName: 'Test HR',
  },
  member: {
    email: 'member@test.coordin.io',
    password,
    role: 'MEMBER',
    fullName: 'Test Member',
  },
  viewer: {
    email: 'viewer@test.coordin.io',
    password,
    role: 'VIEWER',
    fullName: 'Test Viewer',
  },
}
