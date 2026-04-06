import React from 'react';

const SummaryCard = ({ selectedTickets, categories, totalTickets, totalPrice, onProceedToCheckout }) => {
  const selectedCategories = categories.filter(cat => (selectedTickets[cat.id] || 0) > 0);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>

      {selectedCategories.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No tickets selected</p>
      ) : (
        <div className="space-y-3 mb-6">
          {selectedCategories.map((category) => (
            <div key={category.id} className="flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900">{category.name}</p>
                <p className="text-sm text-gray-600">
                  {selectedTickets[category.id]} × ${category.price.toFixed(2)}
                </p>
              </div>
              <p className="font-semibold text-gray-900">
                ${(selectedTickets[category.id] * category.price).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-semibold text-gray-900">Total</span>
          <span className="text-lg font-bold text-gray-900">${totalPrice.toFixed(2)}</span>
        </div>
        <div className="text-sm text-gray-600 mb-4">
          {totalTickets} ticket{totalTickets !== 1 ? 's' : ''} selected
        </div>
      </div>

      <button
        onClick={onProceedToCheckout}
        disabled={totalTickets === 0}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
      >
        Proceed to Checkout
      </button>
    </div>
  );
};

export default SummaryCard;