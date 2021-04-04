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
    // TODO: Add jsdoc everywhere
    'require-jsdoc': 'off',
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
      parserOptions: {
        sourceType: 'module',
      },
      env: {
        browser: true,
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
