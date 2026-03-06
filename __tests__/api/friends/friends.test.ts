/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * These tests use jest.unstable_mockModule (Jest 29+). On Jest 25 the suite is skipped.
 */
import { jest } from "@jest/globals";

const hasUnstableMockModule =
  typeof (jest as any).unstable_mockModule === "function";

// explicitly cast the mock functions to any to fix typescript never errors
const mockFriendRequestSave = jest.fn() as any;
const mockFriendRequestConstructor = jest.fn(() => ({
  save: mockFriendRequestSave,
})) as any;
mockFriendRequestConstructor.findOne = jest.fn() as any;

if (hasUnstableMockModule) {
  (jest as any).unstable_mockModule("@/models/FriendRequest", () => ({
    default: mockFriendRequestConstructor,
  }));
}

// explicitly cast the user mock functions to any
const mockUserFindOne = jest.fn() as any;
const mockUserFindOneAndUpdate = jest.fn() as any;

if (hasUnstableMockModule) {
  (jest as any).unstable_mockModule("@/models/User", () => ({
    default: {
      findOne: mockUserFindOne,
      findOneAndUpdate: mockUserFindOneAndUpdate,
    },
  }));
}

let POST: (req: Request) => Promise<Response>;
let PATCH: (req: Request) => Promise<Response>;
let DELETE: (req: Request) => Promise<Response>;

beforeAll(async () => {
  if (!hasUnstableMockModule) return;
  const requestRoute = await import("@/app/api/friends/request/route");
  POST = requestRoute.POST;
  const acceptRoute = await import("@/app/api/friends/accept/route");
  PATCH = acceptRoute.PATCH;
  const removeRoute = await import("@/app/api/friends/remove/route");
  DELETE = removeRoute.DELETE;
});

const describeFriendApi = hasUnstableMockModule ? describe : describe.skip;
describeFriendApi("friend system api routes", () => {
  // reset mocks before every test execution
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // group tests for the post request route
  describe("post /api/friends/request", () => {
    // test successful pending request creation
    it("creates a pending request when valid ids are provided", async () => {
      mockUserFindOne.mockResolvedValue({ friends: [] });
      mockFriendRequestConstructor.findOne.mockResolvedValue(null);
      mockFriendRequestSave.mockResolvedValue(true);

      const req = new Request("http://localhost/api/friends/request", {
        method: "POST",
        body: JSON.stringify({ requesterId: "user-a", recipientId: "user-b" }),
      });

      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockFriendRequestSave).toHaveBeenCalled();
    });

    // test self adding block
    it("blocks users from adding themselves", async () => {
      mockUserFindOne.mockResolvedValue({ friends: [] });
      mockFriendRequestConstructor.findOne.mockResolvedValue(null);

      const req = new Request("http://localhost/api/friends/request", {
        method: "POST",
        body: JSON.stringify({ requesterId: "user-a", recipientId: "user-a" }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Cannot send friend request to yourself");
    });

    // test existing friendship block
    it("blocks the request if already friends", async () => {
      mockUserFindOne.mockResolvedValue({
        userId: "user-a",
        friends: ["user-b"],
      });

      const req = new Request("http://localhost/api/friends/request", {
        method: "POST",
        body: JSON.stringify({ requesterId: "user-a", recipientId: "user-b" }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Already friends");
    });

    // test existing pending request block
    it("blocks if request already exists", async () => {
      mockUserFindOne.mockResolvedValue({ friends: [] });
      mockFriendRequestConstructor.findOne.mockResolvedValue({
        requestId: "exists",
      });

      const req = new Request("http://localhost/api/friends/request", {
        method: "POST",
        body: JSON.stringify({ requesterId: "user-a", recipientId: "user-b" }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Friend request already exists");
    });
  });

  // group tests for the patch accept route
  describe("patch /api/friends/accept", () => {
    // test successful acceptance
    it("accepts a pending request and updates the user", async () => {
      mockFriendRequestSave.mockResolvedValue(true);

      mockFriendRequestConstructor.findOne.mockResolvedValue({
        requestId: "req-123",
        requesterId: "user-a",
        recipientId: "user-b",
        status: "pending",
        save: mockFriendRequestSave,
      });

      mockUserFindOneAndUpdate.mockResolvedValue(true);

      const req = new Request("http://localhost/api/friends/accept", {
        method: "PATCH",
        body: JSON.stringify({ requestId: "req-123" }),
      });

      const res = await PATCH(req);

      expect(mockFriendRequestSave).toHaveBeenCalled();
      // the provided patch api updates only one user list right now
      expect(mockUserFindOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(200);
    });

    // test not found error
    it("returns 404 if request is not found", async () => {
      mockFriendRequestConstructor.findOne.mockResolvedValue(null);

      const req = new Request("http://localhost/api/friends/accept", {
        method: "PATCH",
        body: JSON.stringify({ requestId: "req-123" }),
      });

      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Friend request not found");
    });

    // test missing id error
    it("returns 400 if requestId is missing", async () => {
      const req = new Request("http://localhost/api/friends/accept", {
        method: "PATCH",
        body: JSON.stringify({}),
      });

      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Missing requestId");
    });
  });

  // group tests for the delete remove route
  describe("delete /api/friends/remove", () => {
    // test successful removal
    it("removes both users from each others lists", async () => {
      mockUserFindOneAndUpdate.mockResolvedValue(true);

      const req = new Request("http://localhost/api/friends/remove", {
        method: "DELETE",
        body: JSON.stringify({ userOneId: "user-a", userTwoId: "user-b" }),
      });

      const res = await DELETE(req);

      expect(res.status).toBe(200);
      // the provided delete api updates two user lists
      expect(mockUserFindOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    // test self removal block
    it("blocks users from removing themselves", async () => {
      const req = new Request("http://localhost/api/friends/remove", {
        method: "DELETE",
        body: JSON.stringify({ userOneId: "user-a", userTwoId: "user-a" }),
      });

      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid Operation");
    });

    // test missing ids error
    it("returns 400 if user ids are missing", async () => {
      const req = new Request("http://localhost/api/friends/remove", {
        method: "DELETE",
        body: JSON.stringify({}),
      });

      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Missing user IDs");
    });
  });
});
