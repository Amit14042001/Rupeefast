# RupeeFast ProGuard Rules

# Keep WebView JavaScript interface
-keepclassmembers class com.rupeefast.app.MainActivity$AndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Activity
-keep class com.rupeefast.app.MainActivity { *; }

# AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**

# WebKit
-keep class android.webkit.** { *; }
-dontwarn android.webkit.**

# Prevent removing useful debug info
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
