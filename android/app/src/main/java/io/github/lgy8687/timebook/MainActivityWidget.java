package io.github.lgy8687.timebook;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Set;

public class MainActivityWidget extends AppWidgetProvider {
    static final String PREFS = "main_widget";
    static void saveState(Context context, JSONObject state) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("daily", state.toString()).apply();
        refresh(context);
    }
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        update(context, manager, manager.getAppWidgetIds(new ComponentName(context, MainActivityWidget.class)));
    }
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { update(context, manager, ids); }
    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, android.os.Bundle options) {
        update(context, manager, new int[] { id });
    }
    private static void update(Context context, AppWidgetManager manager, int[] ids) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Set<String> selected = prefs.getStringSet("selected", null);
        int backgroundAlpha = Math.round(Math.max(0, Math.min(100, prefs.getInt("background_opacity", 100))) * 255 / 100f);
        JSONObject data;
        try { data = new JSONObject(prefs.getString("daily", "{}")); } catch (Exception e) { data = new JSONObject(); }
        JSONArray rows = data.optJSONArray("rows");
        long at = data.optLong("at", 0);
        java.text.SimpleDateFormat format = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.ROOT);
        format.setTimeZone(java.util.TimeZone.getTimeZone("Asia/Shanghai"));
        String today = format.format(new java.util.Date());
        boolean stale = !today.equals(data.optString("day"));
        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.main_widget);
            views.removeAllViews(R.id.widget_rows);
            java.util.ArrayList<JSONObject> visibleRows = new java.util.ArrayList<>();
            if (rows != null && !stale) for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.optJSONObject(i);
                if (row == null || (selected != null && !selected.contains(row.optString("id")))) continue;
                long totalMs = row.has("totalMs") ? Math.max(0, row.optLong("totalMs")) : Math.max(0, row.optLong("ms"));
                boolean live = row.optBoolean("live");
                if (selected == null && totalMs == 0 && !live) continue;
                visibleRows.add(row);
            }
            for (int i = 0; i < visibleRows.size(); i++) {
                JSONObject row = visibleRows.get(i);
                long totalMs = row.has("totalMs") ? Math.max(0, row.optLong("totalMs")) : Math.max(0, row.optLong("ms"));
                long segmentMs = row.has("segmentMs") ? Math.max(0, row.optLong("segmentMs")) : totalMs;
                boolean live = row.optBoolean("live");
                RemoteViews item = new RemoteViews(context.getPackageName(), R.layout.main_widget_row);
                item.setInt(R.id.row_background, "setImageAlpha", backgroundAlpha);
                item.setTextViewText(R.id.row_name, row.optString("name"));
                item.setViewVisibility(R.id.row_timer, live ? View.VISIBLE : View.GONE);
                item.setViewVisibility(R.id.row_duration, live ? View.GONE : View.VISIBLE);
                if (live) {
                    int color;
                    try { color = android.graphics.Color.parseColor(row.optString("color", "#526A91")); }
                    catch (IllegalArgumentException error) { color = android.graphics.Color.rgb(82, 106, 145); }
                    item.setTextColor(R.id.row_timer, color);
                    item.setChronometer(R.id.row_timer, SystemClock.elapsedRealtime() - Math.max(0, System.currentTimeMillis() - at) - segmentMs, null, true);
                }
                else item.setTextViewText(R.id.row_duration, String.format(java.util.Locale.ROOT, "%d:%02d:%02d", totalMs / 3600000, totalMs / 60000 % 60, totalMs / 1000 % 60));
                views.addView(R.id.widget_rows, item);
            }
            views.setTextViewText(R.id.widget_empty, stale ? "点击打开应用更新" : "暂无显示的活动，点击打开应用");
            views.setInt(R.id.widget_empty_background, "setImageAlpha", backgroundAlpha);
            views.setViewVisibility(R.id.widget_empty_container, visibleRows.isEmpty() ? View.VISIBLE : View.GONE);
            views.setViewVisibility(R.id.widget_rows, visibleRows.isEmpty() ? View.GONE : View.VISIBLE);
            Intent action = new Intent(context, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, action, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            manager.updateAppWidget(id, views);
        }
    }
}
