
import React, { ReactNode } from 'react';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: ReactNode;
  onClose?: () => void;
}

const Alert: React.FC<AlertProps> = ({ type, message, onClose }) => {
  const baseClasses = "p-4 mb-4 text-sm rounded-lg";
  const typeClasses = {
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-100 dark:text-emerald-800", // Using emerald for success
    error: "bg-red-100 text-red-700 dark:bg-red-200 dark:text-red-800",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-100 dark:text-amber-800", // Using amber for warning
    info: "bg-lime-50 text-lime-700 dark:bg-lime-100 dark:text-lime-800", // Changed info to lime based
  };
  
  const closeButtonColors = {
    success: "text-emerald-700 hover:bg-emerald-100 focus:ring-emerald-400 dark:text-emerald-800 dark:hover:bg-emerald-200",
    error: "text-red-700 hover:bg-red-100 focus:ring-red-400 dark:text-red-800 dark:hover:bg-red-200",
    warning: "text-amber-700 hover:bg-amber-100 focus:ring-amber-400 dark:text-amber-800 dark:hover:bg-amber-200",
    info: "text-lime-700 hover:bg-lime-100 focus:ring-lime-400 dark:text-lime-800 dark:hover:bg-lime-200",
  }


  return (
    <div className={`${baseClasses} ${typeClasses[type]} flex justify-between items-center`} role="alert">
      <div>{message}</div>
      {onClose && (
        <button
          type="button"
          className={`ml-auto -mx-1.5 -my-1.5 p-1.5 rounded-lg focus:ring-2 inline-flex h-8 w-8 ${closeButtonColors[type]}`}
          aria-label="Fechar"
          onClick={onClose}
        >
          <span className="sr-only">Fechar</span>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            ></path>
          </svg>
        </button>
      )}
    </div>
  );
};

export default Alert;