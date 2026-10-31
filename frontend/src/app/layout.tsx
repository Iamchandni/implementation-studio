import type { Metadata, ReactNode } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Implementation Studio',
  description: 'AI-assisted enterprise implementation workspace'
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
