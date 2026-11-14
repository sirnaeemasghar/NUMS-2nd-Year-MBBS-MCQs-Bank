package com.nums.nexus.mcqs;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;
    private FrameLayout container;
    private ValueCallback<Uri[]> filePathCallback;
    private final static int FILECHOOSER_RESULTCODE = 101;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.setStatusBarColor(Color.parseColor("#ffffff"));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }

        container = new FrameLayout(this);
        container.setFitsSystemWindows(true);
        container.setBackgroundColor(Color.parseColor("#ffffff"));

        webView = new WebView(this);
        container.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(container);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setAllowFileAccessFromFileURLs(true);
        ws.setAllowUniversalAccessFromFileURLs(true);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setSupportZoom(true);
        ws.setBuiltInZoomControls(true);
        ws.setDisplayZoomControls(false);

        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                              WebChromeClient.FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                startActivityForResult(Intent.createChooser(intent, "Select Backup JSON File"), FILECHOOSER_RESULTCODE);
                return true;
            }
        });

        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (filePathCallback != null) {
                Uri[] results = null;
                if (resultCode == Activity.RESULT_OK && data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            webView.evaluateJavascript(
                "(function() { " +
                "  var h = window.location.hash || '#'; " +
                "  if (h.indexOf('topic') !== -1) { " +
                "    var b = h.split('/')[0]; " +
                "    window.location.hash = b; " +
                "    return true; " +
                "  } else if (h === '#block4' || h === '#block5' || h === '#block6') { " +
                "    window.location.hash = '#home'; " +
                "    return true; " +
                "  } " +
                "  return false; " +
                "})()",
                value -> {
                    if ("false".equals(value)) {
                        finish();
                    }
                }
            );
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    public static class AndroidBridge {
        private final MainActivity activity;

        public AndroidBridge(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void setStatusBarTheme(boolean isDark) {
            activity.runOnUiThread(() -> {
                Window win = activity.getWindow();
                int bg = isDark ? Color.parseColor("#111827") : Color.parseColor("#ffffff");
                win.setStatusBarColor(bg);
                if (activity.container != null) {
                    activity.container.setBackgroundColor(bg);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    View decor = win.getDecorView();
                    if (isDark) {
                        decor.setSystemUiVisibility(0);
                    } else {
                        decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
                    }
                }
            });
        }

        @JavascriptInterface
        public void shareBackup(String jsonContent, String filename) {
            activity.runOnUiThread(() -> {
                try {
                    Intent sendIntent = new Intent(Intent.ACTION_SEND);
                    sendIntent.putExtra(Intent.EXTRA_TEXT, jsonContent);
                    sendIntent.putExtra(Intent.EXTRA_TITLE, filename);
                    sendIntent.setType("text/plain");
                    activity.startActivity(Intent.createChooser(sendIntent, "Share or Save Progress Backup"));
                } catch (Exception e) {
                    Toast.makeText(activity, "Export error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
