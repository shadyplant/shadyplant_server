const { getRedisClient } = require("../config/redis");

const getWishlistKey = (userId) => `wishlist:${userId}`;

const parseWishlistState = (payload) => {
  if (!payload) {
    return {
      items: [],
      updatedAt: null,
    };
  }

  const state = JSON.parse(payload);

  return {
    items: Array.isArray(state.items) ? state.items : [],
    updatedAt: state.updatedAt ? new Date(state.updatedAt) : null,
  };
};

const findWishlistByUserId = async (userId) => {
  const payload = await getRedisClient().get(getWishlistKey(userId));
  return parseWishlistState(payload);
};

const saveWishlistByUserId = async (userId, items) => {
  const state = {
    items,
    updatedAt: new Date(),
  };

  await getRedisClient().set(getWishlistKey(userId), JSON.stringify(state));

  return state;
};

const clearWishlistByUserId = async (userId) => {
  await getRedisClient().del(getWishlistKey(userId));
};

module.exports = {
  clearWishlistByUserId,
  findWishlistByUserId,
  saveWishlistByUserId,
};
