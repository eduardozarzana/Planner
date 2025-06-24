
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  IconComponent?: React.ElementType;
}

const Input: React.FC<InputProps> = ({ label, id, error, IconComponent, className, ...props }) => {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-sm font-medium text-green-700 mb-1">{label}</label>}
      <div className="relative rounded-md shadow-sm">
        {IconComponent && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <IconComponent className="h-5 w-5 text-green-400" aria-hidden="true" />
          </div>
        )}
        <input
          id={id}
          className={`block w-full appearance-none rounded-md border ${IconComponent ? 'pl-10' : 'px-3'} py-2 placeholder-green-400 text-green-900
          ${ error 
            ? 'border-red-500 text-red-900 focus:border-red-500 focus:ring-red-500' 
            : 'border-green-300 focus:border-yellow-500 focus:ring-yellow-500'
          } 
          sm:text-sm disabled:cursor-not-allowed disabled:bg-green-50 disabled:text-green-500 ${className}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default Input;