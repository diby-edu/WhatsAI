package com.wazzapai.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    // Dark background to match the app theme
    private static final int STATUS_BAR_COLOR = Color.parseColor("#0f172a");
    private static final String PREFS_NAME = "WazzapAIPrefs";
    private static final String TOKEN_KEY = "fcm_token";

    // Track when app is ready (WebView loaded)
    private boolean isAppReady = false;

    // Permission request launcher for notifications (Android 13+)
    private final ActivityResultLauncher<String> requestPermissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), isGranted -> {
            if (isGranted) {
                // Permission granted - notifications will work
                android.util.Log.d("WazzapAI", "Notification permission granted");
            } else {
                // Permission denied - user won't receive notifications
                android.util.Log.d("WazzapAI", "Notification permission denied");
            }
        });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Install splash screen BEFORE super.onCreate()
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);

        // Keep splash screen visible until app is ready (max 3 seconds)
        splashScreen.setKeepOnScreenCondition(() -> !isAppReady);

        // Auto-dismiss after 3 seconds max
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            isAppReady = true;
        }, 3000);

        super.onCreate(savedInstanceState);

        // Set window background color to match status bar (prevents white line)
        getWindow().getDecorView().setBackgroundColor(STATUS_BAR_COLOR);

        // Android 15+ enforces edge-to-edge for targetSdk 35+.
        // We opt into a single insets path for all Android versions.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Apply status bar config immediately
        configureStatusBar();

        // Create notification channel for push notifications
        createNotificationChannel();

        // Request notification permission (Android 13+)
        requestNotificationPermission();

        // Get FCM token and sync it to the WebView
        getFcmToken();

        // Re-apply after a delay to override any Capacitor/WebView changes
        new Handler(Looper.getMainLooper()).postDelayed(this::configureStatusBar, 100);
        new Handler(Looper.getMainLooper()).postDelayed(this::configureStatusBar, 500);
        new Handler(Looper.getMainLooper()).postDelayed(this::configureStatusBar, 1000);
    }

    private void requestNotificationPermission() {
        // Request notification permission for Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                // Request permission
                requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
    }

    private void getFcmToken() {
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    android.util.Log.w("WazzapAI", "Fetching FCM token failed", task.getException());
                    return;
                }

                String token = task.getResult();
                android.util.Log.d("WazzapAI", "FCM Token: " + token);

                persistTokenLocally(token);
                syncTokenToWebView(token);
            });
    }

    private void persistTokenLocally(String token) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(TOKEN_KEY, token).apply();
    }

    private void syncStoredTokenToWebView() {
        String storedToken = WazzapFirebaseMessagingService.getStoredToken(this);
        if (storedToken == null || storedToken.isEmpty()) {
            return;
        }

        syncTokenToWebView(storedToken);
    }

    private void syncTokenToWebView(String token) {
        if (token == null || token.isEmpty() || getBridge() == null) {
            return;
        }

        WebView webView = getBridge().getWebView();
        if (webView == null) {
            return;
        }

        String escapedToken = JSONObject.quote(token);
        String script = "try {" +
            "localStorage.setItem('fcm_token', " + escapedToken + ");" +
            "window.dispatchEvent(new CustomEvent('native-fcm-token-available', { detail: { token: " + escapedToken + " } }));" +
            "} catch (e) { console.error('FCM sync failed', e); }";

        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void createNotificationChannel() {
        // Create notification channel for Android 8.0+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            String channelId = "wazzapai_notifications";
            String channelName = "WazzapAI Notifications";
            String channelDescription = "Notifications pour les messages, commandes et alertes WazzapAI";

            NotificationChannel channel = new NotificationChannel(
                channelId,
                channelName,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(channelDescription);
            channel.enableLights(true);
            channel.setLightColor(Color.parseColor("#10b981"));
            channel.enableVibration(true);
            channel.setShowBadge(true);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-apply every time the activity resumes
        configureStatusBar();
    }

    private void configureStatusBar() {
        Window window = getWindow();

        // Keep light-status/nav appearance disabled so icons stay white
        // on our dark header background (without deprecated status bar color APIs).
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }
    }

    private void applySystemBarInsets(WebView webView) {
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            int types = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets insets = windowInsets.getInsets(types);

            // Push WebView content away from status/navigation bars.
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom);

            // We handled these insets natively; pass zeroed values down to avoid double-padding.
            return new WindowInsetsCompat.Builder(windowInsets)
                .setInsets(types, Insets.NONE)
                .build();
        });

        ViewCompat.requestApplyInsets(webView);
    }

    private void configureWebViewContainer(WebView webView) {
        // Set WebView background to match app chrome
        webView.setBackgroundColor(STATUS_BAR_COLOR);

        // Set parent container background too
        ViewGroup parent = (ViewGroup) webView.getParent();
        if (parent != null) {
            parent.setBackgroundColor(STATUS_BAR_COLOR);
        }
    }

    @Override
    public void onStart() {
        super.onStart();

        // Get the WebView and configure scroll settings
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();

            applySystemBarInsets(webView);
            configureWebViewContainer(webView);

            // Enable smooth scrolling
            webView.setOverScrollMode(WebView.OVER_SCROLL_ALWAYS);
            webView.setVerticalScrollBarEnabled(true);
            webView.setHorizontalScrollBarEnabled(false);

            // Enable hardware acceleration
            webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);

            // Better touch handling
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);
            settings.setSupportZoom(false);
            settings.setBuiltInZoomControls(false);
            settings.setDisplayZoomControls(false);

            // Enable DOM storage for better performance
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);

            // Cache settings
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);

            syncStoredTokenToWebView();
        }
    }
}
