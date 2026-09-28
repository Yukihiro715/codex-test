import { Briefcase, ClipboardList, Code, Factory, HeartHandshake, Stethoscope, Store, Truck, type LucideIcon } from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  driver: Truck,
  manufacturing: Factory,
  nurse: Stethoscope,
  engineer: Code,
  care: HeartHandshake,
  office: ClipboardList,
  sales: Briefcase,
  service: Store,
};

export function OccupationIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = icons[slug] ?? Briefcase;
  return <Icon aria-hidden className={className} />;
}
