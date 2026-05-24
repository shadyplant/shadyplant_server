const { findUserById } = require("../repositories/user.repository");
const { assertUserAccountIsActive } = require("../services/auth.service");
const { verifyAccessToken } = require("../services/token.service");
const { ApiError } = require("../utils/apiError");

const requireAuth = async (req, res, next) => {
  try {
    const authorizationHeader = req.get("authorization") || "";
    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return next(new ApiError(401, "Authorization header is required."));
    }

    const payload = verifyAccessToken(token);
    const user = await findUserById(payload.sub);

    if (!user) {
      return next(new ApiError(401, "User linked to this token no longer exists."));
    }

    assertUserAccountIsActive(user);

    req.auth = {
      userId: user.id,
      email: user.email,
      provider: user.authProvider,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { requireAuth };
