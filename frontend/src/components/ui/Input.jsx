import React from 'react';

const Input = ({
    label,
    id,
    type = 'text',
    placeholder = '',
    value,
    onChange,
    error = '',
    required = false,
    className = ''
}) => {
    return (
        <div className={`w-full ${className}`}>
            {label && (
                <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <input
                id={id}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                className={`
                    w-full px-4 h-12 rounded-lg border bg-white dark:bg-dark-surface 
                    text-gray-900 dark:text-white placeholder-gray-400 
                    focus:ring-2 focus:ring-primary focus:border-primary transition-colors
                    ${error
                        ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'}
                `}
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
};

export default Input;
