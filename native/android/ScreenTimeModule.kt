package com.mobileapptcc

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ScreenTimeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ScreenTime"

    private val storage by lazy {
        reactContext.getSharedPreferences(STORAGE_PREFS, Context.MODE_PRIVATE)
    }

    // --- Permissao de acesso ao uso -------------------------------------------------------

    @ReactMethod
    fun hasPermission(promise: Promise) {
        promise.resolve(hasUsagePermission(reactContext))
    }

    @ReactMethod
    fun requestPermission(promise: Promise) {
        openSettings(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS), promise)
    }

    // --- Permissao de sobrepor outros apps (necessaria para mostrar a tela de bloqueio) ---

    @ReactMethod
    fun hasOverlayPermission(promise: Promise) {
        promise.resolve(Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(reactContext))
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        openSettings(
            Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${reactContext.packageName}")),
            promise
        )
    }

    // --- Tempo de uso ---------------------------------------------------------------------

    /**
     * Tempo de uso por app e por dia do calendario (00:00 ate 23:59, ou ate agora no dia de hoje).
     * days = 1 devolve so o dia de hoje; days = 2 devolve ontem e hoje; e assim por diante.
     */
    @ReactMethod
    fun getUsageStats(days: Int, promise: Promise) {
        try {
            val result = Arguments.createArray()
            for (uso in UsageCalculator.calcularPorDia(reactContext, days.coerceIn(1, 7))) {
                val map = Arguments.createMap()
                map.putString("package_name", uso.packageName)
                map.putString("nome", uso.nome)
                map.putDouble("tempo_minutos", uso.minutos)
                map.putString("data_uso", uso.data)
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("USAGE_STATS_ERROR", e.message, e)
        }
    }

    // --- Monitor em segundo plano (mensagens e bloqueio de apps) ---------------------------

    @ReactMethod
    fun startMonitor(token: String, apiUrl: String, promise: Promise) {
        try {
            MonitorService.salvarSessao(reactContext, token, apiUrl)
            ContextCompat.startForegroundService(reactContext, Intent(reactContext, MonitorService::class.java))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("MONITOR_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopMonitor(promise: Promise) {
        MonitorService.limparSessao(reactContext)
        reactContext.stopService(Intent(reactContext, MonitorService::class.java))
        promise.resolve(true)
    }

    // --- Armazenamento simples (SharedPreferences) para o JS -------------------------------

    @ReactMethod
    fun getItem(key: String, promise: Promise) {
        promise.resolve(storage.getString(key, null))
    }

    @ReactMethod
    fun setItem(key: String, value: String, promise: Promise) {
        storage.edit().putString(key, value).apply()
        promise.resolve(true)
    }

    @ReactMethod
    fun removeItem(key: String, promise: Promise) {
        storage.edit().remove(key).apply()
        promise.resolve(true)
    }

    private fun openSettings(intent: Intent, promise: Promise) {
        try {
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    companion object {
        private const val STORAGE_PREFS = "tcc_storage"

        fun hasUsagePermission(context: Context): Boolean = try {
            val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            @Suppress("DEPRECATION")
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName
            )
            mode == AppOpsManager.MODE_ALLOWED
        } catch (e: Exception) {
            false
        }
    }
}
