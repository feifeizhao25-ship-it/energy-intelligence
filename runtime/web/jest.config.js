module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^server-only$': '<rootDir>/src/test-shims/server-only.js',
        '\\.(css|less)$': '<rootDir>/src/test-shims/style-mock.js',
    },
    testPathIgnorePatterns: ['/node_modules/', '/.next/'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
};
