package io.github.lgy8687.timebook;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceResponse;
import androidx.webkit.WebViewAssetLoader;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://appassets.androidplatform.net/assets/index.html";
    private static final int REQUEST_BACKUP = 101;
    private static final int REQUEST_IMPORT = 102;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingBackup;
    private final Handler widgetHandler = new Handler(Looper.getMainLooper());
    private final Runnable widgetSync = new Runnable() {
        @Override public void run() {
            if (webView != null) {
                webView.evaluateJavascript("buildWidgetSnapshot()", value -> {
                    try {
                        if (value == null || "null".equals(value)) return;
                        JSONObject state = new JSONObject(value);
                        MainActivityWidget.saveState(MainActivity.this, state);
                    } catch (Exception ignored) { }
                });
                widgetHandler.postDelayed(this, 5000);
            }
        }
    };

    @Override protected void onResume() {
        super.onResume();
        widgetHandler.post(widgetSync);
    }

    @Override protected void onPause() {
        widgetHandler.removeCallbacks(widgetSync);
        super.onPause();
    }

    private class BackupBridge {
        @JavascriptInterface
        public void openWidgetSettings() {
            runOnUiThread(() -> startActivity(new Intent(MainActivity.this, WidgetSettingsActivity.class)));
        }
        @JavascriptInterface
        public void saveBackup(String name, String json) {
            runOnUiThread(() -> {
                pendingBackup = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE,
                    name != null && name.matches("[A-Za-z0-9._-]+\\.json") ? name : "timebook-backup.json");
                startActivityForResult(intent, REQUEST_BACKUP);
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(248, 250, 252));
        getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setBlockNetworkLoads(true);
        webView.addJavascriptInterface(new BackupBridge(), "TimeBookAndroid");
        webView.addJavascriptInterface(new AppUpdater(this, webView), "TimeBookUpdate");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQUEST_IMPORT);
                    return true;
                } catch (Exception error) {
                    filePathCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
            }
        });
        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse local = assetLoader.shouldInterceptRequest(request.getUrl());
                if (local != null) {
                    // The isolated demo has an opaque origin; CSS masks still need local icons.
                    java.util.Map<String, String> headers = new java.util.HashMap<>();
                    if (local.getResponseHeaders() != null) headers.putAll(local.getResponseHeaders());
                    headers.put("Access-Control-Allow-Origin", "*");
                    local.setResponseHeaders(headers);
                    return local;
                }
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Offline only",
                    java.util.Collections.emptyMap(), new java.io.ByteArrayInputStream(new byte[0]));
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme())
                        && "appassets.androidplatform.net".equals(uri.getHost())
                        && uri.getPath() != null && uri.getPath().startsWith("/assets/")) {
                    return false;
                }
                if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (android.content.ActivityNotFoundException ignored) { }
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return;
                new AlertDialog.Builder(MainActivity.this)
                    .setMessage(R.string.load_failed)
                    .setPositiveButton(R.string.retry, (dialog, which) -> view.loadUrl(APP_URL))
                    .show();
            }
        });
        setContentView(webView);
        if (savedInstanceState == null) webView.loadUrl(APP_URL);
        else webView.restoreState(savedInstanceState);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_IMPORT) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                filePathCallback = null;
            }
            return;
        }
        if (requestCode != REQUEST_BACKUP) return;
        if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingBackup != null) {
            try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                if (output == null) throw new IllegalStateException("No output stream");
                output.write(pendingBackup.getBytes(StandardCharsets.UTF_8));
                Toast.makeText(this, "备份已保存", Toast.LENGTH_SHORT).show();
            } catch (Exception error) {
                Toast.makeText(this, "保存失败，请重试", Toast.LENGTH_LONG).show();
            }
        }
        pendingBackup = null;
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else moveTaskToBack(true);
    }
}
