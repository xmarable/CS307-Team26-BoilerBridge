<<<<<<< HEAD
// jest.config.cjs

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testEnvironmentOptions: {
    ...(typeof globalThis.Request !== "undefined" && { Request: globalThis.Request }),
    ...(typeof globalThis.Headers !== "undefined" && { Headers: globalThis.Headers }),
    ...(typeof globalThis.Response !== "undefined" && { Response: globalThis.Response }),
  },
  rootDir: "./",
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.(t|j)sx?$": [
=======
/* eslint-disable import/no-anonymous-default-export */
// CommonJS config so Jest receives a mutable config (avoids "object is not extensible")
module.exports = {
  testEnvironment: "node",
  testEnvironmentOptions: {
    ...(typeof globalThis.Request !== "undefined" && { Request: globalThis.Request }),
    ...(typeof globalThis.Headers !== "undefined" && { Headers: globalThis.Headers }),
    ...(typeof globalThis.Response !== "undefined" && { Response: globalThis.Response }),
  },
  rootDir: "./",
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.(mt|t|cj|j)s$": [
>>>>>>> 0dd804b (Fixed test files)
      "babel-jest",
      {
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
<<<<<<< HEAD
          ["@babel/preset-react", { runtime: "automatic" }],
=======
>>>>>>> 0dd804b (Fixed test files)
          "@babel/preset-typescript",
        ],
      },
    ],
  },
<<<<<<< HEAD

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },

  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
};
=======
};
>>>>>>> 0dd804b (Fixed test files)
