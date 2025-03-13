import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cleo Dashboard",
  description: "Task Queue Management Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-gray-100">
      <body className={`h-full ${inter.className}`}>
        <DashboardLayout>
          {children}
          <Toaster richColors position="top-right" />
        </DashboardLayout>
      </body>
    </html>
  );
} 