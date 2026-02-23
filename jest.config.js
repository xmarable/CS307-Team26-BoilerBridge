import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load .env files
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "node",
  // Use globalSetup to ensure env vars load before anything else
  globalSetup: "<rootDir>/jest.setup.js",
  // moduleNameMapper handles your @/ aliases
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // Tells Jest to treat these as ES Modules
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  // This allows Jest to handle the "import from .js" quirk in TS files
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};

export default createJestConfig(customJestConfig);