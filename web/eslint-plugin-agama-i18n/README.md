# The ESLint Plugin

This directory contains an ESLint plugin which checks that only string literals
are passed to the translation functions.

It is bundled here because it is closely tied to the Agama project and probably
does not make sense for other projects.

## Disabling the Check

In some rare cases using a variable instead of a string literal is correct. In
that case disable the check locally:

```js
const SIZES = [ N_("small"), N_("medium"), N_("large") ];

// returns one of the sizes above
const sz = getSize();

// eslint-disable-next-line agama-i18n/string-literals
return <span>{_(sz)}</span>;
```

## Links

- https://eslint.org/docs/latest/extend/custom-rule-tutorial - tutorial for
  writing an ESLint plugin
- https://eslint.org/docs/latest/extend/custom-rules - documentation for
  writing an ESLint plugin
- https://astexplorer.net - online tool for browsing a parsed AST tree,
  useful for inspecting the properties of parsed source code
