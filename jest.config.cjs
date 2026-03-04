/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",

  // Required for ESM support in Jest
  extensionsToTreatAsEsm: [".ts", ".tsx"],

  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  transform: {
    "^.+\\.(t|j)sx?$": [
      "babel-jest",
      {
        presets: [
          // Keep modules: false for ESM compatibility
          [
            "@babel/preset-env",
            { targets: { node: "current" }, modules: false },
          ],
          ["@babel/preset-react", { runtime: "automatic" }],
          "@babel/preset-typescript",
        ],
        plugins: ["@babel/plugin-syntax-top-level-await"],
      },
    ],
  },

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  transformIgnorePatterns: [
    "/node_modules/(?!(bson|mongodb|mongoose|@mongodb-js|next-auth)/)",
  ],
};
