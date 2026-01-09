import React from 'react';

const CityCard = ({ city }) => {
    return (
        <div className="group cursor-pointer">
            <div className="relative overflow-hidden rounded-lg aspect-[4/3] mb-3">
                <img
                    src={city.imageUrl}
                    alt={city.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                {/* Scrim or gradient if needed, but clean is better for Triple */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
            </div>
            <h3 className="text-gray-900 font-bold text-lg leading-tight">{city.name}</h3>
            <p className="text-gray-500 text-sm mt-0.5">{city.country}</p>
        </div>
    );
};

export default CityCard;
