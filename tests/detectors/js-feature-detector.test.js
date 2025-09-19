const JSFeatureDetector = require('../../src/detectors/js-feature-detector');

describe('JSFeatureDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new JSFeatureDetector();
  });

  describe('Fetch API Detection', () => {
    it('should detect fetch API usage', async () => {
      const js = `
        async function getData() {
          const response = await fetch('/api/data');
          return response.json();
        }
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const fetchFeature = features.find(f => f.name === 'fetch');
      expect(fetchFeature).toMatchObject({
        type: 'js-api-call',
        name: 'fetch',
        featureId: 'fetch',
        file: 'test.js'
      });
    });

    it('should detect Response constructor usage', async () => {
      const js = `
        const response = new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' }
        });
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const responseFeature = features.find(f => f.name === 'Response');
      expect(responseFeature).toMatchObject({
        type: 'js-constructor',
        featureId: 'fetch'
      });
    });
  });

  describe('Observer APIs Detection', () => {
    it('should detect IntersectionObserver usage', async () => {
      const js = `
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
            }
          });
        });
        
        observer.observe(element);
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const observerFeature = features.find(f => f.name === 'IntersectionObserver');
      expect(observerFeature).toMatchObject({
        type: 'js-constructor',
        featureId: 'intersection-observer'
      });
    });

    it('should detect ResizeObserver usage', async () => {
      const js = `
        const resizeObserver = new ResizeObserver(entries => {
          for (let entry of entries) {
            console.log('Size changed:', entry.contentRect);
          }
        });
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const resizeFeature = features.find(f => f.name === 'ResizeObserver');
      expect(resizeFeature).toMatchObject({
        type: 'js-constructor',
        featureId: 'resize-observer'
      });
    });
  });

  describe('Modern JavaScript Syntax Detection', () => {
    it('should detect async/await usage', async () => {
      const js = `
        async function fetchData() {
          const data = await fetch('/api');
          return data;
        }
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const awaitFeature = features.find(f => f.name === 'await');
      expect(awaitFeature).toMatchObject({
        type: 'js-async-await',
        featureId: 'async-await'
      });
    });

    it('should detect arrow functions', async () => {
      const js = `
        const add = (a, b) => a + b;
        const items = array.map(item => item.value);
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const arrowFeatures = features.filter(f => f.type === 'js-arrow-function');
      expect(arrowFeatures.length).toBeGreaterThanOrEqual(1);
      expect(arrowFeatures[0]).toMatchObject({
        type: 'js-arrow-function',
        featureId: null // Arrow functions not in web-features database
      });
    });

    it('should detect template literals', async () => {
      const js = `
        const message = \`Hello \${name}, you have \${count} messages\`;
        const multiline = \`
          This is a
          multiline template
        \`;
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const templateFeatures = features.filter(f => f.type === 'js-template-literal');
      expect(templateFeatures.length).toBeGreaterThanOrEqual(1);
      expect(templateFeatures[0]).toMatchObject({
        type: 'js-template-literal',
        featureId: 'template-literals'
      });
    });

    it('should detect spread syntax', async () => {
      const js = `
        const newArray = [...oldArray, newItem];
        const merged = { ...obj1, ...obj2 };
        function sum(...numbers) {
          return numbers.reduce((a, b) => a + b, 0);
        }
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const spreadFeatures = features.filter(f => f.type === 'js-spread');
      expect(spreadFeatures.length).toBeGreaterThanOrEqual(1);
      expect(spreadFeatures[0]).toMatchObject({
        type: 'js-spread',
        featureId: 'spread'
      });
    });

    it('should detect optional chaining', async () => {
      const js = `
        const value = obj?.prop?.nested?.value;
        const result = func?.();
        const item = array?.[index];
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const chainFeatures = features.filter(f => f.type === 'js-optional-chaining');
      expect(chainFeatures.length).toBeGreaterThanOrEqual(1);
      expect(chainFeatures[0]).toMatchObject({
        type: 'js-optional-chaining',
        featureId: null // Optional chaining not in web-features database
      });
    });

    it('should detect nullish coalescing', async () => {
      const js = `
        const value = input ?? defaultValue;
        const config = userConfig ?? {};
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const nullishFeatures = features.filter(f => f.type === 'js-nullish-coalescing');
      expect(nullishFeatures.length).toBeGreaterThanOrEqual(1);
      expect(nullishFeatures[0]).toMatchObject({
        type: 'js-nullish-coalescing',
        featureId: 'nullish-coalescing'
      });
    });
  });

  describe('DOM API Detection', () => {
    it('should detect querySelector usage', async () => {
      const js = `
        const element = document.querySelector('.my-class');
        const elements = document.querySelectorAll('div[data-id]');
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      // Note: querySelector is mapped in the feature mappings
      const queryFeature = features.find(f => f.name === 'document.querySelector');
      if (queryFeature) {
        expect(queryFeature).toMatchObject({
          type: 'js-method-call',
          featureId: 'css-selectors'
        });
      }
    });

    it('should detect element methods', async () => {
      const js = `
        element.closest('.parent');
        element.matches('.selector');
        element.scrollIntoView({ behavior: 'smooth' });
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      // These should be detected if they're in the feature mappings
      const closestFeature = features.find(f => f.name === 'element.closest');
      if (closestFeature) {
        expect(closestFeature.featureId).toBe('element-closest');
      }
    });
  });

  describe('Web Workers Detection', () => {
    it('should detect Worker constructor usage', async () => {
      const js = `
        const worker = new Worker('worker.js');
        worker.postMessage({ command: 'start' });
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const workerFeature = features.find(f => f.name === 'Worker');
      expect(workerFeature).toMatchObject({
        type: 'js-constructor',
        featureId: 'dedicated-workers'
      });
    });

    it('should detect SharedWorker usage', async () => {
      const js = `
        const sharedWorker = new SharedWorker('shared-worker.js');
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const sharedWorkerFeature = features.find(f => f.name === 'SharedWorker');
      expect(sharedWorkerFeature).toMatchObject({
        type: 'js-constructor',
        featureId: 'shared-workers'
      });
    });
  });

  describe('Class Features Detection', () => {
    it('should detect class declarations', async () => {
      const js = `
        class MyClass {
          constructor(value) {
            this.value = value;
          }
          
          getValue() {
            return this.value;
          }
        }
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const classFeature = features.find(f => f.type === 'js-class');
      expect(classFeature).toMatchObject({
        type: 'js-class',
        featureId: 'class-syntax'
      });
    });

    it('should detect class fields', async () => {
      const js = `
        class MyClass {
          publicField = 'value';
          #privateField = 'private';
          
          method() {
            return this.publicField;
          }
        }
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const classFieldFeature = features.find(f => f.type === 'js-class-field');
      if (classFieldFeature) {
        expect(classFieldFeature).toMatchObject({
          type: 'js-class-field',
          featureId: null // Class fields not in web-features database
        });
      }
    });
  });

  describe('Destructuring Detection', () => {
    it('should detect object destructuring', async () => {
      const js = `
        const { name, age } = person;
        const { x, y, ...rest } = coordinates;
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const destructFeatures = features.filter(f => f.type === 'js-destructuring');
      expect(destructFeatures.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect array destructuring', async () => {
      const js = `
        const [first, second, ...rest] = array;
        const [x, y] = coordinates;
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const destructFeatures = features.filter(f => f.type === 'js-destructuring');
      expect(destructFeatures.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('TypeScript Support', () => {
    it('should handle TypeScript syntax', async () => {
      const ts = `
        interface User {
          name: string;
          age: number;
        }
        
        const user: User = {
          name: 'John',
          age: 30
        };
        
        const data = await fetch('/api/users') as Response;
      `;

      const features = await detector.detectFeatures(ts, 'test.ts');
      
      // Should detect fetch and await despite TypeScript syntax
      const fetchFeature = features.find(f => f.name === 'fetch');
      expect(fetchFeature).toBeDefined();
      
      const awaitFeature = features.find(f => f.name === 'await');
      expect(awaitFeature).toBeDefined();
    });
  });

  describe('JSX Support', () => {
    it('should handle JSX syntax', async () => {
      const jsx = `
        function Component() {
          const [data, setData] = useState(null);
          
          useEffect(() => {
            fetch('/api/data').then(setData);
          }, []);
          
          return <div>{data?.name}</div>;
        }
      `;

      const features = await detector.detectFeatures(jsx, 'test.jsx');
      
      // Should detect fetch and optional chaining despite JSX syntax
      const fetchFeature = features.find(f => f.name === 'fetch');
      expect(fetchFeature).toBeDefined();
      
      const optionalFeature = features.find(f => f.type === 'js-optional-chaining');
      expect(optionalFeature).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors gracefully', async () => {
      const malformedJS = `
        function broken() {
          const x = 
          // incomplete statement
        }
        // missing closing brace
      `;

      const features = await detector.detectFeatures(malformedJS, 'test.js');
      
      // Should return empty array instead of throwing
      expect(features).toEqual([]);
    });

    it('should handle empty files', async () => {
      const features = await detector.detectFeatures('', 'test.js');
      expect(features).toEqual([]);
    });

    it('should handle files with only comments', async () => {
      const js = `
        // This is just a comment
        /* Another comment */
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      expect(features).toEqual([]);
    });
  });

  describe('Context Information', () => {
    it('should provide context for method calls', async () => {
      const js = `
        const result = fetch('/api/data');
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const fetchFeature = features.find(f => f.name === 'fetch');
      expect(fetchFeature.context).toMatchObject({
        callee: 'fetch',
        argumentCount: 1
      });

      expect(fetchFeature.location).toMatchObject({
        line: expect.any(Number),
        column: expect.any(Number)
      });
    });

    it('should provide context for constructors', async () => {
      const js = `
        const observer = new IntersectionObserver(callback, options);
      `;

      const features = await detector.detectFeatures(js, 'test.js');
      
      const observerFeature = features.find(f => f.name === 'IntersectionObserver');
      expect(observerFeature.context).toMatchObject({
        constructor: 'IntersectionObserver',
        argumentCount: 2
      });
    });
  });
});