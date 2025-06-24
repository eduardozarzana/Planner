
import React from 'react';
import { NavLink, type NavLinkRenderProps, useNavigate } from 'react-router-dom'; // Added useNavigate
import { APP_NAME, ROUTES } from '../../constants';
import { ChartBarIcon, WrenchScrewdriverIcon, SupplementBottleIcon, ListIcon, CalendarIcon, LogoutIcon } from '../icons'; // Updated icons, Added LogoutIcon
import { useAuth } from '../../contexts/AuthContext'; // Added useAuth
import Button from '../shared/Button'; // For styled logout button

const navItems = [
  { path: ROUTES.DASHBOARD, label: 'Painel', icon: <ChartBarIcon className="w-5 h-5 mr-2" /> },
  { path: ROUTES.EQUIPMENT, label: 'Equipamentos', icon: <WrenchScrewdriverIcon className="w-5 h-5 mr-2" /> },
  { path: ROUTES.PRODUCTS, label: 'Produtos', icon: <SupplementBottleIcon className="w-5 h-5 mr-2" /> },
  { path: ROUTES.LINES, label: 'Linhas', icon: <ListIcon className="w-5 h-5 mr-2" /> },
  { path: ROUTES.SCHEDULING, label: 'Agendamento', icon: <CalendarIcon className="w-5 h-5 mr-2" /> },
];

const Navbar: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    auth.logout();
    navigate(ROUTES.LOGIN); // Redirect to login after logout
  };

  return (
    <nav className="bg-green-700 shadow-lg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <NavLink to={ROUTES.DASHBOARD} className="flex-shrink-0 flex items-center">
              <span className="font-bold text-xl text-yellow-300">{APP_NAME}</span>
            </NavLink>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }: NavLinkRenderProps) => 
                    `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out ${
                      isActive
                        ? 'bg-green-600 text-yellow-300'
                        : 'text-lime-50 hover:bg-green-600 hover:text-yellow-200'
                    }`
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="hidden md:block">
             {auth.isAuthenticated && (
                <Button
                  onClick={handleLogout}
                  variant="ghost" 
                  size="sm"
                  className="text-lime-50 hover:bg-green-600 hover:text-yellow-200"
                  leftIcon={<LogoutIcon className="w-5 h-5" />}
                >
                  Sair
                </Button>
              )}
          </div>
          {/* Mobile menu button can be added here if needed */}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
