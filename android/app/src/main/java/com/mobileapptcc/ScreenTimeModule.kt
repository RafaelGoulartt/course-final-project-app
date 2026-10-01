package com.mobileapptcc

import android.Manifest
import android.app.AppOpsManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import java.util.Calendar

class ScreenTimeModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  companion object {
    private const val NOTIFICATION_CHANNEL_ID = "web_messages"
  }

  override fun getName(): String = "ScreenTime"

  @ReactMethod
  fun hasPermission(promise: Promise) {
    try {
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName,
      )
      promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    } catch (error: Exception) {
      promise.reject("PERMISSION_CHECK_FAILED", error)
    }
  }

  @ReactMethod
  fun requestPermission(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        putExtra(Intent.EXTRA_PACKAGE_NAME, context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("PERMISSION_REQUEST_FAILED", error)
    }
  }

  @ReactMethod
  fun configureBlocker(token: String, apiBaseUrl: String, promise: Promise) {
    try {
      context.getSharedPreferences(BlockerAccessibilityService.PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(BlockerAccessibilityService.KEY_CONNECTION_TOKEN, token.trim())
        .putString(BlockerAccessibilityService.KEY_API_BASE_URL, apiBaseUrl.trimEnd('/'))
        .apply()
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("BLOCKER_CONFIG_FAILED", error)
    }
  }

  @ReactMethod
  fun isBlockerEnabled(promise: Promise) {
    try {
      val component = ComponentName(context, BlockerAccessibilityService::class.java).flattenToString()
      val enabledServices = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      ).orEmpty()
      promise.resolve(enabledServices.split(':').any { it.equals(component, ignoreCase = true) })
    } catch (error: Exception) {
      promise.reject("BLOCKER_STATUS_FAILED", error)
    }
  }

  @ReactMethod
  fun openBlockerSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("BLOCKER_SETTINGS_FAILED", error)
    }
  }

  @ReactMethod
  fun showNotification(id: Int, title: String, message: String, promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
      ) {
        promise.resolve(false)
        return
      }

      val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(
          NOTIFICATION_CHANNEL_ID,
          "Mensagens do painel web",
          NotificationManager.IMPORTANCE_HIGH,
        )
        notificationManager.createNotificationChannel(channel)
      }

      val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(context, NOTIFICATION_CHANNEL_ID)
      } else {
        Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH)
      }
      val notification = builder
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentTitle(title)
        .setContentText(message)
        .setStyle(Notification.BigTextStyle().bigText(message))
        .setAutoCancel(true)
        .build()

      notificationManager.notify(id, notification)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("NOTIFICATION_FAILED", error)
    }
  }

  @ReactMethod
  fun getUsageStats(days: Int, promise: Promise) {
    try {
      val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val end = System.currentTimeMillis()
      val startCalendar = Calendar.getInstance().apply {
        add(Calendar.DAY_OF_YEAR, -days.coerceAtLeast(1))
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      val stats = usageStatsManager.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        startCalendar.timeInMillis,
        end,
      )
      val packageManager = context.packageManager
      val result: WritableArray = Arguments.createArray()

      stats
        .filter { it.totalTimeInForeground > 0 && it.packageName != context.packageName }
        .groupBy { it.packageName }
        .forEach { (packageName, entries) ->
          val totalMinutes = entries.sumOf { it.totalTimeInForeground } / 60000L
          if (totalMinutes > 0) {
            val appInfo = try { packageManager.getApplicationInfo(packageName, 0) } catch (_: Exception) { null }
            val appName = appInfo?.let { packageManager.getApplicationLabel(it).toString() } ?: packageName
            val item = Arguments.createMap()
            item.putString("package_name", packageName)
            item.putString("nome", appName)
            item.putInt("tempo_minutos", totalMinutes.toInt())
            item.putString("data_uso", java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date()))
            result.pushMap(item)
          }
        }

      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("USAGE_STATS_FAILED", error)
    }
  }
}
