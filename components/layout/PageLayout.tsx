
import React, { ReactNode } from 'react';

interface PageLayoutProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode; // Optional actions for the page header
}

const PageLayout: React.FC<PageLayoutProps> = ({ title, children, actions }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-green-800 mb-4 sm:mb-0">{title}</h1>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>
      </div>
      <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;