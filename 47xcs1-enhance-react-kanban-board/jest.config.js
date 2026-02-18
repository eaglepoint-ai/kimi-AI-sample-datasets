// Jest configuration for running tests against repository_after
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/tests/**/*.test.{js,jsx}"],
  moduleFileExtensions: ["js", "jsx", "json"],
  transform: {
    "^.+\\.(js|jsx)$": "babel-jest",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(@testing-library)/)"
  ],
  moduleNameMapper: {
    "\\.(css|less|scss)$": "<rootDir>/tests/__mocks__/styleMock.js"
  },
  setupFilesAfterSetup: [],
  testTimeout: 30000,
};
