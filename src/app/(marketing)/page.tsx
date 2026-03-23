import Link from "next/link";
import {
  TreePine,
  Users,
  GitBranch,
  Shield,
  History,
  Share2,
  ArrowRight,
  Sparkles,
  Heart,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <>
      {/* Hero — full-bleed with organic gradient */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[120px]" />
        </div>

        <div className="container mx-auto px-4 pt-24 pb-32 md:pt-36 md:pb-44">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-primary font-medium tracking-wide uppercase text-sm mb-6 flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4" />
              Where families come together
            </p>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[0.95]">
              Every family has
              <br />
              <span className="text-primary">a story worth</span>
              <br />
              preserving.
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
              Rootline makes it easy for your whole family to build, explore,
              and preserve your shared history — together.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button size="lg" className="text-base px-10 h-13 rounded-full shadow-lg shadow-primary/20">
                  Start your tree
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="ghost" size="lg" className="text-base px-8 h-13 rounded-full text-muted-foreground">
                  See how it works
                </Button>
              </Link>
            </div>
          </div>

          {/* Decorative tree illustration placeholder */}
          <div className="mt-20 max-w-3xl mx-auto">
            <div className="glass-card glass-elevated rounded-2xl p-8 shadow-xl shadow-black/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-xs text-muted-foreground ml-2">The Rodriguez Family</span>
              </div>
              {/* Mini tree preview */}
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="flex items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-sm">MR</div>
                  <div className="h-0.5 w-8 bg-primary/30" />
                  <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-sm">SR</div>
                </div>
                <div className="w-0.5 h-6 bg-border" />
                <div className="flex items-center gap-12">
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">CR</div>
                    <span className="text-[10px] text-muted-foreground">Carlos</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">AR</div>
                    <span className="text-[10px] text-muted-foreground">Ana</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">LR</div>
                    <span className="text-[10px] text-muted-foreground">Luis</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 mt-2">
                  <div className="w-0.5 h-4 bg-border" />
                  <div className="w-0.5 h-4 bg-transparent" />
                  <div className="w-0.5 h-4 bg-border" />
                </div>
                <div className="flex items-center gap-8">
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-success/15 flex items-center justify-center text-success text-[10px] font-medium ring-2 ring-success/30">ER</div>
                    <div className="h-8 w-8 rounded-full bg-success/15 flex items-center justify-center text-success text-[10px] font-medium ring-2 ring-success/30">MR</div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-medium">SR</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
                  Elena just added 2 new family members
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="border-y bg-muted/20 py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Heart className="h-4 w-4 text-primary" /> Built for families of all sizes</span>
            <span className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-primary" /> Your data stays private</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> Works across the globe</span>
            <span className="flex items-center gap-1.5"><Share2 className="h-4 w-4 text-primary" /> GEDCOM compatible</span>
          </div>
        </div>
      </section>

      {/* Features — alternating layout */}
      <section id="features" className="py-24 md:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <p className="text-primary font-medium text-sm mb-3">Features</p>
            <h2 className="text-3xl md:text-5xl font-bold mb-5">
              Everything your family needs.
              <br className="hidden md:block" />
              <span className="text-muted-foreground">Nothing it doesn&apos;t.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Large feature card */}
            <div className="md:col-span-2 glass-card glass-edge-top rounded-2xl p-8 md:p-10">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
                    <TreePine className="h-3.5 w-3.5" />
                    Core Experience
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Interactive family tree</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    A living, breathing visualization of your lineage. Pan and zoom across generations,
                    click any member to see their story, and watch your tree grow in real time as family
                    members contribute.
                  </p>
                </div>
                <div className="md:w-64 h-40 rounded-xl bg-muted/50 border flex items-center justify-center">
                  <TreePine className="h-16 w-16 text-primary/20" />
                </div>
              </div>
            </div>

            {[
              {
                icon: GitBranch,
                title: "Relationship discovery",
                description: "Select any two people to instantly see how they're connected. Rootline traces the path and tells you the exact relationship — \"2nd cousin, once removed\" and all.",
                color: "text-chart-3",
                bg: "bg-chart-3/10",
              },
              {
                icon: Users,
                title: "Collaborative by nature",
                description: "Send an invite link. Your cousin adds their kids. Your uncle fills in his parents. The tree grows organically, with each person contributing what they know best.",
                color: "text-chart-2",
                bg: "bg-chart-2/10",
              },
              {
                icon: Shield,
                title: "Smart permissions",
                description: "Tree owners control who edits what. Invited members can add to their own branch but can't change someone else's. Your history stays accurate.",
                color: "text-chart-4",
                bg: "bg-chart-4/10",
              },
              {
                icon: History,
                title: "Time travel for your tree",
                description: "Every addition and edit is tracked. Owners can view the complete change history, create snapshots, and restore any previous version with one click.",
                color: "text-chart-5",
                bg: "bg-chart-5/10",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="glass-card glass-edge-top rounded-2xl p-7 transition-all hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 hover:scale-[1.01] duration-300"
              >
                <div className={`inline-flex items-center justify-center rounded-xl ${feature.bg} p-2.5 mb-4`}>
                  <feature.icon className={`h-5 w-5 ${feature.color}`} />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-primary font-medium text-sm mb-3">Getting started</p>
            <h2 className="text-3xl md:text-5xl font-bold">Three steps. That&apos;s it.</h2>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-12 md:gap-8 relative">
              {/* Connecting line on desktop */}
              <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-border" />

              {[
                {
                  step: "01",
                  title: "Create your tree",
                  desc: "Sign up in seconds and name your family tree. You're the owner — you set the rules.",
                },
                {
                  step: "02",
                  title: "Invite your people",
                  desc: "Share a link with family. They sign up and start adding their branch — children, parents, the works.",
                },
                {
                  step: "03",
                  title: "Watch it grow",
                  desc: "Explore connections, upload photos, discover how you're related to that cousin you met once at a reunion.",
                },
              ].map((item) => (
                <div key={item.step} className="text-center relative">
                  <div className="w-24 h-24 rounded-2xl glass-card border-2 border-primary/20 flex items-center justify-center mx-auto mb-6 relative z-10">
                    <span className="text-3xl font-bold text-primary">{item.step}</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Import/Export callout */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto glass-card glass-edge-top rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
                <Share2 className="h-3.5 w-3.5" />
                Import & Export
              </div>
              <h3 className="text-2xl font-bold mb-3">Already have a family tree?</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Import your existing research from Ancestry, MyHeritage, or any software
                that exports GEDCOM files. Or export your Rootline tree to share with others.
                Your data is always portable.
              </p>
              <Link href="/sign-up">
                <Button variant="outline" className="rounded-full">
                  Import your tree
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="w-full md:w-48 h-32 rounded-xl bg-muted/50 border-2 border-dashed border-border flex flex-col items-center justify-center gap-2">
              <Share2 className="h-8 w-8 text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">Drop .ged file here</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-primary" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.08),transparent_50%)]" />

        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-5">
            Your family&apos;s story<br />starts with you.
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-10 max-w-xl mx-auto">
            Free to start. No credit card needed.
            Just you and the people who matter most.
          </p>
          <Link href="/sign-up">
            <Button size="lg" variant="secondary" className="text-base px-10 h-13 rounded-full shadow-lg">
              Create your family tree
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
