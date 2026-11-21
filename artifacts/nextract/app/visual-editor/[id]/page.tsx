import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Editor from "@/components/visual/Editor";
import Link from "next/link";
export const instant = false;

export const metadata = {
  title: "Visual Editor | Nextract CMS",
  robots: { index: false, follow: false },
};
export default async function VisualEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const cookie = (await cookies()).toString();
  const api = (process.env.CMS_API_URL ?? "http://127.0.0.1:4000").replace(
    /\/$/,
    "",
  );
  const response = await fetch(
    `${api}/api/admin/pages/${encodeURIComponent(id)}/visual`,
    { headers: { cookie }, cache: "no-store" },
  );
  if (response.status === 401) redirect("/admin");
  if (!response.ok)
    return (
      <div style={{ padding: 60 }}>
        Cannot edit this page. Your account needs page editing permission.{" "}
        <Link href="/admin/pages">Return to Pages</Link>
      </div>
    );
  return <Editor id={id} />;
}
