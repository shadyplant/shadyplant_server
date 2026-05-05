const { findStaffAccountById } = require("../repositories/staff.repository");
const { verifyStaffAccessToken } = require("../services/token.service");
const { ApiError } = require("../utils/apiError");

const STAFF_ROLE_HIERARCHY = {
  support: 1,
  operations: 2,
  catalog: 3,
  manager: 4,
  admin: 5,
  owner: 6,
};

const requireStaffAuth = async (req, res, next) => {
  try {
    const authorizationHeader = req.get("authorization") || "";
    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return next(new ApiError(401, "Staff authorization header is required."));
    }

    const payload = verifyStaffAccessToken(token);
    const staffAccount = await findStaffAccountById(payload.sub);

    if (!staffAccount || staffAccount.status !== "active") {
      return next(new ApiError(401, "Staff account is invalid or inactive."));
    }

    req.staff = {
      staffAccountId: staffAccount.id,
      organizationId: staffAccount.organizationId,
      email: staffAccount.email,
      role: staffAccount.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

const requireStaffRoles = (allowedRoles = []) => (req, res, next) => {
  const currentRole = req.staff?.role;

  if (!currentRole) {
    return next(new ApiError(401, "Staff authentication is required."));
  }

  const currentRank = STAFF_ROLE_HIERARCHY[currentRole] || 0;
  const isAllowed = allowedRoles.some((role) => {
    if (role === currentRole) {
      return true;
    }

    const allowedRank = STAFF_ROLE_HIERARCHY[role] || 0;
    return currentRank >= allowedRank;
  });

  if (!isAllowed) {
    return next(new ApiError(403, "You do not have permission for this action."));
  }

  return next();
};

module.exports = {
  requireStaffAuth,
  requireStaffRoles,
};
