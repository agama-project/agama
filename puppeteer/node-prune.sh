#! /bin/bash

# This script clean up the node_modules directory which is usually huge and
# contains a lot of not needed files. It was inspired by the node-prune tool
# (https://github.com/tj/node-prune).
#
# Usage:
#
#     node-prune.sh [path]
#
# The optional [path] argument is a path to the node_modules directory, if it is
# not specified it uses node_modules in the current directory.
#
# This is a generic tool, you might run it against any node_modules directory,
# not only in Agama Puppeteer tests.

MODULES_PATH="${1:-./node_modules}"

# The list of names/patterns comes from 
# https://github.com/tj/node-prune/blob/master/internal/prune/prune.go

# files to delete
FILES=(
  Jenkinsfile
  Makefile
  Gulpfile.js
  Gruntfile.js
  gulpfile.js
  .DS_Store
  .tern-project
  .gitattributes
  .editorconfig
  .eslintrc
  eslint
  .eslintrc.js
  .eslintrc.json
  .eslintrc.yml
  .eslintignore
  .stylelintrc
  stylelint.config.js
  .stylelintrc.json
  .stylelintrc.yaml
  .stylelintrc.yml
  .stylelintrc.js
  .htmllintrc
  htmllint.js
  .lint
  .npmrc
  .npmignore
  .jshintrc
  .flowconfig
  .documentup.json
  .yarn-metadata.json
  .travis.yml
  appveyor.yml
  .gitlab-ci.yml
  circle.yml
  .coveralls.yml
  CHANGES
  changelog
  LICENSE.txt
  LICENSE
  LICENSE-MIT
  LICENSE.BSD
  license
  LICENCE.txt
  LICENCE
  LICENCE-MIT
  LICENCE.BSD
  licence
  AUTHORS
  CONTRIBUTORS
  .yarn-integrity
  .yarnclean
  _config.yml
  .babelrc
  .yo-rc.json
  jest.config.js
  karma.conf.js
  wallaby.js
  wallaby.conf.js
  .prettierrc
  .prettierrc.yml
  .prettierrc.toml
  .prettierrc.js
  .prettierrc.json
  prettier.config.js
  .appveyor.yml
  tsconfig.json
  tslint.json
)

# directories to delete
DIRECTORIES=(
  test
  tests
  powered-test
  docs
  doc
  .idea
  .vscode
  website
  images
  assets
  example
  examples
  coverage
  .nyc_output
  .circleci
  .github
)

# delete files with specific extensions
EXTENSIONS=(
  markdown
  md
  mkd
  ts
  jst
  coffee
  tgz
  swp
)

# delete additional files with specific extensions (not deleted by the original
# node-prune tool)
EXTRA_EXTENSIONS=(
  # The map files take almost half of the node_modules content! An they would be
  # useful only for reporting bugs in Puppeteer itself or in some dependent
  # library.
  map
)

echo -n "Before cleanup: "
du -h -s "$MODULES_PATH" | cut -f1

# delete files
for F in "${FILES[@]}"; do
  find "$MODULES_PATH" -type f -name "$F" -delete
done

# delete directories recursively
for D in "${DIRECTORIES[@]}"; do
  find "$MODULES_PATH" -type d -name "$D" -prune -exec rm -rf \{\} \;
done

# delete files with specific extenstions
for E in "${EXTENSIONS[@]}"; do
  find "$MODULES_PATH" -type f -name "*.$E" -delete
done

# delete additional files with extensions
for EE in "${EXTRA_EXTENSIONS[@]}"; do
  find "$MODULES_PATH" -type f -name "*.$EE" -delete
done

echo -n "After cleanup:  "
du -h -s "$MODULES_PATH" | cut -f1
