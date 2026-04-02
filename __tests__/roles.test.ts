process.env.MONGODB_URI = process.env.TEST_MONGODB_URI; // Use the test database for these tests

import { jest } from "@jest/globals";

// 1. esm-compliant mocking
jest.unstable_mockModule("next-auth/providers/credentials", () => ({
  default: jest.fn(() => ({
    id: "credentials",
    name: "Credentials",
    type: "credentials",
  })),
}));

jest.unstable_mockModule("@/lib/auth", () => ({
  authOptions: {
    providers: [],
    callbacks: {},
    pages: {},
    session: { strategy: "jwt" },
  },
}));

jest.unstable_mockModule("@/lib/mongodb", () => ({
  default: Promise.resolve({
    db: () => ({
      collection: () => ({
        findOne: (jest.fn() as any).mockResolvedValue(null),
      }),
    }),
  }),
}));

jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.unstable_mockModule("@/lib/dbConnect", () => ({
  default: jest.fn(),
}));

jest.unstable_mockModule("@/models/TravelGroup", () => ({
  default: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

jest.unstable_mockModule("@/models/User", () => ({
  default: {
    findOne: jest.fn(),
  },
}));

jest.unstable_mockModule("@/lib/roles", () => ({
  getMemberPermissions: jest.fn(),
}));

// 2. dynamically import
const { getServerSession } = await import("next-auth");
const { getMemberPermissions } = await import("@/lib/roles");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { default: User } = await import("@/models/User");

let rolesPatch: any;
let tripPost: any;

describe("role management and permissions tests", () => {
  const mockGroupId = "550e8400-e29b-41d4-a716-446655440000";

  beforeAll(async () => {
    const rolesModule =
      (await import("@/app/api/groups/[groupId]/roles/route")) as any;
    const tripModule = (await import("@/app/api/trip/route")) as any;
    rolesPatch = rolesModule.PATCH;
    tripPost = tripModule.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Given I am the group leader, When I open the member list, Then I can toggle a user between 'Admin' and 'Viewer' status.", async () => {
    // verify leader can toggle member roles
    (getServerSession as any).mockResolvedValue({
      user: { email: "leader@test.com" },
    });

    (User.findOne as any).mockResolvedValue({ userId: "leader-1" });

    (getMemberPermissions as any).mockResolvedValue({
      roles: { isLeader: true },
      status: 200,
    });

    const mockRequest = {
      json: (jest.fn() as any).mockResolvedValue({
        targetUserId: "user-2",
        newRole: "Admin",
        action: "TOGGLE_ROLE",
      }),
    } as any;

    const context = { params: Promise.resolve({ groupId: mockGroupId }) };

    const response = await rolesPatch(mockRequest, context);
    expect(response.status).toBe(200);

    // check that database reflects role change
    expect(TravelGroup.findOneAndUpdate as any).toHaveBeenCalledWith(
      { groupID: mockGroupId, "membersList.userId": "user-2" },
      { $set: { "membersList.$.role": "Admin" } },
    );
  });

  it("Given a member is a 'Viewer', When they attempt to edit the itinerary, Then the UI disables all save buttons and the API blocks the request.", async () => {
    // verify api blocks viewers from editing
    (getServerSession as any).mockResolvedValue({
      user: { userId: "viewer-1" },
    });

    (getMemberPermissions as any).mockResolvedValue({
      canEdit: false,
      status: 200,
    });

    const mockTripData = {
      json: (jest.fn() as any).mockResolvedValue({
        groupID: mockGroupId,
        fromCity: "Indianapolis",
        toCity: "Chicago",
        fromDate: new Date(),
        toDate: new Date(),
        mode: "bus",
        budget: 150,
      }),
    } as any;

    const response = await tripPost(mockTripData);
    const body = await response.json();

    // block with forbidden status and specific error message
    expect(response.status).toBe(403);
    expect(body.error).toMatch(/viewers cannot/i);
  });

  it("Given the group needs a new primary contact, When I transfer 'Leader' status to another member, Then my own permissions are downgraded and the new leader gains full control.", async () => {
    // verify leadership transfer and automatic downgrade of old leader
    (getServerSession as any).mockResolvedValue({
      user: { email: "old-leader@test.com" },
    });

    (User.findOne as any).mockResolvedValue({ userId: "leader-old" });

    (getMemberPermissions as any).mockResolvedValue({
      roles: { isLeader: true },
      status: 200,
    });

    const mockRequest = {
      json: (jest.fn() as any).mockResolvedValue({
        targetUserId: "leader-new",
        action: "TRANSFER_LEADERSHIP",
      }),
    } as any;

    const context = { params: Promise.resolve({ groupId: mockGroupId }) };

    await rolesPatch(mockRequest, context);

    // ensure atomic swap with arrayfilters
    expect(TravelGroup.findOneAndUpdate as any).toHaveBeenCalledWith(
      { groupID: mockGroupId },
      {
        $set: {
          leaderID: "leader-new",
          "membersList.$[oldLeader].role": "Admin",
          "membersList.$[newLeader].role": "Leader",
        },
      },
      expect.objectContaining({
        arrayFilters: [
          { "oldLeader.userId": "leader-old" },
          { "newLeader.userId": "leader-new" },
        ],
      }),
    );
  });
});
