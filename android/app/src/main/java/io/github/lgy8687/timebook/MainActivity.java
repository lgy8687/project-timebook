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
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://lgy8687.github.io/project-timebook/";
    private static final int REQUEST_BACKUP = 101;
    private static final int REQUEST_IMPORT = 102;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingBackup;
    private final Handler widgetHandler = new Handler(Looper.getMainLooper());
    private final Runnable widgetSync = new Runnable() {
        @Override public void run() {
            if (webView != null) {
                webView.evaluateJavascript("(function(){try{const now=nowSecondMs(),day=formatBeijingDate(now),rows=new Map();" +
                    "function add(l1,l2,ms,live,color){if(!l1&&!l2)return;const id=JSON.stringify([l1||'',l2||'']);let row=rows.get(id)||{id,name:l2||l1,category:l1||'',ms:0,live:false};row.ms+=ms||0;row.live=row.live||!!live;if(live)row.color=color||getCat(l1)?.color||'#526A91';rows.set(id,row)}" +
                    "cats.forEach(c=>(c.subs||[]).forEach(s=>add(c.name,s,0,false)));shortcuts.forEach(s=>add(s.l1,s.l2,0,false));" +
                    "getTodaySegments().filter(x=>!x.parallel&&!x.sceneActivity).forEach(x=>add(x.l1,x.l2,x.clippedEnd-x.clippedStart,x.live,x.live?logSegmentColor(x):null));" +
                    "unlocatedLogs.filter(x=>x.date===day).forEach(x=>add(x.l1,x.l2,x.durationMs,false));" +
                    "if(current)add(current.l1,current.l2,0,true,logSegmentColor(current));return JSON.stringify({day,at:now,rows:Array.from(rows.values())});}catch(e){return null}})()", value -> {
                    try {
                        Object decoded = new org.json.JSONTokener(value).nextValue();
                        if (!(decoded instanceof String)) return;
                        JSONObject state = new JSONObject((String) decoded);
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
        webView.addJavascriptInterface(new BackupBridge(), "TimeBookAndroid");
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
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme())
                        && "lgy8687.github.io".equals(uri.getHost())
                        && uri.getPath() != null && uri.getPath().startsWith("/project-timebook/")) {
                    return false;
                }
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
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
