import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { SavedCollectionsProvider } from "@/contexts/SavedCollectionsContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Навылет — AI-помощник для путешествий",
  description:
    "Подберём идеальное путешествие с помощью искусственного интеллекта. Туры, отели, авиабилеты, круизы.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} ${montserrat.variable} antialiased`}>
        <AuthProvider>
          <FavoritesProvider>
            <SavedCollectionsProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </SavedCollectionsProvider>
          </FavoritesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
