/**
 * Endereço da API usada pelo app.
 * Para testar com a API local, defina EXPO_PUBLIC_API_BASE_URL no arquivo .env.local
 * (veja .env.example) e reinicie o Metro com `npx expo start -c`.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://course-final-project-eta.vercel.app/api';
