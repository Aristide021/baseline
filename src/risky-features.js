// RISKY FEATURES DEMO - These will trigger Baseline violations!
// Used to demonstrate enforcement capabilities
/* eslint-disable no-unused-vars */

// 🚨 CUTTING-EDGE JAVASCRIPT - Will trigger violations

// View Transitions API (very limited support)
if ('startViewTransition' in document) {
  document.startViewTransition(() => {
    // Transition between states
    document.body.classList.toggle('new-state');
  });
}

// Web Locks API (limited support)
async function acquireLock() {
  if ('locks' in navigator) {
    await navigator.locks.request('my-resource', async (_lock) => {
      console.log('Lock acquired');
      // Do work with exclusive access
    });
  }
}

// Import Assertions (experimental)
// Note: This would be a syntax error in many environments
// import config from './config.json' assert { type: 'json' };

// Temporal API (Stage 3 proposal, not yet baseline)
// if ('Temporal' in globalThis) {
//   const now = Temporal.Now.instant();
//   console.log(now.toString());
// }

// Web Streams with newer features
async function processStreamWithTransform() {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue('data');
      controller.close();
    }
  });
  
  // Transform streams with newer features
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      controller.enqueue(chunk.toUpperCase());
    }
  });
  
  const _transformed = stream.pipeThrough(transformStream);
}

// Shared Array Buffer (limited due to security)
if (typeof SharedArrayBuffer !== 'undefined') {
  const sharedBuffer = new SharedArrayBuffer(1024);
  const _sharedArray = new Int32Array(sharedBuffer);
}

// 🆕 NEWER FEATURES - Should trigger warnings

// Top-level await (needs module context)
// await fetch('/api/data');

// Array.findLast and findLastIndex (newer)
const numbers = [1, 2, 3, 4, 5];
const _lastEven = numbers.findLast(n => n % 2 === 0);
const _lastEvenIndex = numbers.findLastIndex(n => n % 2 === 0);

// String.replaceAll (newer)
const text = 'hello world world';
const _replaced = text.replaceAll('world', 'universe');

// Logical assignment operators (newer)
let config = {};
config.theme ||= 'dark';
config.timeout ??= 5000;

// Private fields and methods
class _RiskyClass {
  #privateField = 'secret';
  
  static {
    console.log('Static initialization block');
  }
  
  #privateMethod() {
    return this.#privateField;
  }
  
  publicMethod() {
    return this.#privateMethod();
  }
}

// 🧪 EXPERIMENTAL APIs

// Web Assembly Exception Handling (proposal)
// WebAssembly.Exception - if it exists

// Origin Private File System API
async function useOriginPrivateFS() {
  if ('storage' in navigator && 'getDirectory' in navigator.storage) {
    const opfsRoot = await navigator.storage.getDirectory();
    const _fileHandle = await opfsRoot.getFileHandle('data.txt', { create: true });
  }
}

// Web HID API (limited support)
async function connectHIDDevice() {
  if ('hid' in navigator) {
    const _devices = await navigator.hid.requestDevice({
      filters: [{ vendorId: 0x1234 }]
    });
  }
}

// Call the risky functions
acquireLock();
processStreamWithTransform();
useOriginPrivateFS();
connectHIDDevice();