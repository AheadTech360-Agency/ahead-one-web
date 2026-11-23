import { PageBody } from "@/components/page";
import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageBody className="md:grid md:grid-cols-[180px_minmax(0,1fr)] md:gap-10">
      <SettingsNav />
      <div className="min-w-0">{children}</div>
    </PageBody>
  );
}
