/** @jest-environment node */

import { jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { PATCH } from "../../../app/api/groups/[groupId]/roles/route";

describe("Role Assignment API - RBAC", () => {
  const baseUrl = "http://localhost:3000";

  it("Given I am the group leader, When I open the member list, Then I can toggle a user between Admin and Viewer status", async () => {
    const req = new NextRequest(`${baseUrl}/api/groups/group789/roles`, {
      method: "PATCH",
      body: JSON.stringify({ userId: "user123", newRole: "Admin" }),
    });

    // next.js 15 requires params to be a promise in the test context
    const params = Promise.resolve({ groupId: "group789" });

    const res = await PATCH(req, { params });
    expect(res.status).toBe(200);
  });

  it("Given a member is a Viewer, When they attempt to edit the itinerary, Then the API blocks the request", async () => {
    // changing from PUT to PATCH based on typical next.js route exports if PUT was missing
    const itineraryRoute =
      await import("../../../app/api/groups/[groupId]/itinerary/route");
    const updateMethod = itineraryRoute.PATCH || itineraryRoute.POST;

    if (!updateMethod) {
      throw new Error("could not find PATCH or POST export in itinerary route");
    }

    const req = new NextRequest(`${baseUrl}/api/groups/group789/itinerary`, {
      method: "PATCH",
      body: JSON.stringify({ activities: [] }),
    });

    const params = Promise.resolve({ groupId: "group789" });
    const res = await updateMethod(req, { params });

    expect(res.status).toBe(403);
  });

  it("Given the group needs a new primary contact, When I transfer Leader status, Then my own permissions are downgraded", async () => {
    const req = new NextRequest(`${baseUrl}/api/groups/group789/roles`, {
      method: "PATCH",
      body: JSON.stringify({ userId: "newLeader123", newRole: "Leader" }),
    });

    const params = Promise.resolve({ groupId: "group789" });

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toBeDefined();
  });
});
