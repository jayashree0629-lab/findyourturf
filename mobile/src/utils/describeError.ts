import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { ApiError } from '@/services/http';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Turns a technical error into a short, friendly message for the user.
export function describeError(error: unknown): { icon: IconName; title: string; message: string } {
  const kind = error instanceof ApiError ? error.kind : 'server';

  if (error instanceof ApiError && error.status === 404) {
    return {
      icon: 'search-outline',
      title: 'Turf not found',
      message: 'This turf may have been removed. Go back and pick another one.',
    };
  }

  switch (kind) {
    case 'network':
      return {
        icon: 'cloud-offline-outline',
        title: "Can't reach the server",
        message: 'Check your internet connection and try again.',
      };
    case 'timeout':
      return {
        icon: 'time-outline',
        title: 'The server is taking too long',
        message: 'It may still be waking up. Wait a moment, then try again.',
      };
    default:
      return {
        icon: 'alert-circle-outline',
        title: 'Something went wrong',
        message: 'The server had a problem. Please try again in a moment.',
      };
  }
}
