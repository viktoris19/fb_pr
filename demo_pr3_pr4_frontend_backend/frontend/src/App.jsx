import { useEffect, useMemo, useState } from "react";
import { createProduct, deleteProduct, getProducts, updateProduct } from "./api/productsApi";

/**
 * Практика 4 (заготовка).
 * Важно: это НЕ готовое решение. В файле api/productsApi.js стоят TODO.
 * Цель: подключить React к вашему Express API и выполнить базовый CRUD.
 */
import "./App.css";

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  const canSubmit = useMemo(() => 
   title.trim() !== "" &&
   price !== "" &&
   Number(price) > 0 &&
   category.trim() !== "" &&
   stock !== "" && 
   Number(stock) >= 0, 
   [title, price, category, stock]);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const data = await getProducts(); // TODO: заработает после реализации productsApi.js
      setItems(data);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onAdd(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setError("");
    try {
      await createProduct({
        title: title.trim(),
        category: category.trim(),
        description: description.trim() || "Нет описания",
        price: Number(price),
        stock: Number(stock),
      });
      setTitle("");
      setCategory("");
      setDescription("");
      setPrice("");
      setStock("");
      await load();
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  async function onDelete(id) {
    if (!window.confirm("Удалить товар?")) return;

    setError("");
    try {
      await deleteProduct(id);
      await load();
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  async function onPricePlus(id, currentPrice) {
    setError("");
    try {
      await updateProduct(id, { price: Number(currentPrice) + 10 });
      await load();
    } catch (e) {
      setError(String(e?.message || e));
    }
  }

  async function onStockPlus(id, currentStock) {
  setError("");
  try {
    await updateProduct(id, { stock: Number(currentStock) + 1 });
    await load();
  } catch (e) {
    setError(String(e?.message || e));
  }
}

  return (
    <div className="app">
      <header className="header">
        <h1>Интернет-магазин товаров</h1>
        <p>Практика 4 — React + Express API</p>
      </header>

      <main className="container">
        {/* Секция добавления товара */}
        <section className="add-form-section">
          <h2>Добавить товар</h2>
          
          <form onSubmit={onAdd} className="add-form">
            <div className="form-group">
              <label>Название *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например, Кофе"
                required
              />
            </div>

            <div className="form-group">
              <label>Категория *</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Например, Напитки"
                required
              />
            </div>

            <div className="form-group">
              <label>Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Краткое описание товара"
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Цена (₽) *</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label>Количество на складе *</label>
                <input
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="submit" 
                disabled={!canSubmit} 
                className="btn btn-primary"
              >
                Добавить товар
              </button>
              <button 
                type="button" 
                onClick={load} 
                className="btn btn-secondary"
              >
                Обновить список
              </button>
            </div>
          </form>
        </section>

        {/* Секция списка товаров */}
        <section className="products-section">
          <h2>Список товаров ({items.length})</h2>

          {loading && <div className="loading">Загрузка...</div>}
          
          {error && (
            <div className="error">
              Ошибка: {error}
              <details>
                <summary>Подробнее</summary>
                <p>Проверьте, что:</p>
                <ul>
                  <li>backend запущен на порту 3000</li>
                  <li>CORS настроен</li>
                  <li>TODO в productsApi.js реализованы</li>
                </ul>
              </details>
            </div>
          )}

          <div className="products-grid">
            {items.map((product) => (
              <div key={product.id} className="product-card">
                <div className="product-header">
                  <h3 className="product-title">{product.title}</h3>
                  <span className="product-category">{product.category}</span>
                </div>
                
                <p className="product-description">{product.description}</p>
                
                <div className="product-details">
                  <div className="product-price">
                    <strong>Цена:</strong> {product.price} ₽
                  </div>
                  <div className="product-stock">
                    <strong>В наличии:</strong> {product.stock} шт.
                  </div>
                  {product.rating && (
                    <div className="product-rating">
                      <strong>Рейтинг:</strong> {product.rating}/5
                    </div>
                  )}
                </div>

                <div className="product-actions">
                  <button 
                    onClick={() => onPricePlus(product.id, product.price)}
                    className="btn btn-small"
                  >
                    +10 ₽
                  </button>
                  <button 
                    onClick={() => onStockPlus(product.id, product.stock)}
                    className="btn btn-small"
                  >
                    +1 шт
                  </button>
                  <button 
                    onClick={() => onDelete(product.id)}
                    className="btn btn-danger btn-small"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!loading && items.length === 0 && (
            <div className="empty-state">
              <p>Товаров пока нет. Добавьте первый товар!</p>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Интернет-магазин. Практика 4</p>
      </footer>
    </div>
  );
}
