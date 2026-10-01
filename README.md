# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Android push notifications

Push notifications can appear while the app is closed after it is installed as an EAS development or production build. Configure an Expo EAS project and Firebase Cloud Messaging v1 credentials first:

1. Run `eas init` in this folder; the generated EAS project ID is used when registering the push token. Alternatively, set `EXPO_PUBLIC_EAS_PROJECT_ID` during the app build.
2. In Firebase, register an Android app with package `com.mobileapptcc`, download `google-services.json` to this folder, and set `android.googleServicesFile` to `./google-services.json` in `app.json`.
3. Configure Android push credentials with `eas credentials -p android` and upload the Firebase service-account key (FCM v1).
4. Apply `site/server/sql/notifications-migration.sql` to the database and rebuild/reinstall the Android app.

Expo Go is not a supported target for remote push notifications in this project.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
