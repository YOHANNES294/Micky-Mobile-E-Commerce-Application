# Flutter
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Keep SharedPreferences and Pigeon platform channel classes
-keep class io.flutter.plugins.sharedpreferences.** { *; }
-keepclassmembers class * implements io.flutter.plugin.common.PluginRegistry {
    *;
}
