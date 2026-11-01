import { getCurrentUser } from "@/lib/dal";
import { AuthButton } from "./AuthButton";

/** Server component: reads the session and hands only the name and role to the client button. */
export async function AuthMenu() {
  const user = await getCurrentUser();
  return <AuthButton user={user && { name: user.name, role: user.role }} />;
}
