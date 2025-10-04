// Baseline Demo JavaScript
// Features from different baseline status levels

// ✅ Widely Available Features (30+ months interoperable)
class BaselineDemo {
  constructor() {
    this.features = new Map();
    this.observer = null;
    this.initDemo();
  }

  async initDemo() {
    // Modern Promise features
    const results = await Promise.allSettled([
      this.checkIntersectionObserver(),
      this.testFetchAPI(),
      this.demonstrateModernArrayMethods()
    ]);
    
    console.log('Demo initialization results:', results);
  }

  // Intersection Observer API (widely available)
  checkIntersectionObserver() {
    return new Promise(resolve => {
      if ('IntersectionObserver' in window) {
        this.observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
            }
          });
        });
        
        document.querySelectorAll('.card').forEach(card => {
          this.observer.observe(card);
        });
        
        resolve('IntersectionObserver supported');
      } else {
        resolve('IntersectionObserver not supported');
      }
    });
  }

  // Fetch API (widely available)
  async testFetchAPI() {
    try {
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ demo: true })
      });
      return await response.json();
    } catch (error) {
      console.log('Fetch demo (expected to fail):', error.message);
      return { error: 'Expected demo error' };
    }
  }

  // 🆕 Newly Available Features (≤30 months interoperable)
  demonstrateModernFeatures() {
    // Note: Private class fields and static blocks are demonstrated in ModernFeatureClass below
    console.log('Modern features demonstration');
    
    // Top-level await (newly available in modules)
    // Note: This would only work in module context
    // await this.someAsyncOperation();
  }

  // Modern array methods
  demonstrateModernArrayMethods() {
    const data = [1, 2, 3, 4, 5];
    
    // Array.at() method (2022 feature)
    const lastItem = data.at(-1);
    console.log('Last item using at():', lastItem);
    
    // Array.findLast() (newer feature)
    const lastEven = data.findLast(n => n % 2 === 0);
    console.log('Last even number:', lastEven);
    
    return { lastItem, lastEven };
  }

  // ⚠️ Object methods (2022 features)
  demonstrateObjectMethods() {
    const obj = { name: 'demo', type: 'baseline' };
    
    // Object.hasOwn() (2022 feature)
    if (Object.hasOwn(obj, 'name')) {
      console.log('Object has name property');
    }
    
    return obj;
  }

  // 🚧 Cutting-Edge Features (limited support)
  async demonstrateExperimentalFeatures() {
    // Web Locks API (limited support)
    if ('locks' in navigator) {
      await navigator.locks.request('demo-lock', () => {
        console.log('Web Locks API working');
      });
    }
    
    // View Transitions API (very limited support)
    if ('startViewTransition' in document) {
      document.startViewTransition(() => {
        // Transition logic here
      });
    }
    
    // Import assertions (experimental)
    // import data from './data.json' assert { type: 'json' };
  }
}

// 🆕 Modern Feature Class (demonstrates private fields and static blocks)
class ModernFeatureClass {
  // Private class fields (newly available)
  #privateField = 'This is private';
  
  // Static initialization blocks (newly available)
  static {
    console.log('Static block executed in ModernFeatureClass');
  }
  
  #privateMethod() {
    return this.#privateField;
  }
  
  getPrivateValue() {
    return this.#privateMethod();
  }
}

// Initialize demo when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const demo = new BaselineDemo();
  window.baselineDemo = demo; // For debugging
  
  // Demonstrate modern features
  const modernFeatures = new ModernFeatureClass();
  console.log('Private field demo:', modernFeatures.getPrivateValue());
});