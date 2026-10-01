package com.mobileapptcc

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.accessibility.AccessibilityEvent
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL
import java.util.concurrent.Executors

class BlockerAccessibilityService : AccessibilityService() {
  private data class BlockRule(val packageName: String, val appName: String, val blockedUntil: Long)

  private val mainHandler = Handler(Looper.getMainLooper())
  private val networkExecutor = Executors.newSingleThreadExecutor()
  private val rules = mutableMapOf<String, BlockRule>()
  private var currentPackage = ""
  private var blockerOverlay: FrameLayout? = null
  private var lastRefreshAt = 0L
  private var refreshInProgress = false
  private lateinit var windowManager: WindowManager

  private val refreshRunnable = object : Runnable {
    override fun run() {
      refreshRules()
      mainHandler.postDelayed(this, REFRESH_INTERVAL_MS)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    loadCachedRules()
    mainHandler.post(refreshRunnable)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val packageName = event?.packageName?.toString() ?: return
    if (packageName == this.packageName) {
      return
    }
    currentPackage = packageName
    val rule = rules[packageName]
    if (rule != null && rule.blockedUntil > System.currentTimeMillis()) {
      showBlocker(rule)
    } else {
      hideBlocker()
    }
    if (System.currentTimeMillis() - lastRefreshAt >= REFRESH_INTERVAL_MS) refreshRules()
  }

  override fun onInterrupt() {
    hideBlocker()
  }

  override fun onDestroy() {
    mainHandler.removeCallbacks(refreshRunnable)
    hideBlocker()
    networkExecutor.shutdownNow()
    super.onDestroy()
  }

  private fun refreshRules() {
    if (refreshInProgress) return
    val prefs = getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    val token = prefs.getString(KEY_CONNECTION_TOKEN, null) ?: return
    val apiBaseUrl = prefs.getString(KEY_API_BASE_URL, null) ?: return
    refreshInProgress = true
    networkExecutor.execute {
      try {
        val encodedToken = URLEncoder.encode(token, "UTF-8")
        val connection = URL("$apiBaseUrl/dashboard/bloqueios/ativos?token=$encodedToken")
          .openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        connection.connectTimeout = 5000
        connection.readTimeout = 5000
        val response = connection.inputStream.bufferedReader().use { it.readText() }
        connection.disconnect()
        val entries = JSONObject(response).optJSONArray("bloqueios") ?: JSONArray()
        val updatedRules = mutableMapOf<String, BlockRule>()
        for (index in 0 until entries.length()) {
          val entry = entries.getJSONObject(index)
          val blockedUntil = try {
            java.time.Instant.parse(entry.getString("bloqueado_ate")).toEpochMilli()
          } catch (_: Exception) {
            continue
          }
          val packageName = entry.optString("package_name")
          if (packageName.isNotBlank() && blockedUntil > System.currentTimeMillis()) {
            updatedRules[packageName] = BlockRule(
              packageName,
              entry.optString("app_nome", packageName),
              blockedUntil,
            )
          }
        }
        synchronized(rules) {
          rules.clear()
          rules.putAll(updatedRules)
        }
        prefs.edit().putString(KEY_CACHED_RULES, entries.toString()).apply()
        lastRefreshAt = System.currentTimeMillis()
        mainHandler.post {
          val currentRule = rules[currentPackage]
          if (currentRule != null) showBlocker(currentRule) else hideBlocker()
        }
      } catch (_: Exception) {
        // Keep the last cached rules if the API is temporarily unavailable.
      } finally {
        refreshInProgress = false
      }
    }
  }

  private fun loadCachedRules() {
    val rawRules = getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .getString(KEY_CACHED_RULES, null) ?: return
    try {
      val entries = JSONArray(rawRules)
      for (index in 0 until entries.length()) {
        val entry = entries.getJSONObject(index)
        val blockedUntil = java.time.Instant.parse(entry.getString("bloqueado_ate")).toEpochMilli()
        val packageName = entry.optString("package_name")
        if (packageName.isNotBlank() && blockedUntil > System.currentTimeMillis()) {
          rules[packageName] = BlockRule(packageName, entry.optString("app_nome", packageName), blockedUntil)
        }
      }
    } catch (_: Exception) {
      rules.clear()
    }
  }

  private fun showBlocker(rule: BlockRule) {
    if (blockerOverlay != null) return
    val root = FrameLayout(this).apply {
      setBackgroundColor(Color.rgb(8, 18, 35))
      isClickable = true
      isFocusable = true
    }
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(48, 48, 48, 48)
    }
    val title = TextView(this).apply {
      text = "App bloqueado"
      textSize = 26f
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
    }
    val message = TextView(this).apply {
      text = "${rule.appName} foi pausado pelo responsavel ate ${java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault()).format(java.util.Date(rule.blockedUntil))}."
      textSize = 16f
      setTextColor(Color.LTGRAY)
      gravity = Gravity.CENTER
      setPadding(0, 20, 0, 28)
    }
    val homeButton = Button(this).apply {
      text = "Voltar ao inicio"
      setOnClickListener {
        hideBlocker()
        startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }
    content.addView(title)
    content.addView(message)
    content.addView(homeButton)
    root.addView(content, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))

    val overlayType = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP_MR1) {
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
    } else {
      @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
    }
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      overlayType,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT,
    ).apply { gravity = Gravity.TOP or Gravity.START }

    try {
      windowManager.addView(root, params)
      blockerOverlay = root
    } catch (_: Exception) {
      blockerOverlay = null
    }
  }

  private fun hideBlocker() {
    blockerOverlay?.let { overlay ->
      try {
        windowManager.removeView(overlay)
      } catch (_: Exception) {
        // Overlay may already have been removed by the system.
      }
    }
    blockerOverlay = null
  }

  companion object {
    const val PREFERENCES_NAME = "app_blocker"
    const val KEY_CONNECTION_TOKEN = "connection_token"
    const val KEY_API_BASE_URL = "api_base_url"
    const val KEY_CACHED_RULES = "cached_rules"
    private const val REFRESH_INTERVAL_MS = 15000L
  }
}
