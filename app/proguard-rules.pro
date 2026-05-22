# ==============================================================================
# RupeeFast ProGuard Rules — Fintech-Grade Obfuscation & Shrinking
# ==============================================================================
#
# These rules cover:
#   - WebView JavaScript interface preservation
#   - Retrofit / OkHttp for Play Integrity
#   - JSON parsing (Gson / Moshi)
#   - Crash reporting (Sentry)
#   - Database drivers (PG)
#   - Security & obfuscation hardening
# ==============================================================================

# ── Application entry point ──────────────────────────────────────────────────
-keep class com.rupeefast.app.MainActivity { *; }

# ── WebView JavaScript bridge ────────────────────────────────────────────────
-keepclassmembers class com.rupeefast.app.MainActivity$AndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Play Integrity API ───────────────────────────────────────────────────────
-keep class com.google.android.play.core.integrity.** { *; }
-dontwarn com.google.android.play.core.integrity.**

# ── WebView & WebKit ─────────────────────────────────────────────────────────
-keep class android.webkit.** { *; }
-dontwarn android.webkit.**

# ── AndroidX ─────────────────────────────────────────────────────────────────
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# ── OkHttp (used by Play Integrity) ──────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**

# ── JSON parsing ─────────────────────────────────────────────────────────────
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-keep class com.google.gson.** { *; }
-keep class org.json.** { *; }

# ── Sentry Crash Reporting ───────────────────────────────────────────────────
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**
-keepattributes LineNumberTable, SourceFile
-renamesourcefileattribute SourceFile

# ── Database (PG driver) ─────────────────────────────────────────────────────
-dontwarn org.postgresql.**
-dontwarn com.impossibl.postgres.**
-keep class org.postgresql.** { *; }

# ── JavaScript Interface return types ────────────────────────────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Resource shrinking (keep strings that are used programmatically) ─────────
-keepclassmembers class com.rupeefast.app.R$string {
    public static <fields>;
}
-keepclassmembers class com.rupeefast.app.R$layout {
    public static <fields>;
}

# ── Obfuscation hardening ────────────────────────────────────────────────────

# Avoid removing useful debug info in release builds
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile

# Keep enum classes (enums are often used with switch statements)
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep Parcelable implementations
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Remove logging in release builds (optional — uncomment if desired)
# -assumenosideeffects class android.util.Log {
#     public static boolean isLoggable(java.lang.String, int);
#     public static int v(...);
#     public static int d(...);
#     public static int i(...);
#     public static int w(...);
# }
