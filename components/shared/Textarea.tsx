
import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea: React.FC<TextareaProps> = ({ label, id, error, className, ...props }) => {
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-sm font-medium text-green-700 mb-1">{label}</label>}
      <textarea
        id={id}
        className={`block w-full appearance-none rounded-md border px-3 py-2 placeholder-green-400 text-green-900
          ${ error 
            ? 'border-red-500 text-red-900 focus:border-red-500 focus:ring-red-500' 
            : 'border-green-300 focus:border-yellow-500 focus:ring-yellow-500'
          } 
          sm:text-sm disabled:cursor-not-allowed disabled:bg-green-50 disabled:text-green-500 ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default Textarea;