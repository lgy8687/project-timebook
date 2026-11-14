package io.github.lgy8687.timebook;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
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
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile boolean busy;

    public AppUpdater(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void checkUpdate() {
        if (busy) return;
        busy = true;
        new Thread(() -> {
            try {
                JSONObject manifest = fetchJson(MANIFEST_URL);
                int remote = manifest.getInt("versionCode");
                long local = localVersionCode();
                main.post(() -> {
                    busy = false;
                    if (remote > local) showUpdateDialog(manifest);
                    else toast("已是最新版本");
                });
            } catch (Exception error) {
                main.post(() -> {
                    busy = false;
                    toast("检查更新失败，请检查网络");
                });
            }
        }).start();
    }

    private void showUpdateDialog(JSONObject manifest) {
        String name = manifest.optString("versionName", "");
        String notes = manifest.optString("notes", "");
        new AlertDialog.Builder(activity)
            .setTitle("发现新版本 " + name)
            .setMessage(notes)
            .setPositiveButton("立即更新", (dialog, which) ->
                downloadAndInstall(manifest.optString("apkUrl", "")))
            .setNegativeButton("取消", null)
            .show();
    }

    private void downloadAndInstall(String apkUrl) {
        if (apkUrl.isEmpty() || busy) return;
        busy = true;
        ProgressDialog progress = new ProgressDialog(activity);
        progress.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL);
        progress.setMessage("正在下载更新…");
        progress.setCancelable(false);
        progress.show();
        new Thread(() -> {
            File target = new File(activity.getCacheDir(), "update/timebook-update.apk");
            try {
                target.getParentFile().mkdirs();
                HttpURLConnection connection = open(apkUrl);
                int total = connection.getContentLength();
                main.post(() -> progress.setMax(Math.max(total, 1)));
                try (InputStream input = connection.getInputStream();
                     FileOutputStream output = new FileOutputStream(target)) {
                    byte[] buffer = new byte[8192];
                    int done = 0;
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        output.write(buffer, 0, read);
                        done += read;
                        final int value = done;
                        main.post(() -> progress.setProgress(value));
                    }
                }
                main.post(() -> {
                    progress.dismiss();
                    busy = false;
                    install(target);
                });
            } catch (Exception error) {
                main.post(() -> {
                    progress.dismiss();
                    busy = false;
                    toast("下载更新失败，请重试");
                });
            }
        }).start();
    }

    private void install(File apk) {
        if (Build.VERSION.SDK_INT >= 26
                && !activity.getPackageManager().canRequestPackageInstalls()) {
            toast("请先允许本应用安装未知应用，返回后再点检查更新");
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

    private void toast(String message) {
        Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
    }
}