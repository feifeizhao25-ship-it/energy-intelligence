module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^server-only$': '<rootDir>/src/test-shims/server-only.js',
    },
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
};
