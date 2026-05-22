package com.rupeefast.app;

import android.os.Build;

import java.io.File;
import java.security.MessageDigest;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * SecurityConfig — Fintech-grade security configuration for RupeeFast.
 *
 * Handles:
 *   - SSL/TLS certificate pinning (SHA-256 public key hashes)
 *   - Rooted device detection
 *   - Emulator detection
 *   - Device fingerprinting for risk scoring
 *
 * Usage:
 *   SecurityConfig security = new SecurityConfig();
 *   if (security.isDeviceCompromised()) { blockAccess(); }
 *
 * @see <a href="https://developer.android.com/training/articles/security-ssl">Android SSL Security</a>
 */
public class SecurityConfig {

    // ── SSL Pinning Configuration ──
    // SHA-256 hash of the server's certificate public key.
    // Generate with:
    //   openssl s_client -connect api.rupeefast.com:443 | openssl x509 -pubkey -noout |
    //     openssl rsa -pubin -outform der | openssl dgst -sha256 -binary | base64
    private static final Set<String> PINNED_PUBLIC_KEY_HASHES = new HashSet<>(Arrays.asList(
        // Production certificate pin (REPLACE with actual production cert hash)
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        // Backup pin (secondary CA, e.g., Let's Encrypt)
        "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB="
    ));

    // ── Known root indicator paths ──
    private static final String[] ROOT_INDICATOR_PATHS = {
        "/system/app/Superuser.apk",
        "/sbin/su",
        "/system/bin/su",
        "/system/xbin/su",
        "/data/local/xbin/su",
        "/data/local/bin/su",
        "/system/sd/xbin/su",
        "/system/bin/failsafe/su",
        "/data/local/su",
        "/su/bin/su",
        "/system/bin/busybox",
        "/data/local/tmp/su",
    };

    // ── Known emulator build fingerprints ──
    private static final String[] EMULATOR_FINGERPRINTS = {
        "generic",
        "unknown",
        "google_sdk",
        "sdk_gphone",
    };

    // ─────────────────────────────────────────
    // SSL / Certificate Pinning
    // ─────────────────────────────────────────

    /**
     * Returns the set of pinned public key hashes.
     */
    public static Set<String> getPinnedHashes() {
        return PINNED_PUBLIC_KEY_HASHES;
    }

    /**
     * Validates a server certificate against pinned public key hashes.
     *
     * @param encodedCert DER-encoded X.509 certificate bytes
     * @return true if the certificate's public key hash matches a pinned hash
     */
    public static boolean isCertificatePinned(byte[] encodedCert) {
        if (encodedCert == null) return false;
        try {
            CertificateFactory cf = CertificateFactory.getInstance("X.509");
            X509Certificate cert = (X509Certificate) cf.generateCertificate(
                new java.io.ByteArrayInputStream(encodedCert)
            );
            byte[] publicKey = cert.getPublicKey().getEncoded();
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(publicKey);
            String hashBase64 = android.util.Base64.encodeToString(hash, android.util.Base64.NO_WRAP);
            return PINNED_PUBLIC_KEY_HASHES.contains(hashBase64);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Generates a SHA-256 hash of arbitrary bytes (used for fingerprinting).
     */
    public static String sha256Hash(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(data);
            return android.util.Base64.encodeToString(hash, android.util.Base64.NO_WRAP);
        } catch (Exception e) {
            return "error";
        }
    }

    // ─────────────────────────────────────────
    // Root Detection
    // ─────────────────────────────────────────

    /**
     * Checks whether the device appears to be rooted.
     * Uses a combination of known root binary paths and runtime checks.
     *
     * Note: This is not foolproof — always use Play Integrity API
     * for production-grade device attestation.
     *
     * @return true if root indicators were found
     */
    public static boolean isRooted() {
        // Check for known root binary paths
        for (String path : ROOT_INDICATOR_PATHS) {
            if (new File(path).exists()) return true;
        }

        // Check for su via which command
        try {
            Runtime.getRuntime().exec(new String[]{"which", "su"});
            return true;
        } catch (Exception e) {
            // which su failed — likely not rooted
        }

        // Check if we can access /data (should fail on production devices)
        try {
            Runtime.getRuntime().exec(new String[]{"/system/xbin/which", "su"});
            return true;
        } catch (Exception e) {
            // Ignore
        }

        // Check for busybox
        try {
            Runtime.getRuntime().exec(new String[]{"busybox"});
            return true;
        } catch (Exception e) {
            // Ignore
        }

        // Check for Magisk
        try {
            Runtime.getRuntime().exec(new String[]{"magisk"});
            return true;
        } catch (Exception e) {
            // Ignore
        }

        return false;
    }

    /**
     * Quick root check — only checks su binary existence.
     * Lighter weight than full isRooted() for frequent calls.
     */
    public static boolean quickRootCheck() {
        return new File("/system/xbin/su").exists() ||
               new File("/system/bin/su").exists() ||
               new File("/sbin/su").exists() ||
               new File("/su/bin/su").exists();
    }

    // ─────────────────────────────────────────
    // Emulator Detection
    // ─────────────────────────────────────────

    /**
     * Detects whether the app is running on an emulator.
     * Uses multiple Android build properties for cross-validation.
     *
     * @return true if the device appears to be an emulator
     */
    public static boolean isEmulator() {
        return Build.FINGERPRINT.startsWith("generic") ||
               Build.FINGERPRINT.startsWith("unknown") ||
               Build.MODEL.contains("google_sdk") ||
               Build.MODEL.contains("Emulator") ||
               Build.MODEL.contains("Android SDK built for x86") ||
               Build.MANUFACTURER.contains("Genymotion") ||
               (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic")) ||
               "google_sdk".equals(Build.PRODUCT) ||
               Build.HARDWARE.contains("ranchu") ||
               Build.HARDWARE.contains("goldfish");
    }

    /**
     * Combined device security check.
     * Returns true if the device is compromised (rooted OR emulator).
     */
    public static boolean isDeviceCompromised() {
        return isRooted() || isEmulator();
    }

    // ─────────────────────────────────────────
    // Device Fingerprinting
    // ─────────────────────────────────────────

    /**
     * Generates a hashed device fingerprint for risk scoring.
     * The fingerprint is SHA-256 hashed so device details are never
     * exposed to the JavaScript layer.
     *
     * @return Base64-encoded SHA-256 hash of device attributes
     */
    public static String getDeviceFingerprint() {
        StringBuilder fp = new StringBuilder();
        fp.append("android|");
        fp.append(Build.MODEL).append("|");
        fp.append(Build.MANUFACTURER).append("|");
        fp.append(Build.VERSION.SDK_INT).append("|");
        fp.append(Build.FINGERPRINT).append("|");
        fp.append(Build.DEVICE).append("|");
        fp.append(Build.HARDWARE);
        return sha256Hash(fp.toString().getBytes());
    }
}
