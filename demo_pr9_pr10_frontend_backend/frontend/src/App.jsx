import { useEffect, useMemo, useState } from "react";
import { createProduct, deleteProduct, getProducts, updateProduct } from "./api/productsApi";
import { getAccessToken, clearTokens } from "./api/apiClient";
import { getMe, loginUser, registerUser } from "./api/authApi";

/**
 * App.jsx — демо-панель для практик 9–10.
 *
 * Зачем этот файл:
 * - Не “строим идеальный UI”, а даём минимальные формы/кнопки для демонстрации.
 * - Здесь мы ПРОСТО вызываем функции authApi/productsApi.
 *
 * Где настоящая логика практик 9–10:
 * - backend/routes/auth.js: login выдаёт пару токенов, refresh обновляет пару (Практика 9)
 * - frontend/src/api/apiClient.js: interceptors → Authorization + авто-refresh при 401 (Практика 10)
 *
 * Важно:
 * - App.jsx специально оставлен простым: удобно жать кнопки и видеть поведение токенов.
 */
export default function App() {
  // --- AUTH state ---
  const [mode, setMode] = useState("login"); // login | register
  const [me, setMe] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // поля форм
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");

  // accessToken лежит в localStorage (см. apiClient.js)
  const isAuthed = Boolean(getAccessToken());

  /**
   * loadMe — проверочный защищённый запрос:
   * GET /api/auth/me (требует accessToken)
   *
   * Важно:
   * - токен здесь вручную НЕ добавляем
   * - Authorization добавит request interceptor из apiClient.js
   */
  async function loadMe() {
  const token = getAccessToken(); // читаем актуально "прямо сейчас"
  if (!token) return;

  try {
    const data = await getMe();
    setMe(data);
  } catch {
    clearTokens();
    setMe(null);
  }
}

  // При старте приложения пробуем восстановить сессию по токенам из localStorage
  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRegister(e) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      await registerUser({
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password,
      });
      // В учебной версии после регистрации делаем переход на логин (авто-логин не делаем)
      setMode("login");
    } catch (e2) {
      setAuthError(String(e2?.response?.data?.message || e2?.message || e2));
    } finally {
      setAuthLoading(false);
    }
  }

  /**
   * onLogin:
   * - loginUser делает POST /api/auth/login
   * - получает { accessToken, refreshToken }
   * - сохраняет пару токенов в localStorage через setTokens (см. authApi.js)
   */
  async function onLogin(e) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      await loginUser({ email: email.trim(), password });
      await loadMe();
    } catch (e2) {
      setAuthError(String(e2?.response?.data?.message || e2?.message || e2));
    } finally {
      setAuthLoading(false);
    }
  }

  /**
   * logout (учебный):
   * - просто удаляем токены из localStorage
   * - серверный logout/отзыв refreshToken — это уже усложнение (можно как доп.)
   */
  function onLogout() {
    clearTokens();
    setMe(null);
    setMode("login");
  }

  // --- PRODUCTS state ---
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Минимальная форма добавления товара
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");

  const canSubmit = useMemo(() => title.trim() !== "" && price !== "", [title, price]);

  /**
   * loadProducts:
   * GET /api/products — в учебной версии публичный
   * (список можно видеть без логина)
   */
  async function loadProducts() {
    setError("");
    setLoading(true);
    try {
      const data = await getProducts();
      setItems(data);
    } catch (e) {
      setError(String(e?.response?.data?.message || e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Список товаров грузим сразу (публичный ресурс)
  useEffect(() => {
    loadProducts();
  }, []);

  /**
   * POST /api/products — создание товара
   * (в зависимости от вашего backend может быть публичным или защищённым)
   */
  async function onAdd(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setError("");
    try {
      await createProduct({
        title: title.trim(),
        price: Number(price),
      });
      setTitle("");
      setPrice("");
      await loadProducts();
    } catch (e) {
      setError(String(e?.response?.data?.message || e?.message || e));
    }
  }

  /**
   * DELETE /api/products/:id — обычно защищённый маршрут (authMiddleware на бэкенде)
   * Если accessToken протух, сервер вернёт 401 → apiClient сделает refresh и повторит запрос автоматически.
   */
  async function onDelete(id) {
    setError("");
    try {
      await deleteProduct(id);
      await loadProducts();
    } catch (e) {
      setError(String(e?.response?.data?.message || e?.message || e));
    }
  }

  /**
   * PUT /api/products/:id — защищённый маршрут (по заданию)
   * Отлично подходит для демонстрации: “сломали accessToken → получили 401 → refresh → повтор → успех”.
   */
  async function onPricePlus(id, currentPrice) {
    setError("");
    try {
      await updateProduct(id, { price: Number(currentPrice) + 10 });
      await loadProducts();
    } catch (e) {
      setError(String(e?.response?.data?.message || e?.message || e));
    }
  }

  // ---------- UI styles ----------
  const s = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(180deg, #f7f8fb 0%, #ffffff 40%)",
      color: "#111827",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    },
    wrap: { maxWidth: 1040, margin: "0 auto", padding: "24px 16px 48px" },
    header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 },
    titleBlock: { display: "flex", flexDirection: "column", gap: 8 },
    h1: { margin: 0, fontSize: 22, lineHeight: 1.2, letterSpacing: "-0.02em" },
    subtitle: { margin: 0, color: "#6b7280", fontSize: 14, lineHeight: 1.4 },
    badgeRow: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
    badge: (tone = "neutral") => {
      const map = {
        neutral: { bg: "#eef2ff", fg: "#3730a3", bd: "#c7d2fe" },
        ok: { bg: "#ecfdf5", fg: "#065f46", bd: "#a7f3d0" },
        warn: { bg: "#fffbeb", fg: "#92400e", bd: "#fde68a" },
      };
      const t = map[tone] || map.neutral;
      return {
        padding: "6px 10px",
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      };
    },
    code: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 },

    grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    card: {
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 14,
      boxShadow: "0 10px 25px rgba(17, 24, 39, 0.04)",
      padding: 16,
    },
    cardTitleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
    h2: { margin: 0, fontSize: 16, letterSpacing: "-0.01em" },
    helper: { margin: "10px 0 0", color: "#6b7280", fontSize: 13, lineHeight: 1.45 },

    tabs: { display: "inline-flex", gap: 6, background: "#f3f4f6", border: "1px solid #e5e7eb", padding: 6, borderRadius: 12 },
    tabBtn: (active) => ({
      padding: "8px 12px",
      borderRadius: 10,
      border: "1px solid transparent",
      background: active ? "#ffffff" : "transparent",
      boxShadow: active ? "0 6px 14px rgba(17, 24, 39, 0.06)" : "none",
      color: "#111827",
      fontWeight: 800,
      fontSize: 13,
      cursor: active ? "default" : "pointer",
      opacity: active ? 1 : 0.9,
    }),

    form: { marginTop: 12, display: "grid", gap: 10, maxWidth: 460 },
    field: { display: "grid", gap: 6 },
    label: { fontSize: 12, color: "#374151", fontWeight: 800 },
    input: {
      border: "1px solid #d1d5db",
      borderRadius: 10,
      padding: "10px 12px",
      fontSize: 14,
      outline: "none",
      background: "#fff",
    },
    row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },

    btn: (variant = "primary", disabled = false) => {
      const base = {
        borderRadius: 10,
        padding: "10px 12px",
        fontWeight: 900,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        border: "1px solid transparent",
      };
      const variants = {
        primary: { background: "#111827", color: "#fff" },
        secondary: { background: "#fff", color: "#111827", border: "1px solid #e5e7eb" },
        danger: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" },
        ghost: { background: "transparent", color: "#111827", border: "1px solid #e5e7eb" },
      };
      return { ...base, ...(variants[variant] || variants.primary) };
    },

    alert: (tone = "error") => {
      const map = {
        error: { bg: "#fef2f2", fg: "#991b1b", bd: "#fecaca" },
        info: { bg: "#eff6ff", fg: "#1d4ed8", bd: "#bfdbfe" },
        ok: { bg: "#ecfdf5", fg: "#065f46", bd: "#a7f3d0" },
      };
      const t = map[tone] || map.error;
      return {
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.bd}`,
        fontSize: 13,
        lineHeight: 1.45,
      };
    },

    list: { marginTop: 12, padding: 0, listStyle: "none", display: "grid", gap: 10 },
    item: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      padding: "12px 12px",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      background: "#fff",
    },
    itemLeft: { display: "grid", gap: 2, minWidth: 0 },
    itemTitle: { margin: 0, fontWeight: 900, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    itemMeta: { margin: 0, color: "#6b7280", fontSize: 12 },
    itemActions: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
  };

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <header style={s.header}>
          <div style={s.titleBlock}>
            <h1 style={s.h1}>Практики 9–10 — Refresh tokens + токены на фронте</h1>
            <p style={s.subtitle}>
              Демо-панель: логин/регистрация + защищённые запросы + авто-refresh при 401.
            </p>
          </div>

          <div style={s.badgeRow}>
            <span style={s.badge(me ? "ok" : "warn")}>{me ? "Авторизован" : "Не авторизован"}</span>
            <span style={s.badge("neutral")}>
              API: <span style={s.code}>http://localhost:3000</span>
            </span>
            <span style={s.badge("neutral")}>
              Swagger: <span style={s.code}>/api-docs</span>
            </span>
          </div>
        </header>

        <main style={s.grid}>
          {/* AUTH CARD */}
          <section style={s.card}>
            <div style={s.cardTitleRow}>
              <h2 style={s.h2}>Аутентификация</h2>

              {!me && (
                <div style={s.tabs}>
                  <button style={s.tabBtn(mode === "login")} onClick={() => setMode("login")} disabled={mode === "login"}>
                    Вход
                  </button>
                  <button style={s.tabBtn(mode === "register")} onClick={() => setMode("register")} disabled={mode === "register"}>
                    Регистрация
                  </button>
                </div>
              )}
            </div>

            {me ? (
              <>
                <div style={s.alert("ok")}>
                  Вы вошли как <b>{me.email}</b>
                  <div style={{ marginTop: 6, color: "#065f46" }}>
                    {me.first_name} {me.last_name}
                  </div>
                </div>

                <div style={{ ...s.row, marginTop: 12 }}>
                  <button onClick={onLogout} style={s.btn("secondary")}>Выйти</button>
                  <button onClick={loadMe} style={s.btn("ghost")}>Обновить /me</button>
                </div>

                <div style={s.alert("info")}>
                  Демо: испортите <span style={s.code}>accessToken</span> в DevTools → Local Storage,
                  затем нажмите защищённую кнопку — при 401 сработает refresh + повтор запроса (см. apiClient.js).
                </div>
              </>
            ) : (
              <>
                {mode === "register" ? (
                  <form onSubmit={onRegister} style={s.form}>
                    <div style={s.field}>
                      <div style={s.label}>Email</div>
                      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ivan@mail.ru" style={s.input} />
                    </div>

                    <div style={s.row}>
                      <div style={{ ...s.field, flex: 1 }}>
                        <div style={s.label}>Имя</div>
                        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Иван" style={s.input} />
                      </div>
                      <div style={{ ...s.field, flex: 1 }}>
                        <div style={s.label}>Фамилия</div>
                        <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Иванов" style={s.input} />
                      </div>
                    </div>

                    <div style={s.field}>
                      <div style={s.label}>Пароль</div>
                      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="qwerty123" type="password" style={s.input} />
                    </div>

                    <div style={s.row}>
                      <button disabled={authLoading} style={s.btn("primary", authLoading)}>Создать аккаунт</button>
                      <button type="button" onClick={() => setMode("login")} style={s.btn("secondary")}>Уже есть аккаунт</button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={onLogin} style={s.form}>
                    <div style={s.field}>
                      <div style={s.label}>Email</div>
                      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ivan@mail.ru" style={s.input} />
                    </div>

                    <div style={s.field}>
                      <div style={s.label}>Пароль</div>
                      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="qwerty123" type="password" style={s.input} />
                    </div>

                    <div style={s.row}>
                      <button disabled={authLoading} style={s.btn("primary", authLoading)}>
                        {authLoading ? "Входим..." : "Войти"}
                      </button>
                      <button type="button" onClick={() => setMode("register")} style={s.btn("secondary")}>Регистрация</button>
                    </div>
                  </form>
                )}

                {authError && <div style={s.alert("error")}>Ошибка: {authError}</div>}

                <p style={s.helper}>
                  Токены сохраняются в <span style={s.code}>localStorage</span>. Authorization подставляется автоматически
                  через interceptors (см. <span style={s.code}>src/api/apiClient.js</span>).
                </p>
              </>
            )}
          </section>

          {/* PRODUCTS CARD */}
          <section style={s.card}>
            <div style={s.cardTitleRow}>
              <h2 style={s.h2}>Товары</h2>
              <button type="button" onClick={loadProducts} style={s.btn("secondary")}>Обновить список</button>
            </div>

            <p style={s.helper}>
              <span style={s.code}>GET /api/products</span> — публичный.{" "}
              <span style={s.code}>PUT/DELETE /api/products/:id</span> — защищены JWT (backend/routes/products.js).
            </p>

            <form onSubmit={onAdd} style={{ ...s.row, marginTop: 10 }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Название товара"
                style={{ ...s.input, flex: 1, minWidth: 220 }}
              />
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Цена"
                type="number"
                style={{ ...s.input, width: 140 }}
              />
              <button disabled={!canSubmit} style={s.btn("primary", !canSubmit)}>
                Создать
              </button>
            </form>

            {loading && <div style={s.alert("info")}>Загрузка списка...</div>}
            {error && (
              <div style={s.alert("error")}>
                Ошибка: {error}
                <div style={{ marginTop: 6 }}>
                  Проверьте: backend запущен, CORS настроен, токены валидны.
                </div>
              </div>
            )}

            <ul style={s.list}>
              {items.map((p) => (
                <li key={p.id} style={s.item}>
                  <div style={s.itemLeft}>
                    <p style={s.itemTitle}>{p.title}</p>
                    <p style={s.itemMeta}>
                      ID: <span style={s.code}>{p.id}</span> · Цена: <b>{p.price}</b> ₽
                    </p>
                  </div>

                  <div style={s.itemActions}>
                    <button onClick={() => onPricePlus(p.id, p.price)} style={s.btn("secondary")} disabled={!me}>
                      +10 ₽ (PUT)
                    </button>
                    <button onClick={() => onDelete(p.id)} style={s.btn("danger")} disabled={!me}>
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div style={s.alert("info")}>
              TODO (студентам): детали товара (GET /api/products/:id), форма редактирования (PUT),
              и демонстрация: “сломал accessToken → 401 → refresh → повтор → 200”.
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}