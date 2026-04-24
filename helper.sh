#!/bin/bash

MONGO_URI=$(grep '^MONGODB_URI=' .env.local | cut -d '=' -f2-)

if [ -z "$1" ]; then
  echo "usage: ./dev.sh --mongo | --test"
  exit 1
fi

if [ "$1" == "--mongo" ]; then
  npx mongosh "$MONGO_URI"
  exit 0
fi

if [ "$1" == "--test" ]; then
  export JEST_CMD="NODE_ENV=test NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest --config=jest.config.cjs --runInBand --forceExit --colors --verbose"

  echo "🚀 starting sprint 2 tests for xavion..."

  eval $JEST_CMD __tests__/SOSButton.test.tsx && \
  eval $JEST_CMD __tests__/GroupBoard.test.tsx && \
  eval $JEST_CMD __tests__/api/groups/roles.test.ts && \
  eval $JEST_CMD __tests__/ExternalBooking.test.tsx && \
  eval $JEST_CMD __tests__/vibeTagsLogic.test.ts && \
  eval $JEST_CMD __tests__/BagStorage.test.tsx && \
  eval $JEST_CMD __tests__/TravelReminders.test.tsx && \
  eval $JEST_CMD __tests__/RainyDayToggle.test.tsx && \
  eval $JEST_CMD __tests__/rainyDayLogic.test.ts

  if [ $? -eq 0 ]; then
    echo "✅ all 202 tests passed in order lol"
  else
    echo "❌ sprint tests failed"
    exit 1
  fi
  exit 0
fi

echo "unknown argument: $1"
echo "usage: ./dev.sh --mongo | --test"
exit 1