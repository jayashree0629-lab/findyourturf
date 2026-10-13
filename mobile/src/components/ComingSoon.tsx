import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { Card, EmptyState, Screen, ScreenHeader } from './ui';

type Props = {
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  message: string;
};

// Placeholder for tabs we have not built yet, so navigation can be tested now.
export function ComingSoon({ title, subtitle, icon, message }: Props) {
  return (
    <Screen>
      <ScreenHeader title={title} subtitle={subtitle} />
      <Card>
        <EmptyState icon={icon} title="Coming soon" message={message} />
      </Card>
    </Screen>
  );
}
