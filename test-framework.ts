interface TestResult {
  name: string;
  passed: boolean;
  error?: Error;
}

class TestRunner {
  private tests: Array<() => void> = [];
  private results: TestResult[] = [];

  test(name: string, testFn: () => void): void {
    this.tests.push(() => {
      try {
        testFn();
        this.results.push({ name, passed: true });
      } catch (error) {
        this.results.push({ 
          name, 
          passed: false, 
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    });
  }

  run(): void {
    this.results = [];
    console.log('Running tests...\n');
    
    this.tests.forEach(test => test());
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    
    console.log(`\nTest Results: ${passed} passed, ${failed} failed\n`);
    
    this.results.forEach(result => {
      const status = result.passed ? '✓' : '✗';
      console.log(`${status} ${result.name}`);
      if (!result.passed && result.error) {
        console.log(`  Error: ${result.error.message}`);
      }
    });
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T): void {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    },
    
    toEqual(expected: T): void {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    
    toContain(expected: any): void {
      if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new Error(`Expected array to contain ${expected}`);
        }
      } else if (typeof actual === 'string') {
        if (!actual.includes(expected)) {
          throw new Error(`Expected string to contain ${expected}`);
        }
      } else {
        throw new Error('toContain only works with arrays and strings');
      }
    },
    
    toHaveLength(expected: number): void {
      if (!actual || typeof (actual as any).length !== 'number') {
        throw new Error('Expected value to have length property');
      }
      if ((actual as any).length !== expected) {
        throw new Error(`Expected length ${expected}, but got ${(actual as any).length}`);
      }
    },
    
    toBeTruthy(): void {
      if (!actual) {
        throw new Error(`Expected value to be truthy, but got ${actual}`);
      }
    },
    
    toBeFalsy(): void {
      if (actual) {
        throw new Error(`Expected value to be falsy, but got ${actual}`);
      }
    }
  };
}

export { TestRunner, expect };