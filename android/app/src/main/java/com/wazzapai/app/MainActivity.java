package com.wazzapai.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Dark background to match the app theme
    private static final int STATUS_BAR_COLOR = Color.parseColor("#0f172a");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Set window background color to match status bar (prevents white line)
        getWindow().getDecorView().setBackgroundColor(STATUS_BAR_COLOR);

        // Disable edge-to-edge immediately
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        // Apply status bar config immediately
        configureStatusBar();

        // Create notification channel for push notifications
        createNotificationChannel();

        // Re-apply after a delay to override any Capacitor/WebView changes
        new Handler(Looper.getMainLooper()).postDelayed(this::configureStatusBar, 100);
        new Handler(Looper.getMainLooper()).postDelayed(this::configureStatusBar, 500);
        new Handler(Looper.getMainLooper()).postDelayed(this::configureStatusBar, 1000);
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

        // Clear any translucent flags
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);

        // Add flag to draw system bar backgrounds
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        // Set the status bar color to dark (matching app background)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.setStatusBarColor(STATUS_BAR_COLOR);
        }

        // Set WHITE icons on dark background (API 23+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            View decorView = window.getDecorView();
            int flags = decorView.getSystemUiVisibility();
            // REMOVE light status bar flag = WHITE icons on dark bg
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            // Remove any fullscreen/immersive flags that might hide the bar
            flags &= ~View.SYSTEM_UI_FLAG_FULLSCREEN;
            flags &= ~View.SYSTEM_UI_FLAG_HIDE_NAVIGATION;
            flags &= ~View.SYSTEM_UI_FLAG_IMMERSIVE;
            flags &= ~View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            decorView.setSystemUiVisibility(flags);
        }

        // For API 30+ use modern API
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            if (controller != null) {
                controller.setAppearanceLightStatusBars(false); // false = WHITE icons
            }
        }
    }

    @Override
    public void onStart() {
        super.onStart();

        // Get the WebView and configure scroll settings
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();

            // CRITICAL: Add TOP MARGIN to push WebView below status bar
            int statusBarHeight = getStatusBarHeight();
            ViewGroup.LayoutParams params = webView.getLayoutParams();
            if (params instanceof FrameLayout.LayoutParams) {
                FrameLayout.LayoutParams frameParams = (FrameLayout.LayoutParams) params;
                frameParams.topMargin = statusBarHeight;
                webView.setLayoutParams(frameParams);
            } else if (params instanceof ViewGroup.MarginLayoutParams) {
                ViewGroup.MarginLayoutParams marginParams = (ViewGroup.MarginLayoutParams) params;
                marginParams.topMargin = statusBarHeight;
                webView.setLayoutParams(marginParams);
            }

            // Set WebView background to match status bar (fills the margin gap)
            webView.setBackgroundColor(STATUS_BAR_COLOR);

            // Also set parent container background
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) {
                parent.setBackgroundColor(STATUS_BAR_COLOR);
            }

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
        }
    }

    private int getStatusBarHeight() {
        int result = 0;
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            result = getResources().getDimensionPixelSize(resourceId);
        }
        return result;
    }
}
