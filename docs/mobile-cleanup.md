# Phone-focused cleanup

Targets are now Android and iOS in portrait orientation; iPad support is disabled. The web script/configuration, HTML shell, browser theme/printing adapters and unused starter UI were removed. Existing login/signup URLs remain compatibility redirects into offline shop registration.

Removed nine unused/redundant direct dependencies: `@expo/vector-icons`, `@gorhom/bottom-sheet`, `@react-navigation/elements`, `expo-haptics`, `expo-symbols`, `expo-web-browser`, `react-native-keyboard-aware-scroll-view`, `react-dom` and `react-native-web`. npm removed 25 packages overall. Required navigation, Expo, NativeWind and Reanimated peers remain; some libraries such as symbols/elements can remain transitively required by Expo Router. Seven unused starter image files were also removed.

Shared form scroll views dismiss the keyboard on drag. Modal sheets avoid the keyboard, and the floating tab bar and sale-product footer hide while it is open. Purchase product selection now uses two columns on ordinary phone widths. Small product-menu/search controls have at least 44-point targets. Existing safe-area spacing, font scaling, receipt/photo behavior and temporary financial amount visibility remain supported.

The shared repository entry now re-exports the existing native SQLite adapter, retaining the same database name and legacy AsyncStorage migration key. Phone photo/QR storage uses retained native files without the former browser data-URI path. No database records, user photos or payment settings were deleted or reset.

Physical-device keyboard, camera and sharing behavior still need device verification. Historical browser QA screenshots in other documents are retained as reference; this change does not target a web release.

Validation passed: all 73 automated tests, full-project lint, TypeScript (after refreshing Expo's generated route declarations), `expo install --check`, `npm ls --depth=0` and an Android Hermes production export with one worker. Restart Metro with `npx expo start --clear` after this dependency cleanup.
