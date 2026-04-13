// Jest config for Node + ESM support
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
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "mjs", "json", "node"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^(\.{1,2}/.*)(?<!\\.m)\\.js$": "$1",
  },
  transform: {
    "^.+\\.(mt|t|cj|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
            dynamicImport: true,
          },
          transform: {
            react: {
              runtime: "automatic",
            },
          },
          target: "esnext",
        },
      },
    ],
  },
  globalTeardown: "<rootDir>/jest.teardown.js",
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  transformIgnorePatterns: [
    "/node_modules/(?!(bson|mongodb|mongoose|@mongodb-js|next-auth)/)",
  ],
};
