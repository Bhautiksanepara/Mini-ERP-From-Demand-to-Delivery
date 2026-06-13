function buildFieldChangeLogs({ before, after, fields, baseLog }) {
  const logs = [];

  for (const field of fields) {
    const oldValue = before[field] === null || before[field] === undefined ? null : String(before[field]);
    const newValue = after[field] === null || after[field] === undefined ? null : String(after[field]);

    if (oldValue !== newValue) {
      logs.push({
        ...baseLog,
        action: 'Updated',
        field_changed: field,
        old_value: oldValue,
        new_value: newValue
      });
    }
  }

  return logs;
}

module.exports = {
  buildFieldChangeLogs
};
