#!/bin/bash

#tree -I "node_modules|models|docs|.husky|.github|.devcontainer" # see current directory structure
#echo "Current directory structure above, excluding node_modules, models, docs, .husky, .github, and .devcontainer directories."

# define the base command with all your NODE_OPTIONS and flags
export JEST_CMD="NODE_ENV=test NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest --config=jest.config.cjs --runInBand --forceExit --colors --verbose"

echo "🚀 starting sprint 2 tests for xavion..."

# run each test suite in order. if one fails, the script stops (&&)
eval $JEST_CMD __tests__/SOSButton.test.tsx && \
eval $JEST_CMD __tests__/GroupBoard.test.tsx && \
eval $JEST_CMD __tests__/roles.test.ts && \
eval $JEST_CMD __tests__/api/groups/roles.test.ts && \
eval $JEST_CMD __tests__/ExternalBooking.test.tsx && \
eval $JEST_CMD __tests__/vibeTagsLogic.test.ts && \
eval $JEST_CMD __tests__/BagStorage.test.tsx && \
eval $JEST_CMD __tests__/TravelReminders.test.tsx && \
eval $JEST_CMD __tests__/RainyDayToggle.test.tsx && \
eval $JEST_CMD __tests__/rainyDayLogic.test.ts

# check if everything passed
if [ $? -eq 0 ]; then
  echo "✅ all 202 tests passed in order lol"
else
  echo "❌ sprint tests failed"
  exit 1
fi