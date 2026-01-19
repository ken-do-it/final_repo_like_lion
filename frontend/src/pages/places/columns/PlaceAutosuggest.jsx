import React, { useState, useEffect, useRef } from 'react';
import { placesAxios as api } from '../../../api/axios';

const PlaceAutosuggest = ({ value, onChange, placeholder = "장소 검색" }) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    // Sync state with parent's value prop
    useEffect(() => {
        console.log('[PlaceAutosuggest] value changed:', value);
        if (value) {
            const hasId = value.id || value.place_api_id;
            const hasName = value.name && value.name.trim().length > 0;
            console.log('[PlaceAutosuggest] hasId:', hasId, 'hasName:', hasName);

            if (hasId && !hasName) {
                // If we have ID but no name, fetch details
                const fetchDetails = async () => {
                    try {
                        const idToFetch = value.id || value.place_api_id; // Prefer DB ID if available
                        const response = await api.get(`/places/${idToFetch}`);
                        setSelectedPlace(response.data);
                        setQuery(response.data.name);
                        // Optional: Update parent with full details? 
                        // For now just update local UI state so input isn't empty
                    } catch (error) {
                        console.error("Failed to fetch place details:", error);
                        // Fallback: show ID if fetch fails?
                        setQuery(`장소 ID: ${hasId}`);
                    }
                };
                fetchDetails();
            } else if (!selectedPlace || (selectedPlace.id !== value.id && selectedPlace.place_api_id !== value.place_api_id)) {
                // Normal sync
                setSelectedPlace(value);
                setQuery(value.name || '');
            }
        } else {
            // When parent value is cleared
            setQuery('');
            setSelectedPlace(null);
        }
    }, [value]);

    useEffect(() => {
        // Click outside handler
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchSuggestions = async (input) => {
        if (!input || input.length < 2) {
            setSuggestions([]);
            return;
        }
        try {
            const response = await api.get('/places/autocomplete', {
                params: { q: input, limit: 5 }
            });
            setSuggestions(response.data.suggestions || []);
            setShowSuggestions(true);
        } catch (error) {
            console.error("Autocomplete error:", error);
            setSuggestions([]);
        }
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setQuery(val);

        if (selectedPlace && val !== selectedPlace.name) {
            onChange(null); // Clear parent's value
        }

        // Debounce fetching
        const timeoutId = setTimeout(() => {
            fetchSuggestions(val);
        }, 300);
        return () => clearTimeout(timeoutId);
    };

    const handleSelect = (place) => {
        // Important: Update Query FIRST to visual feedback
        setQuery(place.name);
        setSelectedPlace(place);

        // Pass entire place object
        onChange(place);

        setShowSuggestions(false);
        setSuggestions([]);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission
            if (showSuggestions && suggestions.length > 0) {
                // Select first suggestion
                handleSelect(suggestions[0]);
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
        // Add Arrow Navigation if needed in future
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (query.length >= 2 && suggestions.length > 0) setShowSuggestions(true);
                        // Also re-fetch if empty? No.
                    }}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-[#1e2b36] focus:ring-1 focus:ring-[#1392ec] dark:text-white"
                />
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
                {value && (
                    <button
                        type="button" // Important: preventing submit
                        onClick={() => {
                            onChange(null);
                            inputRef.current?.focus();
                        }}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-red-500 text-xs"
                    >
                        ✕
                    </button>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1e2b36] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((item, idx) => (
                        <div
                            key={idx}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent input blur
                                handleSelect(item);
                            }}
                            className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex flex-col border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                        >
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {item.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {item.address}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PlaceAutosuggest;
