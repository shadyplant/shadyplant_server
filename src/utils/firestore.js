const isTimestampLike = (value) =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof value.toDate === "function";

const isPlainObject = (value) =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !isTimestampLike(value) &&
  !(value instanceof Date);

const normalizeFirestoreValue = (value) => {
  if (isTimestampLike(value)) {
    return value.toDate();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeFirestoreValue);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        normalizeFirestoreValue(entryValue),
      ]),
    );
  }

  return value;
};

const normalizeFirestoreDoc = (snapshot) => {
  if (!snapshot.exists) {
    return null;
  }

  return {
    id: snapshot.id,
    ...normalizeFirestoreValue(snapshot.data()),
  };
};

module.exports = {
  normalizeFirestoreDoc,
  normalizeFirestoreValue,
};
