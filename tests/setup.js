/**
 * Jest setup file for Baseline GitHub Action tests
 */

// Mock GitHub Actions core module
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  getInput: jest.fn(),
  summary: {
    addRaw: jest.fn().mockReturnThis(),
    write: jest.fn().mockResolvedValue()
  }
}));

// Mock GitHub Actions github module
jest.mock('@actions/github', () => ({
  context: {
    eventName: 'pull_request',
    repo: {
      owner: 'test-owner',
      repo: 'test-repo'
    },
    payload: {
      pull_request: {
        number: 123,
        head: { sha: 'test-sha' },
        base: { sha: 'base-sha' }
      }
    },
    sha: 'test-sha',
    ref: 'refs/heads/test-branch'
  },
  getOctokit: jest.fn(() => ({
    rest: {
      issues: {
        createComment: jest.fn(),
        updateComment: jest.fn(),
        listComments: jest.fn()
      },
      pulls: {
        listFiles: jest.fn()
      },
      repos: {
        compareCommits: jest.fn()
      },
      checks: {
        create: jest.fn()
      }
    }
  }))
}));

// Mock node-fetch
jest.mock('node-fetch', () => {
  return jest.fn(() => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      data: [],
      metadata: {}
    })
  }));
});

// Mock web-features ESM import
jest.mock('web-features', () => ({
  features: {
    'flexbox': {
      name: 'CSS Flexible Box Layout',
      baseline: { low_date: '2015-10-01', high_date: '2017-04-01' },
      status: { support: 'widely' }
    },
    'grid': {
      name: 'CSS Grid Layout',
      baseline: { low_date: '2020-01-01', high_date: '2022-07-01' },
      status: { support: 'widely' }
    },
    'intersection-observer': {
      name: 'Intersection Observer',
      baseline: { low_date: '2019-09-01', high_date: '2021-03-01' },
      status: { support: 'widely' }
    }
  }
}), { virtual: true });

// Mock browserslist
jest.mock('browserslist', () => jest.fn());

// Mock file system operations for testing
const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn()
};

jest.mock('fs', () => ({
  promises: mockFs,
  ...jest.requireActual('fs')
}));

// Global test utilities
global.mockFs = mockFs;

// Setup and teardown
beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Reset mock implementations
  mockFs.readFile.mockImplementation(() => Promise.resolve(''));
  mockFs.writeFile.mockImplementation(() => Promise.resolve());
  mockFs.mkdir.mockImplementation(() => Promise.resolve());
  mockFs.access.mockImplementation(() => Promise.resolve());
  mockFs.stat.mockImplementation(() => Promise.resolve({ 
    mtime: new Date(),
    size: 1024
  }));
  mockFs.readdir.mockImplementation(() => Promise.resolve([]));
});

// Console suppression for cleaner test output
const originalConsole = console;
beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});