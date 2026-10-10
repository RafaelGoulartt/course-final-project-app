# Código nativo Android (módulo ScreenTime)

A pasta `android/` é gerada pelo Expo (`npx expo prebuild` / `npx expo run:android`)
e está no `.gitignore`. Os arquivos abaixo foram escritos à mão e **não** são gerados,
por isso ficam guardados aqui. Esta pasta não é compilada: ela é só a cópia versionada.

| Arquivo | Destino em `android/` | O que faz |
|---|---|---|
| `ScreenTimeModule.kt` | `app/src/main/java/com/mobileapptcc/` | Ponte com o JS (`modules/screenTime.ts`): permissões de uso e de sobreposição, `getUsageStats`, liga/desliga o monitor e guarda dados simples (`getItem`/`setItem`) |
| `UsageCalculator.kt` | `app/src/main/java/com/mobileapptcc/` | Calcula o tempo de cada app por dia do calendário a partir dos eventos do sistema (`UsageEvents`), cortando na meia-noite |
| `MonitorService.kt` | `app/src/main/java/com/mobileapptcc/` | Serviço em segundo plano: consulta a API a cada minuto, notifica mensagens dos pais e abre a tela de bloqueio quando um app suspenso é aberto |
| `BlockActivity.kt` | `app/src/main/java/com/mobileapptcc/` | Tela "App suspenso" mostrada por cima do app bloqueado |
| `BootReceiver.kt` | `app/src/main/java/com/mobileapptcc/` | Religa o monitor depois de reiniciar o celular |
| `ScreenTimePackage.kt` | `app/src/main/java/com/mobileapptcc/` | Registra o `ScreenTimeModule` no React Native |
| `MainApplication.kt` | `app/src/main/java/com/mobileapptcc/` | Referência: o arquivo gerado, com a linha `add(ScreenTimePackage())` em `getPackages()` |
| `AndroidManifest.xml` | `app/src/main/` | O manifest completo, com as permissões, o `<queries>` e o registro do serviço, da tela de bloqueio e do receiver |
| `legacy/ScreenTimeModule.2026-05-13.kt` | não usar direto | Versão anterior do módulo (veja abaixo) |

## Restaurar depois de regerar o `android/`

Se o `android/` for apagado ou regerado (`npx expo prebuild --clean`):

1. Copie todos os `.kt` desta pasta (menos o `MainApplication.kt`) para
   `android/app/src/main/java/com/mobileapptcc/`.
2. Em `android/app/src/main/java/com/mobileapptcc/MainApplication.kt`, dentro de
   `getPackages()`, deixe:
   ```kotlin
   PackageList(this).packages.apply {
     add(ScreenTimePackage())
   }
   ```
3. Copie o `AndroidManifest.xml` desta pasta por cima de `android/app/src/main/AndroidManifest.xml`.
   Se o Expo tiver mudado algo no manifest gerado, compare os dois e junte só estas partes:
   - as `<uses-permission>` de `PACKAGE_USAGE_STATS`, `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE`,
     `FOREGROUND_SERVICE_SPECIAL_USE`, `POST_NOTIFICATIONS` e `RECEIVE_BOOT_COMPLETED`;
   - as duas `<intent>` extras dentro de `<queries>` (`LAUNCHER` e `HOME`);
   - a `<activity android:name=".BlockActivity">`, o `<service android:name=".MonitorService">`
     e o `<receiver android:name=".BootReceiver">` dentro de `<application>`.
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
