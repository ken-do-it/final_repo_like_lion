import React from 'react';

const Input = ({ label, id, error, className = '', ...props }) => {
    return (
        <div className="w-full">
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {label}
                </label>
            )}
            <input
                id={id}
                className={`
                    block w-full h-12 px-4 rounded-lg
                    border border-gray-300 dark:border-gray-600
                    bg-white dark:bg-[#1e2b36]
                    text-gray-900 dark:text-white
                    placeholder-gray-400 dark:placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-[#1392ec] focus:border-transparent
                    transition-colors duration-200
                    disabled:bg-gray-100 disabled:text-gray-500
                    ${error ? 'border-red-500 focus:ring-red-500' : ''}
                    ${className}
                `}
                {...props}
            />
            {error && (
                <p className="mt-1 text-sm text-red-500">{error}</p>
            )}
        </div>
    );
};

export default Input;
