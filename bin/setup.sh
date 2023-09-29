#! /bin/bash

echo -n "setting up git hooks... "
cp git-hooks/* .git/hooks && echo "DONE"

npm install
