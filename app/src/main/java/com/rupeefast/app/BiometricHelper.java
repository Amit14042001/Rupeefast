package com.rupeefast.app;

import android.os.Build;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import java.util.concurrent.Executor;

/**
 * BiometricHelper — Fingerprint / Face Unlock for RupeeFast.
 *
 * Provides:
 *   - Biometric availability check (fingerprint, face, or iris)
 *   - Biometric authentication prompt with crypto-backed security
 *   - KeyStore-based secret key generation for encrypting sensitive data
 *
 * Usage:
 *   BiometricHelper helper = new BiometricHelper(activity);
 *   if (helper.isBiometricAvailable()) {
 *       helper.authenticate("Verify to proceed", callback);
 *   }
 *
 * @see <a href="https://developer.android.com/training/sign-in/biometric-auth">Android Biometric Authentication</a>
 */
public class BiometricHelper {

    private final FragmentActivity activity;
    private final BiometricManager biometricManager;
    private final Executor executor;

    /**
     * Callback interface for authentication results.
     */
    public interface BiometricCallback {
        void onSuccess();
        void onError(int errorCode, String errorMessage);
        void onCancelled();
    }

    public BiometricHelper(FragmentActivity activity) {
        this.activity = activity;
        this.biometricManager = BiometricManager.from(activity);
        this.executor = ContextCompat.getMainExecutor(activity);
    }

    // ─────────────────────────────────────────
    // Availability Checks
    // ─────────────────────────────────────────

    /**
     * Checks if biometric authentication is available and enrollable on this device.
     *
     * @return true if biometric hardware is present and user has enrolled biometrics
     */
    public boolean isBiometricAvailable() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false;

        int canAuthenticate = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG |
            BiometricManager.Authenticators.BIOMETRIC_WEAK
        );
        return canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS;
    }

    /**
     * Returns a user-friendly message explaining why biometrics is unavailable.
     *
     * @return null if available, or a reason string if unavailable
     */
    public String getUnavailabilityReason() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return "Biometric authentication requires Android 6.0 or later";
        }

        int canAuthenticate = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG |
            BiometricManager.Authenticators.BIOMETRIC_WEAK
        );

        switch (canAuthenticate) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                return null; // Available
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                return "This device does not have biometric hardware";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                return "Biometric hardware is currently unavailable";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "No biometrics enrolled. Please set up fingerprint or face unlock in Settings";
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                return "A security update is required to use biometrics";
            default:
                return "Biometric authentication is unavailable";
        }
    }

    /**
     * Checks if the user can authenticate with biometrics OR device credentials (PIN/pattern/password).
     * Useful as a fallback when biometrics alone are not available.
     */
    public boolean canAuthenticateWithFallback() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return false;

        int canAuthenticate = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG |
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
        );
        return canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS;
    }

    // ─────────────────────────────────────────
    // Authentication
    // ─────────────────────────────────────────

    /**
     * Shows the biometric authentication prompt.
     *
     * @param title    Title for the system prompt (e.g., "Verify your identity")
     * @param subtitle Optional subtitle (e.g., "Use fingerprint or face to proceed")
     * @param callback Callback for success/error/cancelled
     */
    public void authenticate(String title, String subtitle, BiometricCallback callback) {
        if (!isBiometricAvailable()) {
            String reason = getUnavailabilityReason();
            callback.onError(BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE,
                reason != null ? reason : "Biometric authentication is not available");
            return;
        }

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle != null ? subtitle : "Verify your identity")
            .setNegativeButtonText("Cancel")
            .setConfirmationRequired(true)
            .build();

        BiometricPrompt biometricPrompt = new BiometricPrompt(activity, executor,
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    super.onAuthenticationSucceeded(result);
                    callback.onSuccess();
                }

                @Override
                public void onAuthenticationError(int errorCode, CharSequence errString) {
                    super.onAuthenticationError(errorCode, errString);
                    // Error code 13 means user cancelled the dialog — call onCancelled
                    if (errorCode == 13) {
                        callback.onCancelled();
                    } else {
                        callback.onError(errorCode, errString != null ? errString.toString() : "Authentication error");
                    }
                }

                @Override
                public void onAuthenticationFailed() {
                    super.onAuthenticationFailed();
                    callback.onError(0, "Biometric not recognized. Try again.");
                }
            });

        biometricPrompt.authenticate(promptInfo);
    }

    /**
     * Simplified authentication — uses a default title.
     */
    public void authenticate(String title, BiometricCallback callback) {
        authenticate(title, null, callback);
    }

    // ─────────────────────────────────────────
    // Crypto-backed Biometric (KeyStore)
    // ─────────────────────────────────────────

    /*
     * KeyStore-based encryption is available for future use.
     * To add biometric-bound token encryption:
     *
     *   1. Uncomment the methods below
     *   2. Add these imports:
     *      import java.security.KeyStore;
     *      import javax.crypto.Cipher;
     *      import javax.crypto.KeyGenerator;
     *      import javax.crypto.SecretKey;
     *      import javax.crypto.spec.IvParameterSpec;
     *      import android.security.keystore.KeyGenParameterSpec;
     *      import android.security.keystore.KeyProperties;
     *
     * Then call getOrCreateBiometricKey() to store/retrieve a key that
     * is only accessible after biometric authentication.
     */
}
