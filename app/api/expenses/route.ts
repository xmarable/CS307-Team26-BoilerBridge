

export async function GET() {
  return new Response(
    JSON.stringify({
      message: "Welcome to the Expenses API route!",
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
}
