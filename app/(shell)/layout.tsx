import { AppRail, AppTabBar } from "@/components/app-nav";
import { ShellStage } from "@/components/shell-stage";

/**
 * The app shell (#39): four sections, one frame.
 *
 * The site was one page until now, and the frame is deliberately thin — a rail
 * of icons, a stage, a tab bar. It is a *layout*, so navigating between the
 * four sections is a soft navigation: the rail and the tab bar are never
 * remounted, and neither is anything module-level that the pages read
 * (scenarios, shortlist, sharing, the live-fare cache), so a Capsule marked
 * *interested* on one page is still marked when you come back to it.
 *
 * The stage is a flex child rather than a full-viewport overlay so the chrome
 * pinned to its corners clears the navigation instead of hiding under it.
 */
export default function ShellLayout({ children }: LayoutProps<"/">) {
  return (
    // `print:` opts the frame out on paper: the Ledger is a document, and a
    // fixed-height overflow-hidden shell would print one screenful of it.
    <div className="flex h-dvh w-full flex-col overflow-hidden lg:flex-row print:block print:h-auto print:overflow-visible">
      <AppRail />
      <ShellStage>{children}</ShellStage>
      <AppTabBar />
    </div>
  );
}
