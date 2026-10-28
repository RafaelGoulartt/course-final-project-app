# App do celular (TCC)

App Android (Expo + React Native) instalado no celular da criança. Ele:

- conecta ao painel dos pais com o **código de conexão** gerado no site;
- envia o tempo de uso de cada app (pelo app aberto e, a cada hora, pelo serviço em segundo plano);
- mostra as mensagens dos responsáveis e bloqueia os apps que eles suspenderem.

Site e API ficam no repositório `course-final-project`.

## Onde está cada coisa

| Pasta | O que tem |
|---|---|
| `app/(tabs)/index.tsx` | Tela única: código de conexão, permissões e painel com os gráficos |
| `components/` | Painel (`home-dashboard`), modal de mensagem dos pais, logo e ícones |
| `services/device-api.ts` | Chamadas à API (o código vai no cabeçalho `Authorization`) |
| `modules/screenTime.ts` | Ponte JS do módulo nativo ScreenTime |
| `native/android/` | Cópia versionada do código Kotlin (o `android/` é gerado e fica fora do git). Veja o README de lá |

## Rodar

Veja o passo a passo em [COMANDOS.md](COMANDOS.md). Resumo:

```bash
npm install          # o postinstall aplica as correções do build Android (NDK 27)
npm run android      # compila e instala no celular/emulador
```

Para usar a API local, crie `.env.local` com `EXPO_PUBLIC_API_BASE_URL=http://SEU_IP:3001/api`
e reinicie o Metro com `npx expo start -c`.

## Limitações conhecidas

- Só funciona no Android: o iOS não permite ler o tempo de uso de outros apps.
- A criança consegue desinstalar o app ou tirar as permissões nas configurações.
