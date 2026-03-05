import { api } from "./apiClient";

/**
 * TODO (Практика 4):
 * Реализуйте функции работы с API.
 * Подсказка: используйте api.get/post/patch/delete и возвращайте data.
 */

export async function getProducts() {
  try{
    const response = await api.get('/products');
    return response.data;
  } catch(error){
    console.error('Ошибка при загрузке товаров:', error);
  throw error;
  }
}

export async function createProduct(payload) {
  try{
    const response = await api.post('/products',payload);
    return response.data;
  } catch(error){
    console.error('Ошибка при создании товара:', error);
  throw error;
  }
}

export async function updateProduct(id, patch) {
  try{
    const response = await api.patch(`/products/${id}`, patch);
    return response.data;
  }catch(error){
    console.error('Ошибка при обновлении товара:', error);
  throw error;
  }
}

export async function deleteProduct(id) {
  try{
    const response = await api.delete(`/products/${id}`);
  }catch(error){
    console.error('Ошибка при удалении товара:', error);
  throw error;
  }
}

