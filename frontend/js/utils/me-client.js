// js/utils/me-client.js
let mePromise = null;
let meValue = null;

export function fetchMeOnce() {
  if (meValue) return Promise.resolve(meValue);
  if (mePromise) return mePromise;

  mePromise = fetch('/api/auth/me', { method: 'GET', credentials: 'include' })
    .then(async res => {
      if (!res.ok) throw new Error(`me_${res.status}`);
      const data = await res.json();
      meValue = data;
      return data;
    })
    .finally(() => {
      mePromise = null; // keep the value, clear the in-flight
    });

  return mePromise;
}
