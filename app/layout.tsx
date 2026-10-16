import type { Metadata, Viewport } from "next";
import Image from 'next/image'
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Baby Feed - 婴儿科学喂养与成长记录",
  description: "记录婴儿喂养、睡眠与成长数据，帮助家庭更科学地了解宝宝的日常状态",
  manifest: "/baby-feed/manifest.json",
  icons: {
    icon: [
      { url: "/baby-feed/icon.svg?v=8", type: "image/svg+xml" },
    ],
    apple: "/baby-feed/icons/icon-192x192.png?v=8",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Baby Feed",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth" style={{ colorScheme: 'light' }}>
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Browser splash; installed PWAs use the platform launch screen only. */}
        <div id="splash" className="splash-screen" suppressHydrationWarning>
          <div className="splash-brand">
            <Image className="splash-mark" src="/baby-feed/icon.svg" alt="" width={76} height={76} priority />
            <p className="splash-name">Baby Feed</p>
          </div>
          <span className="splash-progress" aria-hidden="true" />
        </div>
        <Providers>
          {children}
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Dismiss splash screen after hydration
              requestAnimationFrame(function() {
                setTimeout(function() {
                  var splash = document.getElementById('splash');
                  if (splash) splash.classList.add('hidden');
                }, 300);
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
