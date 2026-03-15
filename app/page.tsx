import { cookies } from "next/headers";
import { HomePageClient } from "./home-page-client";

export default async function Home() {
  const cookieStore = await cookies();
  const initialHasAccessToken = cookieStore.has("access_token");

  return <HomePageClient initialHasAccessToken={initialHasAccessToken} />;
}
