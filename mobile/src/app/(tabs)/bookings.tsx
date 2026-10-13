import { ComingSoon } from '@/components/ComingSoon';

export default function BookingsScreen() {
  return (
    <ComingSoon
      title="My bookings"
      subtitle="Your upcoming and past games."
      icon="ticket-outline"
      message="Your bookings will appear here once sign-in and booking are connected."
    />
  );
}
