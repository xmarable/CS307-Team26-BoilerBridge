/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

// mock the credentials provider as a function that returns an object
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

const { getServerSession } = (await import("next-auth")) as any;
const { getMemberPermissions } = await import("@/lib/roles");
const { default: TravelGroup } = await import("@/models/TravelGroup");
const { default: User } = await import("@/models/User");

let rolesPatch: any;

describe("role management and permissions tests", () => {
  const mockGroupId = "550e8400-e29b-41d4-a716-446655440000";

  beforeAll(async () => {
    const rolesModule =
      (await import("@/app/api/groups/[groupId]/roles/route")) as any;
    rolesPatch = rolesModule.PATCH;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * AC1: Given I am the group leader, When I open the member list,
   * Then I can toggle a user between 'Admin' and 'Viewer' status.
   */
  it("Given I am the group leader, When I open the member list, Then I can toggle a user between 'Admin' and 'Viewer' status.", async () => {
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

    expect(TravelGroup.findOneAndUpdate as any).toHaveBeenCalledWith(
      { groupID: mockGroupId, "membersList.userId": "user-2" },
      { $set: { "membersList.$.role": "Admin" } },
    );
  });

  /**
   * AC2: Given a member is a 'Viewer', When they attempt to edit,
   * Then the API blocks the request.
   */
  it("Given a member is a 'Viewer', When they attempt to edit roles, Then the API blocks the request.", async () => {
    (getServerSession as any).mockResolvedValue({
      user: { email: "viewer@test.com" },
    });

    (User.findOne as any).mockResolvedValue({ userId: "viewer-1" });

    // Mock permissions for a Viewer
    (getMemberPermissions as any).mockResolvedValue({
      roles: { isLeader: false, isAdmin: false, isViewer: true },
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

    // Expect 403 Forbidden
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toMatch(/forbidden|not authorized|only leaders/i);
  });

  /**
   * AC3: Given the group needs a new primary contact, When I transfer 'Leader' status,
   * Then my own permissions are downgraded and the new leader gains full control.
   */
  it("Given I am the leader, When I transfer status to another member, Then permissions are swapped correctly.", async () => {
    const leaderId = "leader-1";
    const newLeaderId = "user-2";

    (getServerSession as any).mockResolvedValue({
      user: { email: "leader@test.com" },
    });

    (User.findOne as any).mockResolvedValue({ userId: leaderId });

    (getMemberPermissions as any).mockResolvedValue({
      roles: { isLeader: true },
      status: 200,
    });

    const mockRequest = {
      json: (jest.fn() as any).mockResolvedValue({
        targetUserId: newLeaderId,
        action: "TRANSFER_LEADERSHIP",
      }),
    } as any;

    const context = { params: Promise.resolve({ groupId: mockGroupId }) };

    const response = await rolesPatch(mockRequest, context);
    expect(response.status).toBe(200);

    // Verify the leadership was swapped using arrayFilters to match backend logic
    expect(TravelGroup.findOneAndUpdate as any).toHaveBeenCalledWith(
      { groupID: mockGroupId },
      {
        $set: {
          leaderID: newLeaderId,
          "membersList.$[newLeader].role": "Leader",
          "membersList.$[oldLeader].role": "Admin",
        },
      },
      {
        arrayFilters: [
          { "oldLeader.userId": leaderId },
          { "newLeader.userId": newLeaderId },
        ],
      },
    );
  });
});
