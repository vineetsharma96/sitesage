// Handles chunk boundaries, CRLF, multiline data and a final frame without a blank line.
export async function consumeSSE(stream, onEvent) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  function emit(frame) {
    const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data || data === '[DONE]') return;
    let parsed;
    try { parsed = JSON.parse(data); } catch { return; }
    onEvent(parsed);
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let match;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        emit(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
      }
      if (done) { if (buffer.trim()) emit(buffer); break; }
    }
  } finally { reader.releaseLock(); }
}
