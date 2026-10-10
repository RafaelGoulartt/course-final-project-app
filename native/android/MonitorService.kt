package com.mobileapptcc

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

data class Suspensao(val nome: String, val fim: Long?) {
    fun ativa(agora: Long) = fim == null || fim > agora
}

/**
 * Servico em primeiro plano que:
 *  - consulta a API a cada minuto (mensagens novas e apps suspensos);
 *  - mostra uma notificacao para cada mensagem nova dos pais;
 *  - verifica a cada segundo qual app esta aberto e, se estiver suspenso, abre a BlockActivity.
 */
class MonitorService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private var rede: ScheduledExecutorService? = null

    @Volatile
    private var suspensoes: Map<String, Suspensao> = emptyMap()
    private var ultimaVerificacao = 0L
    private var appAtual: String? = null
    private var ultimoBloqueio = 0L
    private var ignorar: Set<String> = emptySet()

    private val verificarApp = object : Runnable {
        override fun run() {
            try {
                verificarAppAberto()
            } catch (e: Exception) {
                Log.w(TAG, "Falha ao verificar app aberto", e)
            }
            handler.postDelayed(this, INTERVALO_BLOQUEIO_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        criarCanais(this)
        iniciarEmPrimeiroPlano()
        ignorar = UsageCalculator.pacotesIgnorados(this) + packageName
        suspensoes = lerSuspensoesSalvas()
        ultimaVerificacao = System.currentTimeMillis() - 5 * 60 * 1000L
        handler.post(verificarApp)
        rede = Executors.newSingleThreadScheduledExecutor().also {
            it.scheduleWithFixedDelay({ consultarApi() }, 0, INTERVALO_API_S, TimeUnit.SECONDS)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (lerSessao(this) == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        // Quando o app chama startMonitor de novo (ex.: depois do login), consulta a API na hora.
        rede?.execute { consultarApi() }
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(verificarApp)
        rede?.shutdownNow()
        super.onDestroy()
    }

    private fun iniciarEmPrimeiroPlano() {
        val abrirApp = packageManager.getLaunchIntentForPackage(packageName)
        val notificacao = NotificationCompat.Builder(this, CANAL_MONITOR)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle("Controle de tempo de tela ativo")
            .setContentText("Recebendo mensagens e limites dos seus responsáveis.")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(abrirApp?.let {
                PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE)
            })
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(ID_NOTIFICACAO_MONITOR, notificacao, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(ID_NOTIFICACAO_MONITOR, notificacao)
        }
    }

    // --- Bloqueio -------------------------------------------------------------------------

    private fun verificarAppAberto() {
        val agora = System.currentTimeMillis()
        val ativas = suspensoes.filterValues { it.ativa(agora) }
        if (ativas.isEmpty() || !ScreenTimeModule.hasUsagePermission(this)) {
            ultimaVerificacao = agora
            return
        }

        UsageCalculator.appEmPrimeiroPlano(this, ultimaVerificacao - 1000)?.let { appAtual = it }
        ultimaVerificacao = agora

        val pacote = appAtual ?: return
        if (pacote in ignorar) return
        val suspensao = ativas[pacote] ?: return

        // Evita abrir a tela varias vezes enquanto o sistema ainda nao registrou a troca de app.
        if (agora - ultimoBloqueio < 1500) return
        ultimoBloqueio = agora

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.w(TAG, "Sem permissao de sobreposicao: nao da para abrir a tela de bloqueio")
            return
        }
        startActivity(BlockActivity.intent(this, suspensao.nome, suspensao.fim))
    }

    // --- API ------------------------------------------------------------------------------

    private fun consultarApi() {
        val sessao = lerSessao(this) ?: return
        try {
            val url = URL(
                "${sessao.apiUrl.trimEnd('/')}/dashboard/dispositivo/estado?token=" +
                    URLEncoder.encode(sessao.token, "UTF-8")
            )
            val conexao = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 10_000
                readTimeout = 10_000
            }
            val status = conexao.responseCode
            if (status != 200) {
                Log.w(TAG, "API respondeu $status")
                conexao.disconnect()
                return
            }
            val corpo = conexao.inputStream.bufferedReader().use { it.readText() }
            conexao.disconnect()

            val json = JSONObject(corpo)
            atualizarSuspensoes(json)
            notificarMensagens(json)
        } catch (e: Exception) {
            Log.w(TAG, "Falha ao consultar API", e)
        }
    }

    private fun atualizarSuspensoes(json: JSONObject) {
        val lista = json.optJSONArray("suspensoes") ?: return
        val novas = HashMap<String, Suspensao>()
        for (i in 0 until lista.length()) {
            val item = lista.getJSONObject(i)
            val fim = if (item.isNull("fim")) null else parseData(item.getString("fim"))
            novas[item.getString("package_name")] = Suspensao(item.optString("nome"), fim)
        }
        suspensoes = novas
        salvarSuspensoes(lista.toString())
    }

    private fun notificarMensagens(json: JSONObject) {
        val lista = json.optJSONArray("mensagens") ?: return
        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val jaNotificadas = prefs.getStringSet(KEY_NOTIFICADAS, emptySet()) ?: emptySet()
        val pendentes = HashSet<String>()
        val nm = NotificationManagerCompat.from(this)
        val abrirApp = packageManager.getLaunchIntentForPackage(packageName)

        for (i in 0 until lista.length()) {
            val msg = lista.getJSONObject(i)
            val id = msg.getInt("id")
            pendentes.add(id.toString())
            if (id.toString() in jaNotificadas) continue

            val texto = msg.getString("texto")
            val notificacao = NotificationCompat.Builder(this, CANAL_MENSAGENS)
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setContentTitle("Mensagem dos seus responsáveis")
                .setContentText(texto)
                .setStyle(NotificationCompat.BigTextStyle().bigText(texto))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(abrirApp?.let {
                    PendingIntent.getActivity(this, id, it, PendingIntent.FLAG_IMMUTABLE)
                })
                .build()
            try {
                nm.notify(ID_NOTIFICACAO_MENSAGEM + id, notificacao)
            } catch (e: SecurityException) {
                Log.w(TAG, "Sem permissao de notificacao", e)
            }
        }
        // Guarda so as que ainda nao foram lidas, para o conjunto nao crescer para sempre.
        prefs.edit().putStringSet(KEY_NOTIFICADAS, pendentes).apply()
    }

    private fun salvarSuspensoes(json: String) {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_SUSPENSOES, json).apply()
    }

    // Mantem o bloqueio funcionando sem internet, com a ultima lista recebida.
    private fun lerSuspensoesSalvas(): Map<String, Suspensao> = try {
        val salvo = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SUSPENSOES, null)
        if (salvo == null) emptyMap() else {
            val lista = org.json.JSONArray(salvo)
            (0 until lista.length()).associate { i ->
                val item = lista.getJSONObject(i)
                val fim = if (item.isNull("fim")) null else parseData(item.getString("fim"))
                item.getString("package_name") to Suspensao(item.optString("nome"), fim)
            }
        }
    } catch (e: Exception) {
        emptyMap()
    }

    data class Sessao(val token: String, val apiUrl: String)

    companion object {
        private const val TAG = "MonitorService"
        private const val PREFS = "tcc_monitor"
        private const val KEY_TOKEN = "token"
        private const val KEY_API_URL = "api_url"
        private const val KEY_SUSPENSOES = "suspensoes"
        private const val KEY_NOTIFICADAS = "mensagens_notificadas"
        private const val CANAL_MONITOR = "monitor"
        private const val CANAL_MENSAGENS = "mensagens"
        private const val ID_NOTIFICACAO_MONITOR = 1
        private const val ID_NOTIFICACAO_MENSAGEM = 1000
        private const val INTERVALO_BLOQUEIO_MS = 1000L
        private const val INTERVALO_API_S = 60L

        fun salvarSessao(context: Context, token: String, apiUrl: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_TOKEN, token)
                .putString(KEY_API_URL, apiUrl)
                .apply()
        }

        fun limparSessao(context: Context) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        }

        fun lerSessao(context: Context): Sessao? {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val token = prefs.getString(KEY_TOKEN, null) ?: return null
            val apiUrl = prefs.getString(KEY_API_URL, null) ?: return null
            return Sessao(token, apiUrl)
        }

        fun criarCanais(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(
                NotificationChannel(CANAL_MONITOR, "Monitoramento", NotificationManager.IMPORTANCE_MIN).apply {
                    description = "Aviso fixo enquanto o controle de tempo de tela está ativo"
                }
            )
            nm.createNotificationChannel(
                NotificationChannel(CANAL_MENSAGENS, "Mensagens dos responsáveis", NotificationManager.IMPORTANCE_HIGH)
            )
        }

        // A API manda datas no formato ISO em UTC, ex.: 2026-09-30T23:59:59.000Z
        fun parseData(iso: String): Long? = try {
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", Locale.US)
                .apply { timeZone = TimeZone.getTimeZone("UTC") }
                .parse(iso)?.time
        } catch (e: Exception) {
            null
        }
    }
}
