export function groupByThread(messages) {
  const threads = new Map();
  for (const msg of messages) {
    const tid = msg.threadId || msg.id;
    if (!threads.has(tid)) {
      threads.set(tid, []);
    }
    threads.get(tid).push(msg);
  }
  for (const msgs of threads.values()) {
    msgs.sort((a, b) => (b.internalDate || 0) - (a.internalDate || 0));
  }
  return Array.from(threads.values()).sort(
    (a, b) => (b[0].internalDate || 0) - (a[0].internalDate || 0),
  );
}
