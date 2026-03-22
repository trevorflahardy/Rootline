import { UserProfile } from "@clerk/nextjs";
import { Header } from "@/components/layout/header";

export const metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <UserProfile
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-none border",
            },
          }}
        />
      </main>
    </>
  );
}
