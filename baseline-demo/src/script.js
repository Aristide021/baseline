// Demo JavaScript with various Baseline status features

// Widely available features (30+ months interoperable)
const modernFeatures = {
  // ES2020 features - widely available
  optionalChaining: obj?.property?.method?.(),
  nullishCoalescing: value ?? 'default',
  
  // Promise.allSettled - widely available since 2020
  async checkFeatures() {
    const results = await Promise.allSettled([
      fetch('/api/data'),
      fetch('/api/config')
    ]);
    return results;
  }
};

// Newly available features (≤30 months interoperable)
class DemoComponent {
  // Private fields - newly available
  #privateData = 'secret';
  
  // Static initialization blocks - newly available (2022)
  static {
    console.log('Static block executed');
  }
  
  // Public class fields - newly available
  publicField = 'public';
  
  getPrivateData() {
    return this.#privateData;
  }
}

// Array methods that may trigger warnings based on baseline year
const data = [1, 2, 3, 4, 5];

// Array.at() - 2022 feature
const lastItem = data.at(-1);

// Object.hasOwn() - 2022 feature  
const hasProperty = Object.hasOwn(data, 'length');

// Top-level await - should be checked based on target
if (typeof window !== 'undefined') {
  // Web APIs that vary in baseline status
  
  // Intersection Observer - widely available
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        console.log('Element is visible');
      }
    });
  });
  
  // Web Locks API - limited availability
  if ('locks' in navigator) {
    navigator.locks.request('my-lock', () => {
      console.log('Lock acquired');
    });
  }
  
  // Import assertions - cutting edge
  // import config from './config.json' assert { type: 'json' };
}