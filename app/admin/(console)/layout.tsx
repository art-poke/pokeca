import { adminPreviewEnabled } from "@/lib/local-admin-preview";
import { AdminShell } from "@/components/admin/AdminShell";

export default function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell preview={adminPreviewEnabled()}>{children}</AdminShell>;
}
