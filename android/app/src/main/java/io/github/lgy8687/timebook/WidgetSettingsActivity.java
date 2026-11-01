package io.github.lgy8687.timebook;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;

public class WidgetSettingsActivity extends Activity {
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setResult(RESULT_CANCELED);
        android.content.SharedPreferences prefs = getSharedPreferences(MainActivityWidget.PREFS, MODE_PRIVATE);
        JSONArray rows;
        try { rows = new JSONObject(prefs.getString("daily", "{}")).optJSONArray("rows"); } catch (Exception e) { rows = null; }
        if (rows == null) rows = new JSONArray();
        String[] labels = new String[rows.length()];
        String[] ids = new String[rows.length()];
        boolean[] checked = new boolean[rows.length()];
        Set<String> old = prefs.getStringSet("selected", null);
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.optJSONObject(i);
            ids[i] = row.optString("id");
            labels[i] = row.optString("category") + " · " + row.optString("name");
            checked[i] = old == null || old.contains(ids[i]);
        }
        android.widget.LinearLayout controls = new android.widget.LinearLayout(this);
        controls.setOrientation(android.widget.LinearLayout.VERTICAL);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        controls.setPadding(padding, padding / 2, padding, 0);
        android.widget.TextView opacityLabel = new android.widget.TextView(this);
        android.widget.SeekBar transparency = new android.widget.SeekBar(this);
        transparency.setMax(100);
        transparency.setProgress(100 - Math.max(0, Math.min(100, prefs.getInt("background_opacity", 100))));
        opacityLabel.setText("背景透明度：" + transparency.getProgress() + "%");
        transparency.setOnSeekBarChangeListener(new android.widget.SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(android.widget.SeekBar bar, int value, boolean fromUser) {
                opacityLabel.setText("背景透明度：" + value + "%");
            }
            @Override public void onStartTrackingTouch(android.widget.SeekBar bar) { }
            @Override public void onStopTrackingTouch(android.widget.SeekBar bar) { }
        });
        controls.addView(opacityLabel);
        controls.addView(transparency);
        android.widget.TextView activitiesLabel = new android.widget.TextView(this);
        activitiesLabel.setText(ids.length == 0 ? "请先打开应用获取活动列表" : "显示的活动");
        controls.addView(activitiesLabel);
        android.widget.ScrollView scroll = new android.widget.ScrollView(this);
        android.widget.LinearLayout choices = new android.widget.LinearLayout(this);
        choices.setOrientation(android.widget.LinearLayout.VERTICAL);
        java.util.ArrayList<android.widget.CheckBox> boxes = new java.util.ArrayList<>();
        for (int i = 0; i < ids.length; i++) {
            final int index = i;
            android.widget.CheckBox box = new android.widget.CheckBox(this);
            box.setText(labels[i]);
            box.setChecked(checked[i]);
            box.setOnCheckedChangeListener((button, value) -> checked[index] = value);
            choices.addView(box);
            boxes.add(box);
        }
        scroll.addView(choices);
        int listHeight = (int) Math.min(280 * getResources().getDisplayMetrics().density,
                getResources().getDisplayMetrics().heightPixels * 0.38f);
        controls.addView(scroll, new android.widget.LinearLayout.LayoutParams(-1, listHeight));
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("桌面小组件设置")
            .setView(controls)
            .setPositiveButton("完成", (d, w) -> {
                Set<String> selected = new HashSet<>();
                for (int i = 0; i < ids.length; i++) if (checked[i]) selected.add(ids[i]);
                android.content.SharedPreferences.Editor editor = prefs.edit().putInt("background_opacity", 100 - transparency.getProgress());
                if (ids.length > 0) editor.putStringSet("selected", selected);
                editor.apply();
                MainActivityWidget.refresh(this);
                int widgetId = getIntent().getIntExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID, android.appwidget.AppWidgetManager.INVALID_APPWIDGET_ID);
                if (widgetId != android.appwidget.AppWidgetManager.INVALID_APPWIDGET_ID) {
                    setResult(RESULT_OK, new android.content.Intent().putExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
                }
                finish();
            }).setNeutralButton("全选", null).setNegativeButton("全不选", null)
            .setOnCancelListener(d -> finish()).create();
        dialog.setOnShowListener(ignored -> {
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v -> setAll(boxes, true));
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener(v -> setAll(boxes, false));
        });
        dialog.show();
    }

    private void setAll(java.util.List<android.widget.CheckBox> boxes, boolean value) {
        for (android.widget.CheckBox box : boxes) box.setChecked(value);
    }
}
