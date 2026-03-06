/* eslint-disable import/no-anonymous-default-export */
// Jest config for Node + ESM support
module.exports = {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  testEnvironmentOptions: {
    ...(typeof globalThis.Request !== "undefined" && { Request: globalThis.Request }),
    ...(typeof globalThis.Headers !== "undefined" && { Headers: globalThis.Headers }),
    ...(typeof globalThis.Response !== "undefined" && { Response: globalThis.Response }),
  },
  rootDir: "./",
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "mjs", "json", "node"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Map .js to $1 for ESM resolution; do not match .mjs (avoid stripping 'm' from .mjs)
    "^(\.{1,2}/.*)(?<!\\.m)\\.js$": "$1",
  },
  transform: {
    "^.+\.(mt|t|cj|j)sx?$": [
      "babel-jest",
      {
        presets: [
          ["@babel/preset-env", { targets: { node: "current" }, modules: false }],
          "@babel/preset-typescript",
          ["@babel/preset-react", { runtime: "automatic" }],
        ],
        plugins: ["@babel/plugin-syntax-top-level-await"],
      },
    ],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(bson|mongodb|mongoose|@mongodb-js|next-auth)/)",
  ],
};
