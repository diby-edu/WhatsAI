package com.wazzapai.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Configure status bar for dark app (light icons/text)
        Window window = getWindow();

        // Make status bar transparent
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
        }

        // Set light status bar icons (white icons on dark background)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            View decorView = window.getDecorView();
            // Clear the light status bar flag to get white/light icons
            decorView.setSystemUiVisibility(
                    decorView.getSystemUiVisibility() & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }

        // For API 30+ use WindowInsetsController
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window,
                    window.getDecorView());
            if (insetsController != null) {
                insetsController.setAppearanceLightStatusBars(false); // false = white icons
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
}
