// ───────── 10단계: 구글 로그인 클라우드 저장 (Firebase Auth + Firestore) ─────────
import { FIREBASE_CONFIG } from './cloudconfig.js';

const V = '10.12.2';
const URL = (m) => `https://www.gstatic.com/firebasejs/${V}/firebase-${m}.js`;

export class Cloud {
  constructor() { this.user = null; this.ready = null; this.lastUp = 0; this.listeners = []; }
  get available() { return !!FIREBASE_CONFIG; }
  onChange(fn) { this.listeners.push(fn); }
  init() {
    if (!this.available) return Promise.resolve(false);
    if (this.ready) return this.ready;
    this.ready = (async () => {
      try {
        const [A, U, F] = await Promise.all([import(URL('app')), import(URL('auth')), import(URL('firestore'))]);
        this.A = A; this.U = U; this.F = F;
        this.app = A.initializeApp(FIREBASE_CONFIG);
        this.auth = U.getAuth(this.app);
        this.db = F.getFirestore(this.app);
        try { await U.getRedirectResult(this.auth); } catch (e) { /* 리다이렉트 로그인 없었음 */ }
        U.onAuthStateChanged(this.auth, (u) => { this.user = u; for (const f of this.listeners) f(u); });
        return true;
      } catch (e) { console.warn('cloud init failed', e); this.err = e; return false; }
    })();
    return this.ready;
  }
  async signIn() {
    if (!(await this.init())) throw new Error('클라우드를 준비하지 못했어요');
    const p = new this.U.GoogleAuthProvider();
    try { await this.U.signInWithPopup(this.auth, p); }
    catch (e) {
      if (/popup|cancelled|blocked/i.test(e.code || e.message)) await this.U.signInWithRedirect(this.auth, p);
      else throw e;
    }
  }
  async signOut() { if (this.auth) await this.U.signOut(this.auth); }
  docRef() { return this.F.doc(this.db, 'saves', this.user.uid); }
  async upload(S) {
    if (!this.user) return false;
    const F = this.F, day = Math.floor(S.minutes / 1440) + 1;
    await F.setDoc(this.docRef(), { data: JSON.stringify(S), minutes: S.minutes, day, money: Math.round(S.money || 0), updatedAt: F.serverTimestamp(), app: 'citylife', v: 1 });
    this.lastUp = Date.now();
    return true;
  }
  async download() {
    if (!this.user) return null;
    const snap = await this.F.getDoc(this.docRef());
    if (!snap.exists()) return null;
    const d = snap.data();
    try { return { S: JSON.parse(d.data), day: d.day, money: d.money, at: d.updatedAt?.toDate?.() || null }; } catch (e) { return null; }
  }
}
export const cloud = new Cloud();
