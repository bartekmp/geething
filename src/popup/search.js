export function matchesQuery(message, query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const fields = [message.from?.name, message.from?.email, message.subject, message.snippet];
  return fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(q));
}

export function filterMessages(messages, query) {
  const q = query.trim();
  if (!q) {
    return messages;
  }
  return messages.filter((m) => matchesQuery(m, q));
}
