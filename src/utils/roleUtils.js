import { authService } from '../services/auth.service';

/**
 * Check if current user has a specific role
 * @param {string} role - Role to check
 * @returns {boolean} True if user has the role
 */
export const hasRole = (role) => {
  const user = authService.getUser();
  return user?.role === role;
};

/**
 * Check if current user has any of the specified roles
 * @param {string[]} roles - Array of roles to check
 * @returns {boolean} True if user has any of the roles
 */
export const hasAnyRole = (roles) => {
  const user = authService.getUser();
  return user && roles.includes(user.role);
};

/**
 * Check if current user is an Accountant
 * @returns {boolean} True if user is an Accountant (accounts_manager)
 */
export const isAccountant = () => {
  return hasRole('accounts_manager');
};

/**
 * Check if current user is an Admin
 * @returns {boolean} True if user is an Admin (super_admin)
 */
export const isAdmin = () => {
  return hasRole('super_admin');
};

/**
 * Check if current user is a Regional Manager
 * @returns {boolean} True if user is a Regional Manager
 */
export const isRegionalManager = () => {
  return hasRole('regional_manager');
};

/**
 * Check if current user is a Franchise Owner
 * @returns {boolean} True if user is a Franchise Owner
 */
export const isFranchiseOwner = () => {
  return hasRole('franchise');
};

/**
 * Check if current user is a Partner
 * @returns {boolean} True if user is a Partner
 */
export const isAgent = () => {
  return hasRole('agent');
};

/**
 * Get current user's role
 * @returns {string|null} Current user's role or null if not authenticated
 */
export const getCurrentUserRole = () => {
  const user = authService.getUser();
  return user?.role || null;
};

/**
 * Check if user has permission to export data
 * Only Accountants and Admins can export
 * @returns {boolean} True if user can export
 */
export const canExportData = () => {
  return hasAnyRole(['accounts_manager', 'super_admin']);
};
