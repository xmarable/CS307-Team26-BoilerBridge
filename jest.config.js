/* eslint-disable import/no-anonymous-default-export */
// Export the Jest configuration
export default {
  // Set the testing environment to Node
  testEnvironment: "node",
  // Define the root directory
  rootDir: "./",
  // Tell Jest to run this file before the tests
  setupFiles: ["<rootDir>/jest.setup.js"],
  // Treat TS files as ES Modules
  extensionsToTreatAsEsm: [".ts"],
  // Map module paths
  moduleNameMapper: {
    // Map root alias
    "^@/(.*)$": "<rootDir>/$1",
    // Map JS imports to actual files
    "^(\\.{1,2}/.*)\\.js$": "$1", 
  },
  // Transform settings
  transform: {
    // Use babel-jest to transform TS files while keeping them as ESM
    "^.+\\.(mt|t|cj|j)s$": [
      // Use Babel
      "babel-jest",
      {
        // Define presets
        presets: [
          // Env preset
          ["@babel/preset-env", { targets: { node: "current" } }],
          // TS preset
          "@babel/preset-typescript",
        ],
      },
    ],
  },
};