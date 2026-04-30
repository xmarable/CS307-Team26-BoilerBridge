export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import Trip from "@/models/Trip";
import User from "@/models/User";
import { Dashboard } from "@/components/Dashboard";
import { buildUnsplashQuery, fetchUnsplashImage } from "@/lib/travel/unsplash";

type DashboardGroup = {
  groupImage?: string | null;
  destination?: string | null;
  groupName?: string | null;
  groupID?: string;
  _id?: string;
  [key: string]: unknown;
};

type TripActivity = {
  name?: string;
  startTime?: Date | string;
  endTime?: Date | string;
  location?: string;
};

type TripLean = {
  groupID?: string;
  fromCity?: string;
  toCity?: string;
  fromDate?: Date;
  toDate?: Date;
  primaryItinerary?: TripActivity[];
};

type DashboardScheduleItem = {
  id: string;
  groupId: string;
  groupName: string;
  destination: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
};

function getUpcomingWindowMs() {
  const nowMs = Date.now();
  return {
    nowMs,
    endOfWindowMs: nowMs + 7 * 24 * 60 * 60 * 1000,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    redirect("/signin");
  }

  await dbConnect();

  // 1. Fetch user data using Mongoose to get the UUID (userId)
  const userData = await User.findOne(
    { email: session.user.email },
    { name: 1, username: 1, image: 1, userId: 1 },
  ).lean();

  if (!userData) {
    redirect("/signin");
  }

  // 2. Fetch all groups where the user is a member
  const userGroups = await TravelGroup.find({
    "membersList.userId": userData.userId,
  }).lean();

  const groupIds = userGroups
    .map((group) => String(group.groupID || group._id || ""))
    .filter((groupId) => groupId.length > 0);

  const tripDocs =
    groupIds.length > 0
      ? ((await Trip.find({ groupID: { $in: groupIds } })
          .sort({ createdAt: -1 })
          .lean()) as TripLean[])
      : [];

  const latestTripByGroup = new Map<string, TripLean>();
  for (const trip of tripDocs) {
    const groupId = String(trip.groupID || "");
    if (groupId && !latestTripByGroup.has(groupId)) {
      latestTripByGroup.set(groupId, trip);
    }
  }

  const { nowMs, endOfWindowMs } = getUpcomingWindowMs();

  const upcomingSchedule = tripDocs
    .flatMap((trip) => {
      const groupId = String(trip.groupID || "");
      const group = userGroups.find(
        (candidate) =>
          String(candidate.groupID || candidate._id || "") === groupId,
      ) as DashboardGroup | undefined;
      const destination =
        trip.toCity?.trim() ||
        group?.destination?.trim() ||
        "Trip destination TBD";
      const activities = Array.isArray(trip.primaryItinerary)
        ? trip.primaryItinerary
        : [];

      return activities.flatMap((activity, index) => {
        const startSource = activity.startTime ?? trip.fromDate;
        if (!startSource) return [];

        const startDate = new Date(startSource);
        if (Number.isNaN(startDate.getTime())) return [];
        if (startDate.getTime() < nowMs || startDate.getTime() > endOfWindowMs)
          return [];

        const endDate = activity.endTime
          ? new Date(activity.endTime)
          : undefined;
        return [
          {
            id: `${groupId}-${index}-${startDate.toISOString()}`,
            groupId,
            groupName: group?.groupName || "Trip",
            destination,
            title: activity.name?.trim() || "Trip activity",
            startTime: startDate.toISOString(),
            endTime:
              endDate && !Number.isNaN(endDate.getTime())
                ? endDate.toISOString()
                : undefined,
            location: activity.location?.trim() || undefined,
          } satisfies DashboardScheduleItem,
        ];
      });
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 6);

  const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  const unsplashImagePromises = new Map<string, Promise<string | null>>();

  const groupsWithImages = await Promise.all(
    (userGroups as DashboardGroup[]).map(async (group) => {
      const groupId = String(group.groupID || group._id || "");
      const trip = latestTripByGroup.get(groupId);
      const tripDestination = trip?.toCity?.trim() || null;
      const tripOrigin = trip?.fromCity?.trim() || null;
      // Count activities from the trip's primaryItinerary
      const activitiesCount = Array.isArray(trip?.primaryItinerary)
        ? trip.primaryItinerary.length
        : 0;

      const enrichedGroup = {
        ...group,
        tripFromCity: tripOrigin,
        tripToCity: tripDestination,
        activitiesCount,
      };

      // Skip Unsplash API call if group already has an image
      if (group.groupImage) return enrichedGroup;

      const query = buildUnsplashQuery([
        tripDestination,
        group.groupName,
        "travel",
      ]);

      if (!unsplashAccessKey) return enrichedGroup;

      const cached =
        unsplashImagePromises.get(query) ??
        unsplashImagePromises
          .set(
            query,
            fetchUnsplashImage(query, unsplashAccessKey).then(
              (image) => image?.url ?? null,
            ),
          )
          .get(query)!;

      const groupImage = await cached;

      if (!groupImage) return enrichedGroup;

      return {
        ...enrichedGroup,
        groupImage,
        groupImageSource: "unsplash",
        groupImageQuery: query,
      };
    }),
  );

  // 3. Clean the data for the Client Component
  const initialData = JSON.parse(
    JSON.stringify({
      displayName: userData.name || userData.username || "Boilermaker",
      profileImage: userData.image || null,
      groups: groupsWithImages, // Passing real groups to the Dashboard component
      upcomingSchedule,
    }),
  );

  return <Dashboard initialData={initialData} />;
}
