// Baseline-Safe JavaScript Demo
// Only widely available, stable features

// ✅ WIDELY AVAILABLE FEATURES - Should pass all compliance checks
class SafeBaselineDemo {
  constructor() {
    this.features = new Map();
    this.initDemo();
  }

  initDemo() {
    // Use traditional Promise.all (widely supported)
    Promise.all([
      this.checkBasicAPIs(),
      this.demonstrateArrayMethods(),
      this.testJSONMethods()
    ]).then(results => {
      console.log('Safe demo initialization results:', results);
    });
  }

  // Basic DOM and console APIs (universally supported)
  checkBasicAPIs() {
    return new Promise(resolve => {
      // Basic DOM manipulation
      const elements = document.querySelectorAll('.demo-element');
      elements.forEach(element => {
        element.addEventListener('click', this.handleClick.bind(this));
      });
      
      resolve('Basic APIs initialized');
    });
  }

  handleClick(event) {
    event.preventDefault();
    console.log('Element clicked:', event.target);
  }

  // Well-supported array methods
  demonstrateArrayMethods() {
    const data = [1, 2, 3, 4, 5];
    
    // Classic array methods (widely supported)
    const doubled = data.map(n => n * 2);
    const evens = data.filter(n => n % 2 === 0);
    const sum = data.reduce((acc, n) => acc + n, 0);
    
    console.log('Array operations:', { doubled, evens, sum });
    
    return { doubled, evens, sum };
  }

  // JSON methods (universally supported)
  testJSONMethods() {
    const testData = { name: 'baseline', version: '1.0' };
    
    // JSON stringify/parse (universally supported)
    const jsonString = JSON.stringify(testData);
    const parsedData = JSON.parse(jsonString);
    
    console.log('JSON operations successful');
    
    return parsedData;
  }

  // Object methods (widely supported)
  demonstrateObjectMethods() {
    const obj = { name: 'demo', type: 'baseline' };
    
    // Classic object methods
    const keys = Object.keys(obj);
    const values = Object.values(obj);
    const entries = Object.entries(obj);
    
    console.log('Object methods:', { keys, values, entries });
    
    return { keys, values, entries };
  }
}

// Traditional class without modern features
class TraditionalClass {
  constructor() {
    this.publicField = 'This is public';
    this.initializeData();
  }
  
  initializeData() {
    console.log('Traditional class initialized');
  }
  
  getPublicValue() {
    return this.publicField;
  }
}

// Initialize demo when DOM is ready (classic approach)
document.addEventListener('DOMContentLoaded', function() {
  var demo = new SafeBaselineDemo();
  window.safeBaselineDemo = demo; // For debugging
  
  // Demonstrate traditional features
  var traditionalFeatures = new TraditionalClass();
  console.log('Traditional class demo:', traditionalFeatures.getPublicValue());
});