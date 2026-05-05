const buildUpdateStatement = (updates, columnMap) => {
  const entries = Object.entries(updates).filter(
    ([, value]) => value !== undefined,
  );

  if (entries.length === 0) {
    return null;
  }

  const values = [];
  const assignments = entries.map(([key, value], index) => {
    values.push(value);
    const mapping = columnMap[key] || key;
    const columnName =
      typeof mapping === "string" ? mapping : mapping.column || key;
    const cast =
      typeof mapping === "string" || !mapping.cast ? "" : `::${mapping.cast}`;

    return `${columnName} = $${index + 1}${cast}`;
  });

  return {
    setClause: assignments.join(", "),
    values,
  };
};

module.exports = {
  buildUpdateStatement,
};
