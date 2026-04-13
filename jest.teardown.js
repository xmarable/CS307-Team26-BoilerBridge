import { disconnect } from "mongoose";

// eslint-disable-next-line import/no-anonymous-default-export
export default async () => {
  await disconnect();
  console.log("👋 all db connections closed");

  // give it a tiny bit of time to log and then kill the process
  if (process.env.NODE_ENV === "test") {
    process.exit(0);
  }
};
