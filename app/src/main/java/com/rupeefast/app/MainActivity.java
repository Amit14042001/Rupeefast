package com.rupeefast.app;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * MainActivity — RupeeFast WebView host with fintech-grade security.
 *
 * Uses dedicated helper classes for:
 *   - {@link SecurityConfig}: SSL pinning, root/emulator detection, device fingerprinting
 *   - {@link BiometricHelper}: Fingerprint / face unlock for sensitive operations
 *   - {@link PlayIntegrityHelper}: Google Play Integrity API for device attestation
 */
public class MainActivity extends androidx.appcompat.app.AppCompatActivity {

    private WebView webView;
    private SecurityConfig securityConfig;
    private BiometricHelper biometricHelper;
    private PlayIntegrityHelper playIntegrityHelper;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initialize security helpers
        securityConfig = new SecurityConfig();
        biometricHelper = new BiometricHelper(this);
        playIntegrityHelper = new PlayIntegrityHelper(this);

        // ── Check device integrity on launch ──
        // Block access if device is compromised (rooted or emulator)
        if (SecurityConfig.isDeviceCompromised()) {
            showSecurityWarningAndExit();
            return;
        }

        // Full screen - edge to edge
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
            );
        }

        // Status bar color
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.parseColor("#1B3A6B"));
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }

        webView = new WebView(this);
        setContentView(webView);

        // WebView settings
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        // ── Security: Disable file access for remote content ──
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);

        // Block all third-party cookies
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        }

        // Set User-Agent
        settings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 12; RupeeFast) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36"
        );

        // Enable hardware acceleration
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setBackgroundColor(Color.parseColor("#1B3A6B"));

        // JavaScript bridge
        webView.addJavascriptInterface(new AndroidBridge(), "Android");

        // WebChromeClient for camera/mic permissions
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                request.grant(request.getResources());
            }
        });

        // ── WebViewClient with SSL Pinning & Security Checks ──
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                // Allow loading local assets and specific API domains
                if (url.startsWith("file://") ||
                    url.startsWith("https://api.anthropic.com") ||
                    url.startsWith("https://api.razorpay.com") ||
                    url.startsWith("https://checkout.razorpay.com")) {
                    return false;
                }

                // Open external URLs in default browser
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                } catch (Exception e) {
                    e.printStackTrace();
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Inject viewport height fix
                view.evaluateJavascript(
                    "document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');",
                    null
                );

                // Auto-request integrity check on page load
                view.evaluateJavascript(
                    "if (typeof Android !== 'undefined' && Android.requestIntegrityToken && !window.__integrityChecked) {" +
                    "  window.__integrityChecked = true;" +
                    "  Android.requestIntegrityToken();" +
                    "}",
                    null
                );
            }

            // ── SSL Error Handling with Pinning ──
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                String url = error.getUrl();

                // Allow SSL errors for local development
                if (url != null && (url.startsWith("http://localhost") || url.startsWith("http://10.0.2.2"))) {
                    handler.proceed();
                    return;
                }

                // For production domains, check certificate pinning
                if (url != null && url.startsWith("https://api.rupeefast.com")) {
                    android.net.http.SslCertificate sslCert = error.getCertificate();
                    if (sslCert != null) {
                        java.security.cert.X509Certificate x509Cert = sslCert.getX509Certificate();
                        byte[] encoded = null;
                        try {
                            if (x509Cert != null) {
                                encoded = x509Cert.getEncoded();
                            }
                        } catch (java.security.cert.CertificateEncodingException e) {
                            encoded = null;
                        }
                        if (encoded != null && SecurityConfig.isCertificatePinned(encoded)) {
                            handler.proceed(); // Pin matches — allow
                            return;
                        }
                    }
                }

                // Pin mismatch or unknown domain — cancel
                handler.cancel();
                view.evaluateJavascript(
                    "if (typeof showToast === 'function') { " +
                    "  showToast('Security Error: SSL verification failed', 'error', 5000); " +
                    "}",
                    null
                );
            }
        });

        // Load the app
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript("handleAndroidBack()", value -> {
            if (!"true".equals(value)) {
                moveTaskToBack(true);
            }
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();

        // Clear auth token from memory when app is backgrounded
        webView.evaluateJavascript(
            "if (typeof authToken !== 'undefined') { authToken = null; try { sessionStorage.removeItem('rupeefast_token'); } catch(e){} }",
            null
        );

        // Prevent task snapshot (screenshot protection)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            );
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Prompt re-auth if token was cleared
        webView.evaluateJavascript(
            "if (!authToken && currentUser) { showToast('Session expired. Please login again.', 'info', 4000); logoutUser(); }",
            null
        );

        // Remove FLAG_SECURE on resume
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }

        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        webView.clearHistory();
        webView.clearFormData();
        webView.clearCache(true);
        webView.clearSslPreferences();
        webView.destroy();
        super.onDestroy();
    }

    /**
     * Blocks access and shows a security warning when the device is compromised.
     */
    private void showSecurityWarningAndExit() {
        webView = new WebView(this);
        setContentView(webView);
        String html = "<html><body style='background:#1B3A6B;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;padding:20px;text-align:center;'>" +
            "<div><h1>⚠️ Security Check Failed</h1>" +
            "<p style='font-size:16px;line-height:1.6;margin-top:16px;'>" +
            "This app cannot run on rooted devices, emulators, or devices with modified operating systems. " +
            "Please use a secure device to access RupeeFast.</p>" +
            "<p style='font-size:13px;margin-top:24px;color:rgba(255,255,255,0.6);'>If you believe this is an error, contact support.</p></div></body></html>";
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
    }

    // ─────────────────────────────────────────
    // JavaScript Interface (Android ↔ Web bridge)
    // ─────────────────────────────────────────

    public class AndroidBridge {
        @JavascriptInterface
        public void onReady() {
            // App loaded
        }

        @JavascriptInterface
        public void showToast(String msg) {
            runOnUiThread(() ->
                android.widget.Toast.makeText(MainActivity.this, msg, android.widget.Toast.LENGTH_SHORT).show()
            );
        }

        @JavascriptInterface
        public void vibrate() {
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(android.os.VibrationEffect.createOneShot(50, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(50);
                }
            }
        }

        /**
         * Requests a Play Integrity token for device attestation.
         * Result is passed to JS callback window.__integrityCallback(token).
         */
        @JavascriptInterface
        public void requestIntegrityToken() {
            runOnUiThread(() -> {
                playIntegrityHelper.requestIntegrityToken(new PlayIntegrityHelper.IntegrityCallback() {
                    @Override
                    public void onTokenReceived(String integrityToken) {
                        webView.evaluateJavascript(
                            "if (typeof window.__integrityCallback === 'function') {" +
                            "  window.__integrityCallback('" + integrityToken + "');" +
                            "} else {" +
                            "  window.__integrityToken = '" + integrityToken + "';" +
                            "}",
                            null
                        );
                    }

                    @Override
                    public void onError(int errorCode, String errorMessage) {
                        webView.evaluateJavascript(
                            "if (typeof window.__integrityError === 'function') {" +
                            "  window.__integrityError('" + errorMessage.replace("'", "\\'") + "');" +
                            "}",
                            null
                        );
                    }

                    @Override
                    public void onIntegrityFailed(String reason) {
                        webView.evaluateJavascript(
                            "if (typeof showToast === 'function') { " +
                            "  showToast('" + reason.replace("'", "\\'") + "', 'error', 5000); " +
                            "}",
                            null
                        );
                    }
                });
            });
        }

        /**
         * Returns a hashed device fingerprint for risk scoring.
         */
        @JavascriptInterface
        public String getDeviceFingerprint() {
            return SecurityConfig.getDeviceFingerprint();
        }

        /**
         * Returns true if the device appears to be an emulator.
         */
        @JavascriptInterface
        public boolean isEmulator() {
            return SecurityConfig.isEmulator();
        }

        /**
         * Returns true if the device appears to be rooted.
         */
        @JavascriptInterface
        public boolean isRooted() {
            return SecurityConfig.isRooted();
        }

        /**
         * Returns true if biometric authentication is available on this device.
         */
        @JavascriptInterface
        public boolean isBiometricAvailable() {
            return biometricHelper.isBiometricAvailable();
        }

        /**
         * Returns a reason string if biometrics is unavailable, or empty string if available.
         */
        @JavascriptInterface
        public String getBiometricUnavailabilityReason() {
            String reason = biometricHelper.getUnavailabilityReason();
            return reason != null ? reason : "";
        }
    }
}
