module.exports = {
  "parser": "babel-eslint",
  "parserOptions": {
    "sourceType": "script"
  },
  "plugins": [
    "lodash-fp",
  ],
  "extends": [
    "airbnb",
    // "plugin:lodash-fp/recommended",
  ],
  "rules": {
    "arrow-parens": 0, // allow async functions
    "no-multi-spaces": [2, {
      "exceptions": {
        "VariableDeclarator": true,
        "ImportDeclaration": true
      }
    }],
    "jsx-a11y/href-no-hash": "off",
    "max-len": 0,
  },
  "env": {
    "mocha": true
  },
};
