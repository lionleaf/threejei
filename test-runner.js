class TestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  test(name, testFn) {
    this.tests.push(() => {
      try {
        testFn();
        this.results.push({ name, passed: true });
      } catch (error) {
        this.results.push({ 
          name, 
          passed: false, 
          error: error
        });
      }
    });
  }

  run() {
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
    
    return failed === 0;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    },
    
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
      }
    },
    
    toHaveLength(expected) {
      if (!actual || typeof actual.length !== 'number') {
        throw new Error('Expected value to have length property');
      }
      if (actual.length !== expected) {
        throw new Error(`Expected length ${expected}, but got ${actual.length}`);
      }
    },
    
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected value to be truthy, but got ${actual}`);
      }
    },
    
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected value to be falsy, but got ${actual}`);
      }
    },
    
    toContain(expected) {
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
    }
  };
}

export { TestRunner, expect };