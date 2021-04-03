module.exports = {
  'extends': ['eslint:recommended', 'google'],
  env: {
    es2017: true,
  },
  rules: {
    'no-unused-vars': ['error', {
      // Some methods are implementing an interface, so ignore unused
      // function/method arguments.
      args: 'none',
    }],
  },
  overrides: [
    {
      files: ['gulpfile.js', '.eslintrc.js'],
      env: {
        node: true,
      },
    },
    {
      files: ['extension/*.js'],
      env: {
        browser: true,
        serviceworker: true,
        webextensions: true,
      },
    },
    {
      files: ['main.js', 'src/*.js', 'src/lib/*.js'],
      parserOptions: {
        sourceType: 'module',
      },
      env: {
        browser: true,
        webextensions: true,
      },
    },
  ],
};
