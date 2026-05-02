import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  roots: ["test"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
      },
    ],
  },
};

export default config;
