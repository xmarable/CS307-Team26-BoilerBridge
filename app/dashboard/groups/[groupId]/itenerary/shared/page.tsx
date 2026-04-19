import { SharedItenerary } from "@/components/SharedItenerary";
import dbConnect from "@/lib/dbConnect";
import Itenerary from "@/models/Itenerary";
import TravelGroup from "@/models/TravelGroup";

export default async function SharedIteneraryPage({ params, searchParams }: { params: Promise<{ groupId: string }>, searchParams: Promise<{ token?: string }>}) {
  const { groupId } = await params;
  const token = (await searchParams).token;

  if (!token) {
    return (
      <div>
        <SharedItenerary initialData={null}/>
      </div>
    );
  }

  await dbConnect();
  const group = await TravelGroup.findOne({ groupID: groupId });
  if (!group) {
    return (
      <div>
        <SharedItenerary initialData={null}/>
      </div>
    );
  }

  const itenerary = await Itenerary.findOne({ iteneraryID: group.iteneraryId });
  if (!itenerary || itenerary.token !== token) {
    return (
      <div>
        <SharedItenerary initialData={null}/>
      </div>
    );
  }

  return (
      <div>
        <SharedItenerary initialData={itenerary}/>
      </div>
  );
}