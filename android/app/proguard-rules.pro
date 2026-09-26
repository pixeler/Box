# Capacitor ProGuard rules
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

-keep class com.capacitorjs.plugins.** { *; }
-dontwarn com.capacitorjs.plugins.**

-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

