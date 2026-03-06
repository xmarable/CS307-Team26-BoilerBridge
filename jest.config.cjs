<<<<<<< HEAD
// jest.config.cjs

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",

  // Required for ESM support in Jest
  extensionsToTreatAsEsm: [".ts", ".tsx"],

  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  transform: {
    "^.+\\.(t|j)sx?$": [
=======
/* eslint-disable import/no-anonymous-default-export */
// CommonJS config so Jest receives a mutable config (avoids "object is not extensible")
module.exports = {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  testEnvironmentOptions: {
    ...(typeof globalThis.Request !== "undefined" && {
      Request: globalThis.Request,
    }),
    ...(typeof globalThis.Headers !== "undefined" && {
      Headers: globalThis.Headers,
    }),
    ...(typeof globalThis.Response !== "undefined" && {
      Response: globalThis.Response,
    }),
  },
  rootDir: "./",
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.(mt|t|cj|j)sx?$": [
      "babel-jest",
      {
        presets: [
          [
            "@babel/preset-env",
            {
              targets: { node: "current" },
              modules: false,
            },
          ],
          "@babel/preset-typescript",
          ["@babel/preset-react", { runtime: "automatic" }],
        ],
        plugins: ["@babel/plugin-syntax-top-level-await"],
      },
    ],
  },
<<<<<<< HEAD

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  transformIgnorePatterns: [
    "/node_modules/(?!(bson|mongodb|mongoose|@mongodb-js|next-auth)/)",
  ],
};
