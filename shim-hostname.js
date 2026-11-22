// Shim os.hostname() to a pure ASCII string so Vercel CLI does not throw
// "ByteString contains non-Latin-1 chars" on Windows machines whose
// COMPUTERNAME contains Arabic (or any non-Latin-1) characters.
const os = require('os');
const original = os.hostname;
os.hostname = function () {
  try {
    const v = original.apply(this, arguments);
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\xff]*$/.test(v)) return v;
  } catch (_) {}
  return 'ascii-pc';
};
