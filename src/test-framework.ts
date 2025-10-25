interface TestState {
  currentGroup: string | null;
  failedTests: string[];
  passedTests: number;
  totalTests: number;
}

const state: TestState = {
  currentGroup: null,
  failedTests: [],
  passedTests: 0,
  totalTests: 0
};

export function testGroup(name: string, fn: () => void): void {
  state.currentGroup = name;
  console.log(`\n${name}`);
  fn();
  state.currentGroup = null;
}

export function test(name: string, fn: () => void): void {
  state.totalTests++;
  try {
    fn();
    state.passedTests++;
    const prefix = state.currentGroup ? '  ' : '';
    console.log(`${prefix}✓ ${name}`);
  } catch (error) {
    const fullName = state.currentGroup ? `${state.currentGroup} > ${name}` : name;
    state.failedTests.push(fullName);
    const prefix = state.currentGroup ? '  ' : '';
    console.log(`${prefix}✗ ${name}`);
    if (error instanceof Error) {
      console.log(`${prefix}  ${error.message}`);
    }
  }
}

export function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    const msg = message || `Expected ${expected}, got ${actual}`;
    throw new Error(msg);
  }
}

export function assertTrue(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(message || 'Expected true, got false');
  }
}

export function assertFalse(condition: boolean, message?: string): void {
  if (condition) {
    throw new Error(message || 'Expected false, got true');
  }
}

export function assertThrows(fn: () => void, message?: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || 'Expected function to throw');
  }
}

export function assertNotEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual === expected) {
    const msg = message || `Expected value not to equal ${expected}`;
    throw new Error(msg);
  }
}

export function printResults(): void {
  console.log('\n' + '='.repeat(50));
  if (state.failedTests.length === 0) {
    console.log(`✓ All ${state.totalTests} tests passed!`);
  } else {
    console.log(`✗ ${state.failedTests.length} of ${state.totalTests} tests failed:`);
    state.failedTests.forEach(failure => console.log(`  - ${failure}`));
    console.log(`\n✓ ${state.passedTests} tests passed`);
  }
  console.log('='.repeat(50));
}

export function resetState(): void {
  state.currentGroup = null;
  state.failedTests = [];
  state.passedTests = 0;
  state.totalTests = 0;
}
