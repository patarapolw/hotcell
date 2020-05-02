#!/bin/bash

cd packages/server && npm i
cd -
cd packages/web && npm i
cd -
cd packages/electron && npm i
npm run build
npm run release -- -wl