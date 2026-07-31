import React from 'react';

/**
 * EventSelector component for selecting an event.
 * Props:
 *  - events: array of event objects (expects at least { _id, id, name })
 *  - selectedEventId: currently selected event id
 *  - onSelect: callback(id) invoked when a new event is chosen
 */
import styles from './EventSelector.module.css';

const EventSelector = ({ events = [], selectedEventId = '', onSelect }) => {
  const handleChange = (e) => {
    const id = e.target.value;
    onSelect(id);
  };

  return (
    <div className={styles.eventSelectorContainer}>
        <label className={styles.eventLabel}>Select Event</label>
      <select
          value={selectedEventId}
          onChange={handleChange}
          className={styles.eventSelect}
        >
        <option value="" disabled>-- Choose an event --</option>
        {(Array.isArray(events) ? events : []).map((event) => (
          <option key={event._id || event.id} value={event._id || event.id}>
            {event.name || event.title || 'Untitled Event'}
          </option>
        ))}
      </select>
    </div>
  );
};

export default EventSelector;
