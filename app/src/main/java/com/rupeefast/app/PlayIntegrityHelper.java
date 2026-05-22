package com.rupeefast.app;

import androidx.annotation.NonNull;

import com.google.android.play.core.integrity.IntegrityManager;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.IntegrityTokenRequest;
import com.google.android.play.core.integrity.IntegrityTokenResponse;

/**
 * PlayIntegrityHelper — Google Play Integrity API wrapper for RupeeFast.
 *
 * Provides device-level attestation to detect:
 *   - Rooted / jailbroken devices
 *   - Emulators
 *   - Modified ROMs / custom OS
 *   - App tampering / repackaging
 *   - Debuggable apps in production
 *
 * Usage (from JavaScript via AndroidBridge):
 *   Android.requestIntegrityToken()  // Calls this helper, returns token via JS callback
 *
 * API Reference:
 *   https://developer.android.com/google/play/integrity/overview
 *
 * Prerequisites:
 *   - Google Play Services must be available on the device
 *   - Cloud Project Number must be set in build.gradle:
 *       buildConfigField "String", "CLOUD_PROJECT_NUMBER", "..."
 *   - App must be published to Play Console (or use testing tracks)
 */
public class PlayIntegrityHelper {

    /**
     * Callback interface for integrity token results.
     */
    public interface IntegrityCallback {
        void onTokenReceived(String integrityToken);
        void onError(int errorCode, String errorMessage);
        void onIntegrityFailed(String reason);
    }

    private final MainActivity activity;
    private final long cloudProjectNumber;

    // ── Error code constants ──
    public static final int ERROR_NO_INTERNET = -1;
    public static final int ERROR_PLAY_SERVICES_NOT_FOUND = -2;
    public static final int ERROR_API_NOT_AVAILABLE = -3;
    public static final int ERROR_TOKEN_REQUEST_FAILED = -4;
    public static final int ERROR_INTERNAL = -5;

    public PlayIntegrityHelper(MainActivity activity) {
        this.activity = activity;
        this.cloudProjectNumber = com.rupeefast.app.BuildConfig.CLOUD_PROJECT_NUMBER.equals("0")
            ? 0L
            : Long.parseLong(com.rupeefast.app.BuildConfig.CLOUD_PROJECT_NUMBER);
    }

    /**
     * Requests a Play Integrity token from Google Play Services.
     *
     * The token is an encrypted JWT that should be verified server-side
     * using Google's Play Integrity API service.
     *
     * For development/testing, returns a mock token when the real API
     * is not available.
     *
     * @param callback Callback for token result
     */
    public void requestIntegrityToken(@NonNull IntegrityCallback callback) {
        // ── Check if Cloud Project Number is configured ──
        if (cloudProjectNumber <= 0) {
            // Cloud project not configured — use mock token for development
            String mockToken = generateDevToken();
            callback.onTokenReceived(mockToken);
            return;
        }

        // ── Check for Google Play Services ──
        try {
            com.google.android.gms.common.GoogleApiAvailability googleApi =
                com.google.android.gms.common.GoogleApiAvailability.getInstance();
            int resultCode = googleApi.isGooglePlayServicesAvailable(activity);
            if (resultCode != com.google.android.gms.common.ConnectionResult.SUCCESS) {
                callback.onError(ERROR_PLAY_SERVICES_NOT_FOUND,
                    "Google Play Services not available (code: " + resultCode + ")");
                return;
            }
        } catch (Exception e) {
            // Play Services library may not be included; fall through to dev token
        }

        try {
            // Create IntegrityManager instance
            IntegrityManager integrityManager = IntegrityManagerFactory.create(activity.getApplicationContext());

            // Build the token request with the cloud project number
            IntegrityTokenRequest tokenRequest = IntegrityTokenRequest.builder()
                .setCloudProjectNumber(cloudProjectNumber)
                .build();

            // Request the integrity token (async — no Tasks.call() wrapper needed)
            integrityManager.requestIntegrityToken(tokenRequest)
                .addOnSuccessListener(response -> {
                    String token = response.token();
                    callback.onTokenReceived(token);
                })
                .addOnFailureListener(e -> {
                    int errorCode = extractErrorCode(e);
                    callback.onError(errorCode, "Integrity API error: " + e.getMessage());
                });
        } catch (Exception e) {
            // Fallback: run basic integrity checks when Play Integrity API is unavailable
            runBasicIntegrityChecks(callback);
        }
    }

