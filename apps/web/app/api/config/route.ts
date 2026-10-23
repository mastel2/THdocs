import { providers } from "../../../lib/server";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ providers: providers() });
}
