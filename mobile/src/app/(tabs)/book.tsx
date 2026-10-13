import { ComingSoon } from '@/components/ComingSoon';

export default function BookScreen() {
  return (
    <ComingSoon
      title="Book a turf"
      subtitle="Pick a date, choose a slot, confirm."
      icon="calendar-outline"
      message="The step-by-step booking flow (date, slot, players, extras, price, confirm) is built in a later step."
    />
  );
}
