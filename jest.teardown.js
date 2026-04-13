import mongoose from "mongoose";

const teardown = async () => {
  try {
    // wait for mongoose to close everything properly
    await mongoose.connection.close();
    await mongoose.disconnect();

    console.log("👋 all db connections closed");
  } catch (err) {
    console.error("error during teardown:", err);
  }
  // DO NOT use process.exit(0) here
};

export default teardown;
