import type { Metadata } from 'next';
import { SavedView } from '@/components/saved/saved-view';

export const metadata: Metadata = {
  title: '保存した求人',
  robots: { index: false, follow: false },
};

export default function SavedPage() {
  return <SavedView />;
}
