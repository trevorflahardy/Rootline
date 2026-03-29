"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;
import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { Menu, TreePine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { cn } from "@/lib/utils/cn";

const navLinks = [{ href: "/dashboard", label: "Dashboard" }];

export function Header() {
  const { isSignedIn, isLoaded } = useAuth();
  const pathname = usePathname();
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <header className="glass-card glass-heavy glass-edge-top sticky top-0 z-50 w-full !rounded-none !border-x-0 !border-t-0">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link href={isSignedIn ? "/dashboard" : "/"} className="mr-6 flex items-center gap-2">
          <TreePine className="text-primary h-6 w-6" />
          <span className="text-foreground font-[family-name:var(--font-playfair)] text-lg font-semibold">
            Rootline
          </span>
        </Link>

        {/* Desktop nav */}
        {isSignedIn && (
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />

          {mounted &&
            isLoaded &&
            (isSignedIn ? (
              <>
                <NotificationBell />
                <UserMenu />
              </>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <SignInButton mode="modal">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button size="sm">Get Started</Button>
                </SignUpButton>
              </div>
            ))}

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="bg-background/95 border-border/50 w-72 backdrop-blur-xl"
            >
              <SheetTitle className="mb-6 flex items-center gap-2">
                <TreePine className="text-primary h-5 w-5" />
                <span className="text-foreground font-[family-name:var(--font-playfair)] font-semibold">
                  Rootline
                </span>
              </SheetTitle>
              <nav className="flex flex-col gap-2">
                {mounted &&
                  isLoaded &&
                  (isSignedIn ? (
                    navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          pathname === link.href
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {link.label}
                      </Link>
                    ))
                  ) : (
                    <>
                      <SignInButton mode="modal">
                        <Button variant="ghost" className="justify-start">
                          Sign In
                        </Button>
                      </SignInButton>
                      <SignUpButton mode="modal">
                        <Button className="justify-start">Get Started</Button>
                      </SignUpButton>
                    </>
                  ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
