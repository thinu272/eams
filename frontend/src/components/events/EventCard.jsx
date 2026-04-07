import React from 'react';

const EventCard = ({ event, onViewDetails }) => {
  const startingPrice = event.categories?.length > 0
    ? Math.min(...event.categories.map(cat => cat.price))
    : 0;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <img
        src={event.coverImage || '/placeholder-event.jpg'}
        alt={event.name}
        className="w-full h-48 object-cover"
      />
      <div className="p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{event.name}</h3>
        <p className="text-gray-600 text-sm mb-2">{formatDate(event.startDate)}</p>
        <p className="text-gray-600 text-sm mb-2">{event.venue?.name}</p>
        <p className="text-gray-600 text-sm mb-4">
          Starting from LKR {startingPrice.toLocaleString()}
        </p>
        <button
          onClick={() => onViewDetails(event.slug || event._id)}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          View Details
        </button>
      </div>
    </div>
  );
};

export default EventCard;