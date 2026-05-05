const { getRedisClient } = require("../config/redis");

const getCartKey = (userId) => `cart:${userId}`;

const parseCartState = (payload) => {
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

const findCartByUserId = async (userId) => {
  const payload = await getRedisClient().get(getCartKey(userId));
  return parseCartState(payload);
};

const saveCartByUserId = async (userId, items) => {
  const state = {
    items,
    updatedAt: new Date(),
  };

  await getRedisClient().set(getCartKey(userId), JSON.stringify(state));

  return state;
};

const clearCartByUserId = async (userId) => {
  await getRedisClient().del(getCartKey(userId));
};

module.exports = {
  clearCartByUserId,
  findCartByUserId,
  saveCartByUserId,
};
