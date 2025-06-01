
import React from 'react';
import { SelectOption } from '../../types';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select: React.FC<SelectProps> = ({ label, id, error, options, placeholder, className, ...props }) => {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-sm font-medium text-green-700 mb-1">{label}</label>}
      <select
        id={id}
        className={`block w-full appearance-none rounded-md border px-3 py-2 placeholder-green-400 text-green-900
          ${ error 
            ? 'border-red-500 text-red-900 focus:border-red-500 focus:ring-red-500' 
            : 'border-green-300 focus:border-yellow-500 focus:ring-yellow-500'
          } 
          sm:text-sm disabled:cursor-not-allowed disabled:bg-green-50 disabled:text-green-500 ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default Select;