import type { Metadata } from "next";
import VideoNav from "@/components/video/VideoNav";

export const metadata: Metadata = {
  title: "Babyface Video Studio",
  description: "Dựng video, showreel talent, kịch bản AI và quản lý sản xuất — chạy ngay trên trình duyệt.",
};

export default function VideoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <VideoNav />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-dark/40">
        Video Studio chạy hoàn toàn trong trình duyệt — file và dự án lưu trên máy bạn, không
        upload lên server.
      </footer>
    </div>
  );
}
