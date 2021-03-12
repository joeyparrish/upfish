#!/bin/bash

rm -rf dist/
mkdir dist/

cat $(ls src/lib/* | grep -v worklet) src/upfish.js | \
  sed -e 's/^export //' | \
  grep -v '^import ' > dist/upfish.bundle.js

cp src/lib/karaoke-worklet.js dist/
cp extension/* dist/

cp README.md LICENSE.md dist/

cp -a configs/ dist/

convert upfish.svg -scale 128x128 dist/upfish.png
