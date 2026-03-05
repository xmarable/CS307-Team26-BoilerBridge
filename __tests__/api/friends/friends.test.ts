/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";

jest.unstable_mockModule("next-auth/providers/credentials", () => ({
  default: jest.fn<any>(() => ({
    id: "credentials",
    name: "Credentials",
    type: "credentials",
  })),
}));

jest.unstable_mockModule("next-auth", () => ({
  getServerSession: jest.fn<any>().mockResolvedValue({
    user: { userId: "user-a", id: "object-id-a" },
  }),
}));

const mockFriendRequestSave = jest.fn<any>();
const mockFriendRequestConstructor = jest.fn<any>((data: any) => ({
  ...data,
  save: mockFriendRequestSave,
})) as any;

(mockFriendRequestConstructor as any).findOne = jest.fn<any>();
(mockFriendRequestConstructor as any).find = jest.fn<any>();
(mockFriendRequestConstructor as any).create = jest.fn<any>();
(mockFriendRequestConstructor as any).deleteOne = jest.fn<any>();
(mockFriendRequestConstructor as any).findOneAndUpdate = jest.fn<any>();

jest.unstable_mockModule("@/models/FriendRequest", () => ({
  default: mockFriendRequestConstructor,
}));

const mockUserFindOne = jest.fn<any>();
const mockUserFindById = jest.fn<any>();
const mockUserFindOneAndUpdate = jest.fn<any>();

jest.unstable_mockModule("@/models/User", () => ({
  default: {
    findOne: mockUserFindOne,
    findById: mockUserFindById,
    findOneAndUpdate: mockUserFindOneAndUpdate,
  },
}));

jest.unstable_mockModule("@/lib/dbConnect", () => ({
  default: jest.fn<any>().mockResolvedValue(true),
}));

const { DELETE: removeFriendDELETE } =
  await import("@/app/api/friends/remove/route");
const {
  GET: requestGET,
  POST: requestPOST,
  DELETE: declineRequestDELETE,
} = await import("@/app/api/friends/request/route");

describe("friend system api routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("friends/remove", () => {
    it("removes friend using friendId from body", async () => {
      mockUserFindOneAndUpdate.mockResolvedValue(true);

      const req = new Request("http://localhost/api/friends/remove", {
        method: "DELETE",
        body: JSON.stringify({ friendId: "user-b" }),
      });

      const res = await removeFriendDELETE(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Friend removed");
      expect(mockUserFindOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    it("blocks self-removal", async () => {
      const req = new Request("http://localhost/api/friends/remove", {
        method: "DELETE",
        body: JSON.stringify({ friendId: "user-a" }),
      });

      const res = await removeFriendDELETE(req);
      expect(res.status).toBe(400);
    });
  });

  describe("friends/request (GET)", () => {
    it("returns formatted pending requests", async () => {
      mockUserFindById.mockResolvedValue({ userId: "user-a" });
      (mockFriendRequestConstructor as any).find.mockReturnValue({
        lean: jest
          .fn<any>()
          .mockResolvedValue([
            { requestId: "req-1", requesterId: "user-b", status: "pending" },
          ]),
      });
      mockUserFindOne.mockReturnValue({
        select: jest.fn<any>().mockReturnThis(),
        lean: jest.fn<any>().mockResolvedValue({ username: "sender_user" }),
      });

      const res = await requestGET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json[0].senderName).toBe("sender_user");
    });
  });

  describe("friends/request (POST)", () => {
    it("sends a new friend request successfully", async () => {
      mockUserFindOne.mockResolvedValue({
        userId: "user-a",
        username: "xavy",
        friendsList: [],
      });
      (mockFriendRequestConstructor as any).findOne.mockResolvedValue(null);
      (mockFriendRequestConstructor as any).create.mockResolvedValue({
        requestId: "new-id",
      });

      const req = new Request("http://localhost/api/friends/request", {
        method: "POST",
        body: JSON.stringify({ recipientId: "user-b" }),
      });

      const res = await requestPOST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Friend request sent");
    });

    it("auto-accepts if a mutual request exists", async () => {
      mockUserFindOne.mockResolvedValue({ userId: "user-a", friendsList: [] });
      (mockFriendRequestConstructor as any).findOne.mockResolvedValue({
        status: "pending",
        save: mockFriendRequestSave,
      });

      const req = new Request("http://localhost/api/friends/request", {
        method: "POST",
        body: JSON.stringify({ recipientId: "user-b" }),
      });

      const res = await requestPOST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.isAccepted).toBe(true);
      expect(mockUserFindOneAndUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe("friends/request (DELETE)", () => {
    it("declines/deletes a friend request", async () => {
      (mockFriendRequestConstructor as any).deleteOne.mockResolvedValue({
        deletedCount: 1,
      });

      const req = new Request("http://localhost/api/friends/request", {
        method: "DELETE",
        body: JSON.stringify({ requestId: "req-123" }),
      });

      const res = await declineRequestDELETE(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Request declined");
    });
  });
});
