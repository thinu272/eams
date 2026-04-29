import React from 'react';

const TicketSelector = ({ categories, selectedTickets, onQuantityChange }) => {
  const handleIncrement = (categoryId, maxAvailable) => {
    const current = selectedTickets[categoryId] || 0;
    if (current < maxAvailable) {
      onQuantityChange(categoryId, current + 1);
    }
  };

  const handleDecrement = (categoryId) => {
    const current = selectedTickets[categoryId] || 0;
    if (current > 0) {
      onQuantityChange(categoryId, current - 1);
    }
  };

  const handleInputChange = (categoryId, value, maxAvailable) => {
    const numValue = parseInt(value) || 0;
    const clampedValue = Math.max(0, Math.min(maxAvailable, numValue));
    onQuantityChange(categoryId, clampedValue);
  };

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const available = category.capacity - category.sold;
        const selected = selectedTickets[category.id] || 0;
        const isSoldOut = available <= 0;

        return (
          <div
            key={category.id}
            className={`bg-white border rounded-lg p-4 ${isSoldOut ? 'opacity-50' : ''}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                <p className="text-2xl font-bold text-blue-600">${category.price.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  {available} available
                </p>
                {isSoldOut && (
                  <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                    Sold Out
                  </span>
                )}
              </div>
            </div>

            {category.description && (
              <p className="text-gray-600 text-sm mb-3">{category.description}</p>
            )}

            {!isSoldOut && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleDecrement(category.id)}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center disabled:opacity-50"
                  disabled={selected === 0}
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  max={available}
                  value={selected}
                  onChange={(e) => handleInputChange(category.id, e.target.value, available)}
                  className="w-16 text-center border border-gray-300 rounded px-2 py-1"
                />
                <button
                  onClick={() => handleIncrement(category.id, available)}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center disabled:opacity-50"
                  disabled={selected >= available}
                >
                  +
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TicketSelector;
