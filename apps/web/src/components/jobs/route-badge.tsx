import { Building2, Handshake, Landmark, Newspaper, CircleHelp } from 'lucide-react';
import { applicationRouteLabel, type ApplicationRoute } from '@worklens/domain';
import { Badge } from '@/components/ui/badge';

const icons = { employer: Building2, agency: Handshake, hellowork: Landmark, jobboard: Newspaper, unknown: CircleHelp } as const;

export function RouteBadge({ route }: { route: ApplicationRoute }) {
  const Icon = icons[route];
  return (
    <Badge tone={route === 'unknown' ? 'warn' : 'neutral'}>
      <Icon aria-hidden className="size-3.5" />
      {applicationRouteLabel(route)}
    </Badge>
  );
}
