import { generateRainyDayPlan } from "./rainyDayEngine";

// mock activities to fill the gaps until we get the real api
const MOCK_ACTIVITIES = [
  { name: "Morning Park Walk", category: "Nature", isOutdoor: true },
  { name: "Downtown Sightseeing", category: "Tourism", isOutdoor: true },
  { name: "Visit Local Museum", category: "Culture", isOutdoor: false },
  { name: "Beach Hangout", category: "Leisure", isOutdoor: true },
];

export const createInitialItinerary = (fromDate: Date, toDate: Date) => {
  // just creating 1 activity per day for the mock
  const days =
    Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
    ) || 1;

  const primary = Array.from({ length: days }).map((_, i) => {
    const activity = MOCK_ACTIVITIES[i % MOCK_ACTIVITIES.length];
    const date = new Date(fromDate);
    date.setDate(date.getDate() + i);

    return {
      ...activity,
      activityId: `mock-${i}`,
      startTime: new Date(date.setHours(10, 0)),
      endTime: new Date(date.setHours(12, 0)),
    };
  });

  // Task 1: Generate the backup plan simultaneously
  const rainyDay = generateRainyDayPlan(primary);

  return { primary, rainyDay };
};
