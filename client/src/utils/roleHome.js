const roleHomes = {
  admin: '/admin',
  university: '/university',
  student: '/student',
  verifier: '/verify',
};

export const getRoleHome = (role) => roleHomes[role] || '/';

export const getPostLoginPath = (role, location) => {
  const pathname = location?.pathname || '';
  const query = location?.search || '';
  const roleWorkspace = { admin: '/admin', university: '/university', student: '/student' }[role];
  const canOpenWorkspace = roleWorkspace && (pathname === roleWorkspace || pathname.startsWith(`${roleWorkspace}/`));
  const canOpenCredential = pathname.startsWith('/certificate/') && ['admin', 'university', 'student'].includes(role);

  return canOpenWorkspace || canOpenCredential
    ? `${pathname}${query}`
    : getRoleHome(role);
};
