const ANON_USER_KEY = "anon_user_id";

export function getAnonUserId(): string {
  let v = localStorage.getItem(ANON_USER_KEY);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(ANON_USER_KEY, v);
  }
  return v;
}
