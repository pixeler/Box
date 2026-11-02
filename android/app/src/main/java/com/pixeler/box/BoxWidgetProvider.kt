package com.pixeler.box

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject

class BoxWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_UPDATE_WIDGET) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, BoxWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            for (widgetId in allWidgetIds) {
                updateAppWidget(context, appWidgetManager, widgetId)
            }
        }
    }

    companion object {
        const val ACTION_UPDATE_WIDGET = "com.pixeler.box.UPDATE_WIDGET"

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_box)

            // Read data from Capacitor Preferences (SharedPreferences named "CapacitorStorage")
            var todayTaskCount = 0
            var doneTaskCount = 0
            var focusMinutesToday = 0
            var nextTaskTitle = "برای شروع، برنامه را باز کنید"

            try {
                val prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
                val rawData = prefs.getString("widget_data", null)
                if (!rawData.isNullOrEmpty()) {
                    val json = JSONObject(rawData)
                    todayTaskCount = json.optInt("todayTaskCount", 0)
                    doneTaskCount = json.optInt("doneTaskCount", 0)
                    focusMinutesToday = json.optInt("focusMinutesToday", 0)
                    val title = json.optString("nextTaskTitle", "")
                    if (title.isNotEmpty()) {
                        nextTaskTitle = title
                    } else if (todayTaskCount == 0 && doneTaskCount > 0) {
                        nextTaskTitle = "همه کارهای امروز انجام شد ✨"
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            fun toPersianDigits(text: String): String {
                val persianDigits = arrayOf("۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹")
                var res = text
                for (i in 0..9) {
                    res = res.replace(i.toString(), persianDigits[i])
                }
                return res
            }

            // Set texts
            views.setTextViewText(R.id.widget_next_task, nextTaskTitle)
            val taskText = if (todayTaskCount > 0) {
                toPersianDigits("📋 $todayTaskCount تسک باقیمانده")
            } else {
                toPersianDigits("✓ $doneTaskCount تسک انجام شده")
            }
            views.setTextViewText(R.id.widget_tasks_count, taskText)

            val focusText = toPersianDigits("⏱️ $focusMinutesToday دقیقه")
            views.setTextViewText(R.id.widget_focus_minutes, focusText)

            // Click pending intent -> Launch MainActivity
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
