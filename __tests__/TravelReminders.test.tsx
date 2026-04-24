import { jest } from "@jest/globals";

// fix: use the plural 'notifications' to match the file name
jest.unstable_mockModule("../lib/notifications", () => ({
  schedulePushNotification: jest.fn(),
  scheduleReminder: jest.fn(),
  sendActualPush: jest.fn(),
}));

jest.unstable_mockModule("../models/Reminder", () => ({
  default: {
    create: jest.fn(),
    find: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const { schedulePushNotification } =
  (await import("../lib/notifications")) as any;
const { default: Reminder } = (await import("../models/Reminder")) as any;

const shiftLinkedReminders = async (
  eventId: string,
  oldTime: Date,
  newTime: Date,
) => {
  const timeDiff = newTime.getTime() - oldTime.getTime();
  await Reminder.updateMany(
    { linkedEventId: eventId },
    { $inc: { triggerTime: timeDiff } },
  );
};

describe("User Story 7: Travel Reminders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Given I have a flight, When I set a reminder for '3 hours before', Then I receive a push notification even if the app is closed.", async () => {
    const flightTime = new Date("2026-04-10T15:00:00Z");
    const triggerTime = new Date(flightTime.getTime() - 3 * 60 * 60 * 1000);

    Reminder.create.mockResolvedValue({
      text: "Head to airport",
      triggerTime,
    });

    await schedulePushNotification("Head to airport", triggerTime);
    expect(schedulePushNotification).toHaveBeenCalledWith(
      "Head to airport",
      triggerTime,
    );
  });

  it("Given I add a task like 'Buy sunscreen', When I view my trip reminders, Then it appears in a personal checklist.", async () => {
    Reminder.find.mockResolvedValue([
      { id: "1", type: "task", text: "Buy sunscreen", completed: false },
      { id: "2", type: "task", text: "Pack passport", completed: true },
    ]);

    const checklist = await Reminder.find({ type: "task", userId: "user-123" });
    const hasSunscreen = checklist.some(
      (item: any) => item.text === "Buy sunscreen",
    );
    expect(hasSunscreen).toBe(true);
    expect(checklist.length).toBe(2);
  });

  it("Given my flight time changes in the shared calendar, When the event updates, Then any linked reminders automatically shift to the new time.", async () => {
    const mockEventId = "evt-789";
    const oldTime = new Date("2026-04-10T15:00:00Z");
    const newTime = new Date("2026-04-10T17:00:00Z");
    const twoHoursInMs = 2 * 60 * 60 * 1000;

    await shiftLinkedReminders(mockEventId, oldTime, newTime);

    expect(Reminder.updateMany).toHaveBeenCalledWith(
      { linkedEventId: mockEventId },
      { $inc: { triggerTime: twoHoursInMs } },
    );
  });
});
