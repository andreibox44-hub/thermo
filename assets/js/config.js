/*
 * Подключение к Supabase — личный кабинет и история заказов.
 *
 * Значения берутся в панели Supabase: Project Settings → API Keys
 * (Project URL и publishable key, он же anon key). Ключ публичный, его можно
 * хранить в коде: доступ к данным ограничен правилами из supabase/setup.sql.
 *
 * Пока поля пустые, личный кабинет показывает «скоро заработает».
 */
window.CONFIG = {
  supabaseUrl: '',
  supabaseKey: ''
};
