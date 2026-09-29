package com.mobileapptcc

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class ScreenTimeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ScreenTime"

    private fun isPermissionGranted(): Boolean {
        val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            reactApplicationContext.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    @ReactMethod
    fun hasPermission(promise: Promise) {
        promise.resolve(isPermissionGranted())
    }

    @ReactMethod
    fun requestPermission(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getUsageStats(days: Int, promise: Promise) {
        if (!isPermissionGranted()) {
            promise.reject("PERMISSION_DENIED", "Permissao de uso de apps nao concedida")
            return
        }

        try {
            val manager = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val result = WritableNativeArray()

            for (i in 0 until days) {
                val cal = Calendar.getInstance()
                cal.add(Calendar.DAY_OF_YEAR, -i)

                cal.set(Calendar.HOUR_OF_DAY, 23)
                cal.set(Calendar.MINUTE, 59)
                cal.set(Calendar.SECOND, 59)
                val endTime = cal.timeInMillis

                cal.set(Calendar.HOUR_OF_DAY, 0)
                cal.set(Calendar.MINUTE, 0)
                cal.set(Calendar.SECOND, 0)
                cal.set(Calendar.MILLISECOND, 0)
                val startTime = cal.timeInMillis

                val dateStr = sdf.format(cal.time)

                val stats = manager.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY,
                    startTime,
                    endTime
                )

                for (stat in stats) {
                    // Apenas apps usados por mais de 1 minuto
                    if (stat.totalTimeInForeground >= 60_000L) {
                        val nomeApp = try {
                            val pm = reactApplicationContext.packageManager
                            val info = pm.getApplicationInfo(stat.packageName, PackageManager.GET_META_DATA)
                            pm.getApplicationLabel(info).toString()
                        } catch (e: PackageManager.NameNotFoundException) {
                            stat.packageName
                        }
                        val app = WritableNativeMap()
                        app.putString("package_name", stat.packageName)
                        app.putString("nome", nomeApp)
                        app.putInt("tempo_minutos", (stat.totalTimeInForeground / 60_000L).toInt())
                        app.putString("data_uso", dateStr)
                        result.pushMap(app)
                    }
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
