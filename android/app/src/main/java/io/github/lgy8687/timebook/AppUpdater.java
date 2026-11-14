package io.github.lgy8687.timebook;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class AppUpdater {
    private static final String MANIFEST_URL =
        "https://github.com/lgy8687/project-timebook/releases/latest/download/update.json";
    private final Activity activity;
    private final WebView webView;
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile boolean busy;
    private JSONObject pendingManifest;

    public AppUpdater(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public void checkUpdate() {
        if (busy) return;
        busy = true;
        emit(state("checking"));
        new Thread(() -> {
            try {
                JSONObject manifest = fetchJson(MANIFEST_URL);
                int remote = manifest.getInt("versionCode");
                long local = localVersionCode();
                main.post(() -> {
                    busy = false;
                    if (remote > local) {
                        pendingManifest = manifest;
                        JSONObject ev = state("available");
                        try {
                            ev.put("versionName", manifest.optString("versionName", ""));
                            ev.put("notes", manifest.optString("notes", ""));
                        } catch (Exception ignored) { }
                        emit(ev);
                    } else {
                        emit(state("latest"));
                    }
                });
            } catch (Exception error) {
                main.post(() -> {
                    busy = false;
                    emit(error("检查更新失败，请检查网络"));
                });
            }
        }).start();
    }

    @JavascriptInterface
    public void startUpdate() {
        if (busy || pendingManifest == null) return;
        String apkUrl = pendingManifest.optString("apkUrl", "");
        if (apkUrl.isEmpty()) return;
        busy = true;
        emit(progress(0));
        new Thread(() -> {
            File target = new File(activity.getCacheDir(), "update/timebook-update.apk");
            try {
                target.getParentFile().mkdirs();
                HttpURLConnection connection = open(apkUrl);
                int total = connection.getContentLength();
                try (InputStream input = connection.getInputStream();
                     FileOutputStream output = new FileOutputStream(target)) {
                    byte[] buffer = new byte[8192];
                    long done = 0;
                    int lastPercent = 0;
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        output.write(buffer, 0, read);
                        done += read;
                        int percent = total > 0 ? (int) (done * 100 / total) : -1;
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            emit(progress(percent));
                        }
                    }
                }
                main.post(() -> {
                    busy = false;
                    emit(state("installing"));
                    install(target);
                });
            } catch (Exception error) {
                main.post(() -> {
                    busy = false;
                    emit(error("下载更新失败，请重试"));
                });
            }
        }).start();
    }

    private void install(File apk) {
        if (Build.VERSION.SDK_INT >= 26
                && !activity.getPackageManager().canRequestPackageInstalls()) {
            emit(state("needPermission"));
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + activity.getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(settings);
            return;
        }
        Uri uri = FileProvider.getUriForFile(activity,
            activity.getPackageName() + ".updateprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
    }

    private long localVersionCode() throws Exception {
        PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }

    private HttpURLConnection open(String url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setInstanceFollowRedirects(true);
        return connection;
    }

    private JSONObject fetchJson(String url) throws Exception {
        HttpURLConnection connection = open(url);
        try (InputStream input = connection.getInputStream()) {
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[4096];
            int read;
            while ((read = input.read(chunk)) != -1) buffer.write(chunk, 0, read);
            return new JSONObject(new String(buffer.toByteArray(), StandardCharsets.UTF_8));
        } finally {
            connection.disconnect();
        }
    }

    private JSONObject state(String type) {
        JSONObject ev = new JSONObject();
        try { ev.put("type", type); } catch (Exception ignored) { }
        return ev;
    }

    private JSONObject progress(int percent) {
        JSONObject ev = state("downloading");
        try { ev.put("percent", percent); } catch (Exception ignored) { }
        return ev;
    }

    private JSONObject error(String message) {
        JSONObject ev = state("error");
        try { ev.put("message", message); } catch (Exception ignored) { }
        return ev;
    }

    private void emit(JSONObject ev) {
        main.post(() -> webView.evaluateJavascript(
            "window.__tbUpdateEvent && window.__tbUpdateEvent(" + ev.toString() + ")", null));
    }
}