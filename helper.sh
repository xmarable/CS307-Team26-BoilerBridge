#!/bin/bash

tree -I "node_modules|models|docs|.husky|.github|.devcontainer" # see current directory structure
echo "Current directory structure above, excluding node_modules, models, docs, .husky, .github, and .devcontainer directories."