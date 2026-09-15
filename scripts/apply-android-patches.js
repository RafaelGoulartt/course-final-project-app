#!/usr/bin/env node
/**
 * Apply c++_shared patches to node_modules CMakeLists.txt files.
 * Run after npm install to fix Android build on Windows with NDK 27.
 * Root cause: NDK 27 on Windows requires explicit c++_shared linkage.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function patch(relPath, oldStr, newStr) {
  const filePath = path.join(root, 'node_modules', relPath);
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch] File not found: ${relPath}`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(oldStr)) {
    if (content.includes(newStr)) {
      console.log(`[patch] Already patched: ${relPath}`);
    } else {
      console.warn(`[patch] Pattern not found in: ${relPath}`);
    }
    return;
  }
  fs.writeFileSync(filePath, content.replace(oldStr, newStr));
  console.log(`[patch] Applied: ${relPath}`);
}

// expo-modules-core: add c++_shared to final target_link_libraries
patch(
  'expo-modules-core/android/CMakeLists.txt',
  `target_link_libraries(
  \${PACKAGE_NAME}
  ReactAndroid::reactnative
)`,
  `target_link_libraries(
  \${PACKAGE_NAME}
  ReactAndroid::reactnative
  c++_shared
)`
);

// react-native-screens android/CMakeLists.txt (rnscreens shared lib)
patch(
  'react-native-screens/android/CMakeLists.txt',
  `        target_link_libraries(rnscreens
            ReactAndroid::reactnative
            ReactAndroid::jsi
            fbjni::fbjni
            android
        )`,
  `        target_link_libraries(rnscreens
            ReactAndroid::reactnative
            ReactAndroid::jsi
            fbjni::fbjni
            android
            c++_shared
        )`
);

// react-native-screens android/src/main/jni/CMakeLists.txt (react_codegen_rnscreens)
patch(
  'react-native-screens/android/src/main/jni/CMakeLists.txt',
  `  target_link_libraries(
    \${LIB_TARGET_NAME}
    ReactAndroid::reactnative
    ReactAndroid::jsi
    fbjni::fbjni
  )`,
  `  target_link_libraries(
    \${LIB_TARGET_NAME}
    ReactAndroid::reactnative
    ReactAndroid::jsi
    fbjni::fbjni
    c++_shared
  )`
);

// react-native-safe-area-context android/src/main/jni/CMakeLists.txt
patch(
  'react-native-safe-area-context/android/src/main/jni/CMakeLists.txt',
  `  target_link_libraries(
          \${LIB_TARGET_NAME}
          fbjni
          jsi
          reactnative
  )`,
  `  target_link_libraries(
          \${LIB_TARGET_NAME}
          fbjni
          jsi
          reactnative
          c++_shared
  )`
);

// react-native-gesture-handler android/src/main/jni/CMakeLists.txt
patch(
  'react-native-gesture-handler/android/src/main/jni/CMakeLists.txt',
  `target_link_libraries(
  \${PACKAGE_NAME}
  ReactAndroid::reactnative
  ReactAndroid::jsi
  fbjni::fbjni
)`,
  `target_link_libraries(
  \${PACKAGE_NAME}
  ReactAndroid::reactnative
  ReactAndroid::jsi
  fbjni::fbjni
  c++_shared
)`
);

// react-native-reanimated android/CMakeLists.txt
patch(
  'react-native-reanimated/android/CMakeLists.txt',
  `target_link_libraries(reanimated log ReactAndroid::jsi fbjni::fbjni android
                      worklets)`,
  `target_link_libraries(reanimated log ReactAndroid::jsi fbjni::fbjni android
                      worklets c++_shared)`
);

// react-native-worklets android/CMakeLists.txt
patch(
  'react-native-worklets/android/CMakeLists.txt',
  `target_link_libraries(worklets log ReactAndroid::jsi fbjni::fbjni)`,
  `target_link_libraries(worklets log ReactAndroid::jsi fbjni::fbjni c++_shared)`
);

// Copy NDK 27's libc++_shared.so into jniLibs so it overrides the older version
// bundled by React Native's pre-built .aar (which lacks __hash_memory from LLVM 18).
function copyLibcppShared() {
  const androidDir = path.join(root, 'android');
  if (!fs.existsSync(androidDir)) {
    console.log('[patch] android/ not found yet, skipping libc++_shared.so copy');
    return;
  }

  let sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdkDir) {
    const localProps = path.join(androidDir, 'local.properties');
    if (fs.existsSync(localProps)) {
      const m = fs.readFileSync(localProps, 'utf8').match(/^sdk\.dir=(.+)$/m);
      if (m) sdkDir = m[1].trim().replace(/\//g, path.sep);
    }
  }
  if (!sdkDir) {
    console.warn('[patch] Cannot find Android SDK, skipping libc++_shared.so copy');
    return;
  }

  const ndkVersion = '27.1.12297006'; // Must match rootProject.ext.ndkVersion in android/build.gradle
  const hostOs = process.platform === 'win32' ? 'windows-x86_64' : 'linux-x86_64';
  const ndkLibBase = path.join(
    sdkDir, 'ndk', ndkVersion,
    'toolchains', 'llvm', 'prebuilt', hostOs,
    'sysroot', 'usr', 'lib'
  );
  if (!fs.existsSync(ndkLibBase)) {
    console.warn(`[patch] NDK ${ndkVersion} not found at ${ndkLibBase}, skipping`);
    return;
  }

  const abis = {
    'arm64-v8a':   'aarch64-linux-android',
    'armeabi-v7a': 'arm-linux-androideabi',
    'x86':         'i686-linux-android',
    'x86_64':      'x86_64-linux-android',
  };
  for (const [abi, toolchain] of Object.entries(abis)) {
    const src = path.join(ndkLibBase, toolchain, 'libc++_shared.so');
    const destDir = path.join(androidDir, 'app', 'src', 'main', 'jniLibs', abi);
    const dest = path.join(destDir, 'libc++_shared.so');
    if (fs.existsSync(src)) {
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
      console.log(`[patch] Copied libc++_shared.so → jniLibs/${abi}`);
    } else {
      console.warn(`[patch] libc++_shared.so not found for ${abi}: ${src}`);
    }
  }
}

copyLibcppShared();
console.log('[patch] Done.');
