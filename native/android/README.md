# Código nativo Android (módulo ScreenTime)

A pasta `android/` é gerada pelo Expo (`npx expo prebuild` / `npx expo run:android`)
e está no `.gitignore`. Os arquivos abaixo foram escritos à mão e **não** são gerados,
por isso ficam guardados aqui. Esta pasta não é compilada: ela é só a cópia versionada.

| Arquivo | Destino em `android/` | O que faz |
|---|---|---|
| `ScreenTimeModule.kt` | `app/src/main/java/com/mobileapptcc/` | Lê o tempo de uso dos apps (`UsageStatsManager`) e expõe `hasPermission`, `requestPermission` e `getUsageStats` para o JS (`modules/screenTime.ts`) |
| `ScreenTimePackage.kt` | `app/src/main/java/com/mobileapptcc/` | Registra o `ScreenTimeModule` no React Native |
| `MainApplication.kt` | `app/src/main/java/com/mobileapptcc/` | Referência: o arquivo gerado, com a linha `add(ScreenTimePackage())` em `getPackages()` |
| `AndroidManifest.xml` | `app/src/main/` | Referência: o manifest atual, com a permissão `android.permission.PACKAGE_USAGE_STATS` |
| `legacy/ScreenTimeModule.2026-05-13.kt` | não usar direto | Versão anterior do módulo (veja abaixo) |

## Restaurar depois de regerar o `android/`

Se o `android/` for apagado ou regerado (`npx expo prebuild --clean`):

1. Copie `ScreenTimeModule.kt` e `ScreenTimePackage.kt` para
   `android/app/src/main/java/com/mobileapptcc/`.
2. Em `android/app/src/main/java/com/mobileapptcc/MainApplication.kt`, dentro de
   `getPackages()`, deixe:
   ```kotlin
   PackageList(this).packages.apply {
     add(ScreenTimePackage())
   }
   ```
3. Em `android/app/src/main/AndroidManifest.xml`, adicione dentro de `<manifest>`:
   ```xml
   <uses-permission
     android:name="android.permission.PACKAGE_USAGE_STATS"
     tools:ignore="ProtectedPermissions"
     xmlns:tools="http://schemas.android.com/tools"/>
   ```
4. Rode `npm install` (o `postinstall` reaplica as correções do NDK 27) e depois
   `npm run android`.

Ao alterar o módulo dentro de `android/`, copie a nova versão para cá e faça o commit.

## Versão anterior (`legacy/`)

Comparada à versão atual, a versão de 13/05/2026:

- separa os dados **por dia** (de 00:00 a 23:59), em vez de uma janela de N×24h;
- ignora apps usados por **menos de 1 minuto**;
- envia também o **nome do app** (`nome`, ex.: "WhatsApp"), além do pacote;
- envia `tempo_minutos` como **inteiro**;
- rejeita a promise (`PERMISSION_DENIED`) quando não há permissão.

Serve de referência caso algum desses comportamentos precise voltar. Antes de trocar,
confira o formato que a API (`/dashboard/tempo-uso`) espera, por exemplo se ela aceita
o campo `nome` e minutos com casas decimais.