    /**
     * Runs basic device integrity checks when Play Integrity API is unavailable.
     * This is NOT a replacement for the real API — it's a fallback for development/testing.
     *
     * For compromised devices, calls onIntegrityFailed instead of returning a token.
     */
    private void runBasicIntegrityChecks(@NonNull IntegrityCallback callback) {
        // Check if device is compromised (rooted or emulator)
        if (SecurityConfig.isDeviceCompromised()) {
            StringBuilder reason = new StringBuilder();
            if (SecurityConfig.isRooted()) {
                reason.append("Device appears to be rooted. ");
            }
            if (SecurityConfig.isEmulator()) {
                reason.append("App is running on an emulator. ");
            }
            reason.append("This app requires a secure device.");
            callback.onIntegrityFailed(reason.toString());
            return;
        }

        // Device passed basic checks — generate a mock integrity token
        StringBuilder verdict = new StringBuilder();
        verdict.append("{\"deviceIntegrity\":");
        verdict.append("\"MEETS_DEVICE_INTEGRITY\"");
        verdict.append(",\"appIntegrity\":");
        verdict.append("\"RECOGNIZED_VERIFIED\"");
        verdict.append(",\"accountDetails\":{\"appLicensing\":\"LICENSED\"}");
        verdict.append(",\"requestDetails\":{\"requestPackageName\":\"");
        verdict.append(activity.getPackageName());
        verdict.append("\"}}");

        try {
            String mockToken = android.util.Base64.encodeToString(
                verdict.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8),
                android.util.Base64.NO_WRAP
            );
            callback.onTokenReceived(mockToken);
        } catch (Exception e) {
            callback.onError(ERROR_INTERNAL, "Failed to generate mock token: " + e.getMessage());
        }
    }

    /**
     * Generates a development-only mock integrity token.
     * This should NEVER be used in production builds.
     */
    private String generateDevToken() {
        long timestamp = System.currentTimeMillis();
        String payload = "{" +
            "\"deviceIntegrity\":\"MEETS_DEVICE_INTEGRITY\"," +
            "\"appIntegrity\":\"RECOGNIZED_VERIFIED\"," +
            "\"accountDetails\":{\"appLicensing\":\"LICENSED\"}," +
            "\"requestDetails\":{\"requestPackageName\":\"" + activity.getPackageName() + "\"}," +
            "\"ts\":\"" + timestamp + "\"" +
            "}";

        return "dev_play_integrity_" +
            android.util.Base64.encodeToString(
                payload.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                android.util.Base64.NO_WRAP
            ) + "_" + timestamp;
    }

    /**
     * Extracts a numeric error code from an Integrity API exception.
     *
     * Maps known IntegrityErrorCode constants to our error codes.
     * @see com.google.android.play.core.integrity.model.IntegrityErrorCode
     */
    private int extractErrorCode(Throwable e) {
        String msg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";

        // Try to match common error patterns
        if (msg.contains("network") || msg.contains("no_internet") || msg.contains("timeout")) {
            return ERROR_NO_INTERNET;
        }
        if (msg.contains("service_unavailable") || msg.contains("unavailable") || msg.contains("not_available")) {
            return ERROR_API_NOT_AVAILABLE;
        }
        if (msg.contains("internal") || msg.contains("play_internal")) {
            return ERROR_INTERNAL;
        }
        // Default: generic token request failure
        return ERROR_TOKEN_REQUEST_FAILED;
    }

    /**
     * Returns a user-friendly error message for an error code.
     */
    public static String getErrorMessage(int errorCode) {
        switch (errorCode) {
            case ERROR_PLAY_SERVICES_NOT_FOUND:
                return "Google Play Services not found";
            case ERROR_NO_INTERNET:
                return "No internet connection — cannot verify device integrity";
            case ERROR_API_NOT_AVAILABLE:
                return "Integrity service is temporarily unavailable";
            case ERROR_TOKEN_REQUEST_FAILED:
                return "Failed to request integrity token";
            default:
                return "Unknown integrity error (code: " + errorCode + ")";
        }
    }
}
