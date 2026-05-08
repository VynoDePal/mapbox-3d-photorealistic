// happy-dom 20 occasionally exposes a non-functional Storage stub. Install a tiny in-memory polyfill
// before each test file runs so localStorage / sessionStorage behave normally in unit tests.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const ls = new MemoryStorage();
const ss = new MemoryStorage();

Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: ss, configurable: true });
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: ls, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: ss, configurable: true });
}
