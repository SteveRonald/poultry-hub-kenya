import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Megaphone, 
  DollarSign, 
  BarChart3, 
  Sparkles, 
  User,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Users,
  CheckSquare,
  Mail,
  MessageSquare,
  Database,
  Shield,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
}

interface SidebarGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: SidebarItem[];
  collapsible?: boolean;
}

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  type: 'vendor' | 'customer' | 'admin';
  stats?: {
    pendingOrders?: number;
    totalOrders?: number;
    pendingVendors?: number;
    pendingProducts?: number;
    newMessages?: number;
    [key: string]: any;
  };
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeTab,
  onTabChange,
  type,
  stats = {},
  isMobileOpen = false,
  onMobileClose
}) => {
  const getDefaultExpandedGroups = () => {
    if (type === 'admin') {
      return new Set(['dashboard', 'approvals', 'management', 'communication', 'financial', 'analytics', 'account']);
    } else if (type === 'vendor') {
      return new Set(['dashboard', 'products', 'orders', 'sales', 'account']);
    } else {
      return new Set(['dashboard', 'orders', 'account']);
    }
  };

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(getDefaultExpandedGroups());

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const vendorGroups: SidebarGroup[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard }
      ]
    },
    {
      id: 'products',
      label: 'Products & Inventory',
      icon: Package,
      collapsible: true,
      items: [
        { id: 'products', label: 'My Products', icon: Package }
      ]
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: ShoppingCart,
      collapsible: true,
      items: [
        { 
          id: 'orders', 
          label: 'All Orders', 
          icon: ShoppingCart,
          badge: stats.pendingOrders || 0
        }
      ]
    },
    {
      id: 'marketing',
      label: 'Marketing',
      icon: Megaphone,
      collapsible: true,
      items: [
        { id: 'advertisements', label: 'Advertisements', icon: Megaphone }
      ]
    },
    {
      id: 'sales',
      label: 'Sales & Earnings',
      icon: DollarSign,
      collapsible: true,
      items: [
        { id: 'earnings', label: 'Earnings & Revenue', icon: DollarSign }
      ]
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      collapsible: true,
      items: [
        { id: 'analytics', label: 'Analytics Dashboard', icon: BarChart3 }
      ]
    },
    {
      id: 'ai',
      label: 'AI Assistant',
      icon: Sparkles,
      collapsible: true,
      items: [
        { id: 'ai-assistant', label: 'Product Assistant', icon: Sparkles }
      ]
    },
    {
      id: 'account',
      label: 'Account',
      icon: User,
      collapsible: true,
      items: [
        { id: 'profile', label: 'Profile', icon: User }
      ]
    }
  ];

  const customerGroups: SidebarGroup[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard }
      ]
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: ShoppingCart,
      collapsible: true,
      items: [
        { 
          id: 'orders', 
          label: 'My Orders', 
          icon: ShoppingCart,
          badge: stats.pendingOrders || 0
        }
      ]
    },
    {
      id: 'account',
      label: 'Account',
      icon: User,
      collapsible: true,
      items: [
        { id: 'profile', label: 'Profile', icon: User }
      ]
    }
  ];

  const adminGroups: SidebarGroup[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard }
      ]
    },
    {
      id: 'approvals',
      label: 'Approvals',
      icon: CheckSquare,
      collapsible: true,
      items: [
        { 
          id: 'vendors', 
          label: 'Vendor Approvals', 
          icon: Users,
          badge: stats.pendingVendors || 0
        },
        { 
          id: 'products', 
          label: 'Product Approvals', 
          icon: Package,
          badge: stats.pendingProducts || 0
        }
      ]
    },
    {
      id: 'management',
      label: 'Management',
      icon: Shield,
      collapsible: true,
      items: [
        { id: 'orders', label: 'All Orders', icon: ShoppingCart },
        { id: 'users', label: 'User Management', icon: Users },
        { id: 'advertisements', label: 'Advertisements', icon: Megaphone }
      ]
    },
    {
      id: 'communication',
      label: 'Communication',
      icon: Mail,
      collapsible: true,
      items: [
        { 
          id: 'messages', 
          label: 'Contact Messages', 
          icon: MessageSquare,
          badge: stats.newMessages || 0
        },
        { id: 'sms', label: 'SMS Logs', icon: MessageSquare },
        { id: 'system-logs', label: 'System Logs', icon: FileText }
      ]
    },
    {
      id: 'financial',
      label: 'Financial',
      icon: DollarSign,
      collapsible: true,
      items: [
        { id: 'commission', label: 'Commission', icon: DollarSign }
      ]
    },
    {
      id: 'analytics',
      label: 'Analytics & Tools',
      icon: BarChart3,
      collapsible: true,
      items: [
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'backup', label: 'Backup', icon: Database }
      ]
    },
    {
      id: 'account',
      label: 'Account',
      icon: User,
      collapsible: true,
      items: [
        { id: 'profile', label: 'Profile', icon: User }
      ]
    }
  ];

  const groups = type === 'vendor' 
    ? vendorGroups 
    : type === 'admin' 
    ? adminGroups 
    : customerGroups;

  const handleItemClick = (itemId: string) => {
    onTabChange(itemId);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-16 sm:top-20 md:top-24 left-0 h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] bg-gray-50 border-r border-gray-200 z-50 transition-transform duration-300 ease-in-out overflow-y-auto",
          "lg:translate-x-0 lg:fixed lg:top-24 lg:left-0 lg:h-[calc(100vh-6rem)] lg:z-30 lg:overflow-y-auto",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          "w-64"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Mobile Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 lg:hidden">
            <h2 className="text-lg font-semibold text-primary">
              {type === 'vendor' ? 'Vendor Dashboard' : type === 'admin' ? 'Admin Dashboard' : 'Customer Dashboard'}
            </h2>
            <button
              onClick={onMobileClose}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Sidebar Content */}
          <nav className="flex-1 p-4 pt-6 space-y-2">
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const hasActiveItem = group.items.some(item => item.id === activeTab);

              return (
                <div key={group.id} className="mb-4">
                  {/* Group Header */}
                  {group.collapsible ? (
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        "hover:bg-gray-100",
                        hasActiveItem ? "text-primary bg-primary/10" : "text-gray-700"
                      )}
                    >
                      <div className="flex items-center space-x-2">
                        <group.icon className="h-4 w-4" />
                        <span>{group.label}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    <div className="px-3 py-2 flex items-center space-x-2">
                      <group.icon className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-700">{group.label}</span>
                    </div>
                  )}

                  {/* Group Items */}
                  {(!group.collapsible || isExpanded) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {group.items.map((item) => {
                        const isActive = item.id === activeTab;
                        const Icon = item.icon;

                        return (
                          <button
                            key={item.id}
                            onClick={() => handleItemClick(item.id)}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                              "hover:bg-gray-100",
                              isActive
                                ? "bg-primary text-white hover:bg-primary/90"
                                : "text-gray-700 hover:text-primary"
                            )}
                          >
                            <div className="flex items-center space-x-2">
                              <Icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </div>
                            {item.badge !== undefined && item.badge > 0 && (
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-xs font-medium",
                                  isActive
                                    ? "bg-white text-primary"
                                    : "bg-primary text-white"
                                )}
                              >
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;

