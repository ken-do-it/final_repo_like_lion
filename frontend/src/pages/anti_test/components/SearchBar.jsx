import React from 'react';
import { BiSearch } from 'react-icons/bi';

const SearchBar = ({ className = "" }) => {
    return (
        <div className={`relative w-full max-w-[800px] mx-auto ${className}`}>
            <div className="relative flex items-center w-full h-14 rounded-full border border-gray-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-lg transition-shadow overflow-hidden px-6">
                <input
                    type="text"
                    placeholder="도시나 상품을 검색해보세요"
                    className="w-full h-full text-gray-800 placeholder-gray-400 text-lg font-medium bg-transparent outline-none border-none"
                />
                <BiSearch className="text-gray-400 text-2xl ml-2 cursor-pointer hover:text-gray-600" />
            </div>
        </div>
    );
};

export default SearchBar;
