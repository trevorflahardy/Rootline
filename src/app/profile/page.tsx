import { UserProfile } from "@clerk/nextjs";
import { Header } from "@/components/layout/header";
import { TreeVisualSettings } from "@/components/profile/tree-visual-settings";
import { getProfile } from "@/lib/actions/profile";

export const metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const profile = await getProfile();

  return (
    <>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 space-y-6">
        <div className="glass-card glass-edge-top glass-edge-left p-6 rounded-xl text-foreground">
          <TreeVisualSettings
            initialDescendantHighlightDepth={profile?.descendant_highlight_depth ?? 1}
          />
        </div>
        <div className="glass-card glass-edge-top glass-edge-left p-6 rounded-xl">
          <UserProfile
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-none border-0 bg-transparent",
              },
            }}
          />
        </div>
      </main>
    </>
  );
}
