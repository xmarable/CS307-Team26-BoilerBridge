#!/bin/bash

NODE_ENV=test NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest \
  --config=jest.config.cjs \
  --forceExit \
  --colors \
  --verbose \
  --no-coverage \
  "__tests__/calendarReorder.test.ts" \
  "__tests__/api/groups/member-removal.test.ts" \
  "__tests__/api/groups/itineraryVote.test.ts" \
  "__tests__/Lockdownmode.test.ts" \
  2>&1