import { api } from "./apiClient";

/**
 * TODO (Практика 4):
 * Реализуйте функции работы с API.
 * Подсказка: используйте api.get/post/patch/delete и возвращайте data.
 */

export async function getProducts() {
    return (await api.get("/products")).data;
  throw new Error("TODO: реализуйте getProducts()");
}

export async function createProduct(payload) {
    return (await api.post("/products", payload)).data;
  throw new Error("TODO: реализуйте createProduct(payload)");
}

export async function updateProduct(id, patch) {
    return (await api.patch(`/products/${id}`, patch)).data;
  throw new Error("TODO: реализуйте updateProduct(id, patch)");
}

export async function deleteProduct(id) {
    return (await api.delete(`/products/${id}`)).data;
  throw new Error("TODO: реализуйте deleteProduct(id)");
}
