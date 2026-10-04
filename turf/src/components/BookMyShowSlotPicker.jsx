import { useMemo } from "react";
import { CheckCircle2, Clock, Sun, Sunrise, Sunset, Moon, Sparkles } from "lucide-react";

export default function BookMyShowSlotPicker({
  slots = [],
  selectedSlot,
  onSelectSlot,
  loading = false,
  date,
  turf
}) {
  // Group slots by time of day
  const groupedSlots = useMemo(() => {
    const morning = [];
    const afternoon = [];
    const evening = [];
    const night = [];

    slots.forEach((slot) => {
      const mins = slot.startMinutes ?? 0;
      if (mins < 12 * 60) {
        morning.push(slot);
      } else if (mins < 17 * 60) {
        afternoon.push(slot);
      } else if (mins < 21 * 60) {
        evening.push(slot);
      } else {
        night.push(slot);
      }
    });

    return [
      { id: "morning", label: "Morning Slots", period: "06:00 AM – 11:59 AM", icon: Sunrise, items: morning },
      { id: "afternoon", label: "Afternoon Slots", period: "12:00 PM – 04:59 PM", icon: Sun, items: afternoon },
      { id: "evening", label: "Evening Slots", period: "05:00 PM – 08:59 PM", icon: Sunset, items: evening },
      { id: "night", label: "Night Slots", period: "09:00 PM Onwards", icon: Moon, items: night },
    ]
      // Drop time-of-day groups that have entirely lapsed (e.g. "Morning" once
      // it's already afternoon) — showing a block of nothing but greyed-out
      // "Past" buttons is just clutter, not useful information.
      .filter((group) => group.items.some((s) => !s.isPast));
  }, [slots]);

  if (loading) {
    return (
      <div className="fyt-bms-loading-box">
        <Clock size={22} className="fyt-spin-icon" />
        <span>Loading real-time slot availability...</span>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="fyt-bms-empty-box">
        <Clock size={28} />
        <h4>No Slots Configured</h4>
        <p>There are no bookable slots found for this date. Please pick another day.</p>
      </div>
    );
  }

  return (
    <div className="fyt-bms-picker-wrap">
      {/* BookMyShow-style Legend */}
      <div className="fyt-bms-legend-bar">
        <div className="fyt-bms-legend-item">
          <span className="fyt-bms-legend-pill available" />
          <span>Available</span>
        </div>
        <div className="fyt-bms-legend-item">
          <span className="fyt-bms-legend-pill selected" />
          <span>Selected</span>
        </div>
        <div className="fyt-bms-legend-item">
          <span className="fyt-bms-legend-pill booked" />
          <span>Booked</span>
        </div>
        <div className="fyt-bms-legend-item">
          <span className="fyt-bms-legend-pill past" />
          <span>Past</span>
        </div>
      </div>

      {/* Grouped Time Slots (Morning, Afternoon, Evening, Night) */}
      <div className="fyt-bms-groups-container">
        {groupedSlots.map((group) => {
          const Icon = group.icon;
          const availCount = group.items.filter((s) => s.available).length;
          return (
            <div key={group.id} className="fyt-bms-time-group">
              <div className="fyt-bms-group-header">
                <div className="fyt-bms-group-title">
                  <Icon size={16} className="fyt-bms-group-icon" />
                  <strong>{group.label}</strong>
                  <span className="fyt-bms-group-period">{group.period}</span>
                </div>
                <span className={`fyt-bms-avail-count ${availCount === 0 ? "none" : ""}`}>
                  {availCount === 0 ? "Fully booked" : `${availCount} ${availCount === 1 ? "slot" : "slots"} open`}
                </span>
              </div>

              <div className="fyt-bms-slots-grid">
                {group.items.map((slot) => {
                  const isSelected = selectedSlot === slot.value;
                  const isBooked = !slot.available && !slot.isPast;
                  const isPast = slot.isPast;

                  let statusCls = "available";
                  if (isSelected) statusCls = "selected";
                  else if (isBooked) statusCls = "booked";
                  else if (isPast) statusCls = "past";

                  return (
                    <button
                      key={slot.value}
                      className={`fyt-bms-slot-btn ${statusCls}`}
                      disabled={!slot.available && !isSelected}
                      onClick={() => slot.available && onSelectSlot(slot.value)}
                      title={
                        isPast
                          ? "This slot has already passed"
                          : isBooked
                          ? "This slot is already booked"
                          : `Select ${slot.label}`
                      }
                      aria-label={`${slot.label} - ${statusCls}`}
                    >
                      <span className="fyt-bms-slot-label">{slot.label}</span>

                      {isSelected ? (
                        <span className="fyt-bms-slot-status selected">
                          <CheckCircle2 size={11} /> Selected
                        </span>
                      ) : isBooked ? (
                        <span className="fyt-bms-slot-status booked">Booked</span>
                      ) : isPast ? (
                        <span className="fyt-bms-slot-status past">Past</span>
                      ) : (
                        <span className="fyt-bms-slot-status price">₹{turf?.pricePerHour}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Slot Confirmation Card */}
      {selectedSlot && (
        <div className="fyt-bms-selected-summary">
          <div className="fyt-bms-ss-icon">
            <CheckCircle2 size={24} />
          </div>
          <div className="fyt-bms-ss-details">
            <span className="fyt-bms-ss-tag">Slot Selected</span>
            <strong className="fyt-bms-ss-time">{selectedSlot}</strong>
            <span className="fyt-bms-ss-meta">
              {date ? new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "Today"} · 1 Hour Session · 100% Guaranteed
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

