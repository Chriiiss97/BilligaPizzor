# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ─── Capacitor / WebView bridge ─────────────────────────────────────────────
# R8 must not remove or rename any Capacitor classes; the WebView JS bridge
# calls them by fully-qualified name at runtime.
-keep class com.getcapacitor.** { *; }
-keepclassmembers class com.getcapacitor.** { *; }

# Keep the app's own package so Capacitor plugins can resolve it.
-keep class se.billigapizzor.app.** { *; }

# Preserve methods annotated with @JavascriptInterface so the JS↔Java bridge works.
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve generic type signatures used by Capacitor's plugin loader.
-keepattributes Signature
-keepattributes *Annotation*

# AndroidX / AppCompat / Splash Screen – keep public API surface.
-keep class androidx.core.splashscreen.** { *; }

